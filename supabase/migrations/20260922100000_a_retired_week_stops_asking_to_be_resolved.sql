-- Year Tracking is a plan, not a record of where sessions happened.
-- ===========================================================================
--
-- Owner clarification, and it is the invariant this migration protects:
--
--   The `1:1s` weeks in Year Tracking are the weeks Leif INTENDED to be
--   open. They are not a log of weeks in which appointments occurred.
--
-- The case that made it explicit: the normal 1:1 week before 30 August was
-- open, Leif became ill, and five sessions moved into 30 Aug – 2 Sep. That
-- following week was never a 1:1 week. The sessions that happened in it are
-- real, and they are Acuity facts — but the week must not become an
-- entitlement week, or every client who was moved would silently gain one.
--
-- Nothing in the schedule derivation reads client_sessions, so a make-up
-- week cannot become an eligible week. That already holds. What did NOT
-- hold is what happens when Leif CORRECTS the calendar afterwards, which is
-- the other half of the same story and the subject of this migration.
--
-- Two faults, both found by reading the rebuild against production:
--
--   1. Two identical `1:1s` events for one real week produced TWO expected
--      slots. Jules has exactly this for the week of 17 May: two slots, one
--      real week, and the second can never be fulfilled by anything — so it
--      raises a Needs Review that no session could ever answer. The app
--      layer was taught to count a week once (dd314304); the canonical
--      schedule in this function was not, and it is the one that matters.
--
--   2. A slot retired by a rebuild kept its open cadence issue and its open
--      Task. So correcting a mistakenly-added week left Leif with a Needs
--      Attention item asking him to classify a week that no longer exists,
--      and no way to make it go away. The slot itself is deliberately kept
--      when something historical hangs off it — that is audit, and it
--      stays. What must not persist is the ASKING.

-- ---------------------------------------------------------------------------
-- A retirement is a thing that can happen to an issue, and is recorded.
-- ---------------------------------------------------------------------------
alter table public.client_session_cadence_issue_events
  drop constraint if exists client_session_cadence_issue_events_kind_check;

alter table public.client_session_cadence_issue_events
  add constraint client_session_cadence_issue_events_kind_check
  check (kind in ('created', 'resolved', 'reclassified', 'reopened', 'retired'));

comment on constraint client_session_cadence_issue_events_kind_check
  on public.client_session_cadence_issue_events is
  'created / reopened: the week needs a decision. resolved / reclassified: Leif made one. retired: the week left the canonical schedule — no decision was made and none is owed, and the row is kept so the history still reads.';

-- ---------------------------------------------------------------------------
-- The canonical schedule counts WEEKS, and stops asking about retired ones.
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
  v_stale int;
begin
  canonical_weeks := 0; required_weeks := 0; kept := 0; renumbered := 0;
  inserted := 0; retired_with_history := 0; discarded := 0;

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
  --
  -- DISTINCT ON the week itself, because what is being counted is weeks
  -- Leif is open, not calendar entries. Two identical events for one week
  -- are one week; counting them twice spends two of a client's twelve
  -- sessions on a week that can only hold one, and leaves a slot nothing
  -- can ever fulfil.
  create temporary table _canonical on commit drop as
  with distinct_weeks as (
    select distinct on (w.window_start, w.window_end)
           w.id as window_id, w.window_start, w.window_end, w.raw_title
      from expected_session_windows w
     where v_start is not null
       and w.offer_id = v_offer_id
       and w.deleted_at is null
       and w.window_end > v_start
     order by w.window_start, w.window_end, w.id
  )
  select window_id,
         row_number() over (
           order by window_start, window_end, window_id
         )::int as ordinal,
         window_start,
         window_end,
         raw_title
    from distinct_weeks
   order by window_start, window_end, window_id
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

  -- And stop asking about the survivors.
  --
  -- The slot stays — something historical points at it and that is the
  -- whole reason it was kept. But a week that is no longer part of the
  -- schedule is not a week Leif owes anyone a decision about, and leaving
  -- the issue open leaves a Needs Attention item he cannot clear by any
  -- honest answer. `classification` is left null on purpose: nobody
  -- decided anything, and recording a decision that was never made would
  -- be worse than the stale task.
  with retired_issues as (
    update client_session_cadence_issues i
       set resolved_at = now()
      from enrollment_expected_sessions s
     where s.id = i.enrollment_expected_session_id
       and s.enrollment_id = p_enrollment_id
       and s.retired_at is not null
       and i.resolved_at is null
    returning i.id
  ),
  logged as (
    insert into client_session_cadence_issue_events (cadence_issue_id, kind)
    select id, 'retired' from retired_issues
    returning 1
  )
  select count(*)::int into v_stale from logged;

  -- The Task is the surface Leif actually sees, so it closes with the
  -- issue. Same shape as the app's own completeResolveCadenceIssueTask.
  update tasks t
     set done_date = now(), status = 'completed'
    from client_session_cadence_issues i
    join enrollment_expected_sessions s
      on s.id = i.enrollment_expected_session_id
   where t.cadence_issue_id = i.id
     and t.done_date is null
     and s.enrollment_id = p_enrollment_id
     and s.retired_at is not null;

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
  'Recomputes one Enrollment''s derived Session Week schedule from its owner-stated Start Date and the Year Tracking calendar. Counts each real week once, however many calendar events describe it. Never touches actual sessions, attendance, or an owner''s cadence classification — but a week that leaves the schedule stops asking to be classified. Idempotent: the same Start Date and the same calendar always produce the same schedule.';

-- ---------------------------------------------------------------------------
-- And prove it on the way in.
-- ---------------------------------------------------------------------------
do $$
declare
  v_dupes bigint;
  v_stale bigint;
begin
  -- No live slot may share a week with another live slot for the same
  -- Enrollment. This is the Jules shape, stated as a fact about the data
  -- rather than as a promise about the function.
  select count(*) into v_dupes from (
    select enrollment_id, window_start, window_end
      from enrollment_expected_sessions
     where retired_at is null
     group by 1, 2, 3
    having count(*) > 1
  ) d;
  if v_dupes > 0 then
    raise notice
      '% Enrollment week(s) still have more than one live slot; the next rebuild will collapse them', v_dupes;
  end if;

  -- And nothing retired may still be asking to be resolved.
  select count(*) into v_stale
    from client_session_cadence_issues i
    join enrollment_expected_sessions s
      on s.id = i.enrollment_expected_session_id
   where s.retired_at is not null
     and i.resolved_at is null;
  if v_stale > 0 then
    raise notice
      '% cadence issue(s) sit on a retired week and will be closed by the next rebuild', v_stale;
  end if;
end $$;
