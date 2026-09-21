-- ===========================================================================
-- A session schedule is derived, and must be rebuildable
-- ===========================================================================
--
-- enrollment_expected_sessions was append-only on purpose, and the purpose
-- was right: a cadence issue points at a SLOT, and Leif's classification of
-- that issue — "she told me she was skipping that week" — is a decision he
-- made about a real week. If a later calendar edit could renumber or move
-- the slot underneath it, his decision would silently come to be about a
-- different week. The FK is ON DELETE CASCADE, so deleting a slot deletes
-- the issue, its note, its resolution and its whole event history with it.
--
-- What the design did not anticipate is the Start Date itself being wrong.
-- Migration 20260918180000 derived every Living Example start from the
-- client's first booked session, and the owner has since ruled that
-- inference out and stated all eighteen himself. Four of them moved. An
-- append-only table cannot absorb that: capacity would be computed from the
-- corrected Start Dates while each client's own session plan stayed
-- numbered from the old ones. Two timelines for one Enrollment.
--
-- So the distinction gets drawn properly instead of being approximated by
-- never changing anything:
--
--   HISTORICAL, never rewritten by a rebuild
--     client_sessions                     actual Acuity appointments
--     client_sessions.no_show_at          what happened
--     client_session_cadence_issues       Leif's classification and note
--     client_session_cadence_issue_events the full history of that decision
--
--   DERIVED, rebuilt whenever a schedule authority changes
--     which `1:1s` weeks belong to this container
--     their ordinal (Session Week #1..N)
--     the window dates snapshotted on each slot
--
-- A slot that is no longer part of the canonical schedule is RETIRED, not
-- deleted, whenever anything historical hangs off it. Retired rows leave
-- the numbering (a partial unique index) but keep their id, so every issue,
-- note and event still resolves — and they are surfaced for Leif rather
-- than quietly dropped.

-- ---------------------------------------------------------------------------
-- 1. Room for extensions, and for retirement.
-- ---------------------------------------------------------------------------

alter table public.enrollment_expected_sessions
  add column if not exists retired_at timestamp with time zone;

comment on column public.enrollment_expected_sessions.retired_at is
  'Set when a rebuild finds this slot is no longer part of the canonical schedule AND something historical references it. The row keeps its id so the cadence issue hanging off it still resolves; it leaves the Session Week numbering, and is surfaced for owner review.';

-- The ordinal ceiling of 12 was the container length. A cross-week
-- reschedule preserves the entitlement and needs a thirteenth eligible
-- week, so the length is 12 plus one per reschedule. The bound is dropped
-- rather than raised to some other guessed number: the rebuild computes
-- exactly how many slots a container needs, and a second opinion encoded
-- here could only ever contradict it.
alter table public.enrollment_expected_sessions
  drop constraint if exists enrollment_expected_sessions_ordinal_check;

alter table public.enrollment_expected_sessions
  add constraint enrollment_expected_sessions_ordinal_check
  check (ordinal >= 1);

-- Numbering is unique among LIVE slots only. A retired slot keeps whatever
-- ordinal it had — that is part of its history — and no longer competes
-- with the canonical schedule for it.
drop index if exists public.enrollment_expected_sessions_enrollment_ordinal_idx;
create unique index if not exists enrollment_expected_sessions_enrollment_ordinal_idx
  on public.enrollment_expected_sessions (enrollment_id, ordinal)
  where retired_at is null;

-- ---------------------------------------------------------------------------
-- 2. The rebuild.
-- ---------------------------------------------------------------------------

create or replace function public.rebuild_enrollment_expected_sessions(
  p_enrollment_id bigint
)
returns table (
  required_weeks int,
  canonical_weeks int,
  kept int,
  renumbered int,
  inserted int,
  retired_with_history int,
  discarded int
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_start date;
  v_offer_id bigint;
  v_extensions int;
  v_required int;
begin
  select e.start_date, d.offer_id
    into v_start, v_offer_id
    from enrollments e
    join deals d on d.id = e.opportunity_id
   where e.id = p_enrollment_id;

  -- One eligible week per cross-week reschedule, on top of the twelve.
  -- A cadence issue exists only for a week that closed with NO session
  -- inside it, so a same-week time change never produces one and can never
  -- reach this count. A known skip, a no-show and a ghosted session are all
  -- forfeited under the no-rollover rule and extend nothing.
  select count(*)
    into v_extensions
    from client_session_cadence_issues i
   where i.enrollment_id = p_enrollment_id
     and i.classification = 'rescheduled';

  v_required := 12 + coalesce(v_extensions, 0);

  -- The canonical schedule: the eligible `1:1s` weeks from this
  -- Enrollment's own Start Date, in order. Session Week #1 is the week the
  -- Start Date falls IN — window_end is exclusive, so that is exactly
  -- `window_end > start_date`.
  create temporary table _canonical on commit drop as
  select w.id as window_id,
         row_number() over (
           order by w.window_start, w.window_end, w.id
         )::int as ordinal,
         w.window_start,
         w.window_end,
         w.raw_title
    from expected_session_windows w
   where v_start is not null
     and w.offer_id = v_offer_id
     and w.deleted_at is null
     and w.window_end > v_start
   order by w.window_start, w.window_end, w.id
   limit v_required;

  -- Retire every live slot whose week is no longer in the schedule. Done
  -- FIRST so those ordinals leave the unique index before anything is
  -- renumbered into them.
  update enrollment_expected_sessions s
     set retired_at = now()
   where s.enrollment_id = p_enrollment_id
     and s.retired_at is null
     and not exists (
       select 1 from _canonical c where c.window_id = s.source_window_id
     );
  get diagnostics retired_with_history = row_count;

  -- A retired slot with nothing historical attached is a pure projection
  -- and is simply wrong now; keeping it would clutter the record with a
  -- week that never meant anything. One with a cadence issue stays, and is
  -- reported.
  delete from enrollment_expected_sessions s
   where s.enrollment_id = p_enrollment_id
     and s.retired_at is not null
     and not exists (
       select 1 from client_session_cadence_issues i
        where i.enrollment_expected_session_id = s.id
     );
  get diagnostics discarded = row_count;
  retired_with_history := retired_with_history - discarded;

  -- Park the survivors out of the way so a renumber can never collide with
  -- an ordinal it is about to take. The check constraint no longer caps
  -- the value, which is what makes this legal.
  update enrollment_expected_sessions s
     set ordinal = s.ordinal + 1000
   where s.enrollment_id = p_enrollment_id
     and s.retired_at is null;

  -- Renumber what survives to its canonical position, and refresh the
  -- snapshot: if Leif moved a `1:1s` week in Google Calendar, the slot's
  -- displayed dates should follow it. The slot's IDENTITY — and therefore
  -- every issue, note and event hanging off it — is untouched.
  with parked as (
    select s.id, s.ordinal - 1000 as previous_ordinal
      from enrollment_expected_sessions s
     where s.enrollment_id = p_enrollment_id and s.retired_at is null
  ),
  applied as (
    update enrollment_expected_sessions s
       set ordinal = c.ordinal,
           window_start = c.window_start,
           window_end = c.window_end,
           raw_title = c.raw_title
      from _canonical c
     where s.enrollment_id = p_enrollment_id
       and s.retired_at is null
       and s.source_window_id = c.window_id
    -- The parked value carries the ordinal this slot had before the
    -- rebuild, so "actually moved" is distinguishable from "matched and
    -- left where it was". A report that called every match a change would
    -- make an idempotent run look like a rewrite.
    returning s.id, c.ordinal as new_ordinal
  )
  select count(*)::int,
         count(*) filter (where a.new_ordinal <> p.previous_ordinal)::int
    into kept, renumbered
    from applied a join parked p on p.id = a.id;

  -- And add the weeks that were not assigned before.
  with added as (
    insert into enrollment_expected_sessions
      (enrollment_id, source_window_id, ordinal, window_start, window_end, raw_title)
    select p_enrollment_id, c.window_id, c.ordinal, c.window_start, c.window_end, c.raw_title
      from _canonical c
     where not exists (
       select 1 from enrollment_expected_sessions s
        where s.enrollment_id = p_enrollment_id
          and s.retired_at is null
          and s.source_window_id = c.window_id
     )
    returning 1
  )
  select count(*)::int into inserted from added;

  select count(*)::int into canonical_weeks from _canonical;
  required_weeks := v_required;

  drop table if exists _canonical;
  return next;
end;
$function$;

comment on function public.rebuild_enrollment_expected_sessions(bigint) is
  'Recomputes one Enrollment''s derived Session Week schedule from its owner-stated Start Date and the Year Tracking calendar. Never touches actual sessions, attendance, or an owner''s cadence classification. Idempotent: the same Start Date and the same calendar always produce the same schedule.';

-- Every live Living Example Enrollment at once — what a calendar sync runs.
create or replace function public.rebuild_all_expected_sessions()
returns table (
  enrollments_rebuilt int,
  slots_inserted int,
  slots_renumbered int,
  slots_retired_with_history int,
  slots_discarded int
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row record;
  v_result record;
begin
  enrollments_rebuilt := 0;
  slots_inserted := 0;
  slots_renumbered := 0;
  slots_retired_with_history := 0;
  slots_discarded := 0;

  for v_row in
    select e.id
      from enrollments e
      join deals d on d.id = e.opportunity_id
      join offers o on o.id = d.offer_id
     where o.client_session_acuity_appointment_type_id is not null
       and e.status in ('onboarding', 'active', 'offboarding')
       and e.start_date is not null
     order by e.id
  loop
    select * into v_result
      from public.rebuild_enrollment_expected_sessions(v_row.id);
    enrollments_rebuilt := enrollments_rebuilt + 1;
    slots_inserted := slots_inserted + coalesce(v_result.inserted, 0);
    slots_renumbered := slots_renumbered + coalesce(v_result.renumbered, 0);
    slots_retired_with_history :=
      slots_retired_with_history + coalesce(v_result.retired_with_history, 0);
    slots_discarded := slots_discarded + coalesce(v_result.discarded, 0);
  end loop;

  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. A changed Start Date rebuilds its own schedule, immediately.
-- ---------------------------------------------------------------------------
-- The failure this prevents is the one that made this migration necessary:
-- a Start Date corrected in one place while the session plan derived from
-- the old one stays on screen. There is no window in which the two can
-- disagree, because the rebuild happens in the same transaction as the
-- correction.

create or replace function public.rebuild_expected_sessions_on_start_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.start_date is distinct from old.start_date then
    perform public.rebuild_enrollment_expected_sessions(new.id);
  end if;
  return new;
end;
$function$;

drop trigger if exists rebuild_expected_sessions_on_start_change on public.enrollments;
create trigger rebuild_expected_sessions_on_start_change
  after update of start_date on public.enrollments
  for each row
  execute function public.rebuild_expected_sessions_on_start_change();

-- Callable by the CRM, so "Sync Calendar" can rebuild the schedule as well
-- as the calendar. SECURITY DEFINER with a pinned search_path, same shape
-- as every other privileged function here.
revoke all on function public.rebuild_enrollment_expected_sessions(bigint) from public;
revoke all on function public.rebuild_all_expected_sessions() from public;
grant execute on function public.rebuild_enrollment_expected_sessions(bigint) to authenticated, service_role;
grant execute on function public.rebuild_all_expected_sessions() to authenticated, service_role;
