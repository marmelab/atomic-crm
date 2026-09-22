-- ===========================================================================
-- A Start Week is something Leif decides, not something a booking implies
-- ===========================================================================
--
-- Owner correction, and it invalidates almost every Living Example start
-- date in this database.
--
-- A client commits to the programme and then chooses when to begin. When
-- Leif is booked months ahead, somebody may deliberately wait weeks before
-- taking a first session. The Start Week is the owner's decision; an Acuity
-- booking is a usage fact that follows from it and never establishes or
-- moves it.
--
-- The CRM had it the other way round. Migration 20260918180000 set
-- enrollments.start_date to min(client_sessions.scheduled_at)::date — "real
-- dated evidence, not a guess", which was a reasonable-sounding rule and is
-- the wrong rule. Checked against production, 19 of 22 Living Example
-- Enrollments carry a start_date that is EXACTLY their first booked
-- session. Three carry a date with no sessions behind it at all: Linda
-- Turner's, which Leif stated himself (20260918190000); Daniel
-- Alexander's, which has no traceable basis in this CRM — he has never
-- booked anything, and Leif does not recognise the date; and Sigrid
-- Kipper Thau's 2026-08-05, on an Enrollment that is no longer live.
-- Rehearsed against production before deployment, these classify as 19
-- session_derived and 3 unknown, which is the whole of the 22.
--
-- Nothing here changes a single recorded date. Rewriting real rows on the
-- strength of an inference about an inference is how the first mistake
-- happened. What this adds is the missing fact: WHERE each date came from,
-- so the capacity maths can tell an owner-stated commitment from a guess,
-- and so the guesses can be put in front of Leif instead of quietly
-- driving a forecast.

alter table public.enrollments
  add column if not exists start_date_source text;

alter table public.enrollments
  drop constraint if exists enrollments_start_date_source_check;

alter table public.enrollments
  add constraint enrollments_start_date_source_check
  check (
    start_date_source is null
    or start_date_source in ('owner', 'session_derived', 'unknown')
  );

comment on column public.enrollments.start_date_source is
  'Where start_date came from. ''owner'': Leif stated the Start Week — the only value that makes it canonical for capacity commitments. ''session_derived'': back-filled from the client''s first booked session by migration 20260918180000, which is an inference the owner has since ruled out; needs confirming. ''unknown'': a date with no traceable basis. Null only when start_date is null.';

-- Classify what is already here, by shape rather than by name, so this
-- replays into any database rather than describing MAIN's rows.
--
-- A start date equal to the client's own earliest booked session is the
-- signature of 20260918180000's rule. It is conceivable that Leif chose a
-- Start Week that happens to land on the first session — that would make
-- this classification pessimistic, never wrong: 'session_derived' means
-- "ask Leif", and asking about a date that turns out to be right costs one
-- confirmation.
update public.enrollments e
   set start_date_source = case
         when e.start_date = (
           select min(cs.scheduled_at)::date
             from client_sessions cs
             join deals d on d.id = e.opportunity_id
            where cs.contact_id = d.contact_id
         ) then 'session_derived'
         else 'unknown'
       end
 where e.start_date is not null
   and e.start_date_source is null;

-- A cohort Enrollment's start is the Cohort's own published programme
-- start — a real scheduled fact Leif set when he created the round, not an
-- inference about one person. Those are owner-stated by construction.
update public.enrollments e
   set start_date_source = 'owner'
  from deals d
  join cohorts ch on ch.id = d.cohort_id
 where e.opportunity_id = d.id
   and e.start_date is not null
   and e.start_date = ch.program_start_at::date
   and e.start_date_source = 'session_derived';

-- A start date with no provenance is not usable as a commitment, so the
-- column has to be filled wherever a date exists. Null means, and only
-- means, that there is no start date to describe.
--
-- Added HERE, after the rows above have been classified, and the ordering
-- is the whole point. `add constraint` validates against existing rows
-- immediately, so stating this before the classification asks a database
-- that already holds dated Enrollments to satisfy a rule nothing has yet
-- had a chance to satisfy. An empty database passes that happily — every
-- clean-room replay did — and production refused on the first of its
-- twenty-two dated rows:
--
--   ERROR: check constraint "enrollments_start_date_has_a_source_check"
--   of relation "enrollments" is violated by some row (SQLSTATE 23514)
--
-- A migration that only works on an empty database is not deterministic in
-- the sense this repository means. Structure and backfill have an order,
-- and it is: column, data, then the rule that binds them.
alter table public.enrollments
  drop constraint if exists enrollments_start_date_has_a_source_check;

alter table public.enrollments
  add constraint enrollments_start_date_has_a_source_check
  check ((start_date is null) = (start_date_source is null));

-- And prove the backfill actually covered everything, rather than trusting
-- that the constraint above would have caught it. It would — but a
-- constraint violation names one row and this names the gap.
do $$
declare
  unsourced bigint;
begin
  select count(*) into unsourced
    from public.enrollments
   where (start_date is null) <> (start_date_source is null);

  if unsourced > 0 then
    raise exception
      '% Enrollment(s) carry a start date with no source, or a source with no start date', unsourced;
  end if;
end $$;

-- From here on the CRM supplies its own provenance. An Enrollment created
-- with a start date and no source is a bug, and the constraint above makes
-- it a loud one.

-- ---------------------------------------------------------------------------
-- Every Enrollment writer now states where its Start Week came from.
-- ---------------------------------------------------------------------------
-- The constraint above makes a start date without a source impossible, so
-- the writers have to supply one or Won stops working. That is the
-- scheduled_on failure class exactly — a column obligation added with no
-- writer to meet it — so all three creation paths were inventoried and
-- changed together: this trigger, its FakeRest mirror
-- (providers/fakerest/dataProvider.ts), and activateEnrollment.ts.

CREATE OR REPLACE FUNCTION public.handle_deal_won()
 RETURNS trigger
 LANGUAGE plpgsql
 -- SECURITY DEFINER carried forward from 20260921100000, deliberately.
 -- That migration is the live production repair for
 --   42501 permission denied for function seed_enrollment_onboarding
 -- and this one redefines the same function AFTER it. Re-stating the body
 -- without this line would silently revert the fix and stop every paid
 -- sale creating its Enrollment again. See the assertion at the end of
 -- this file, and contracts/capacity/wonStaysElevated.test.ts.
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cohort cohorts%ROWTYPE;
  v_enrollment_id bigint;
begin
  -- A historical Won Deal must never fire live onboarding: the importer
  -- inserts the truthful final-state Enrollment itself. Only
  -- set_historical_migration_mode() can set this GUC, transaction-locally.
  if current_setting('app.migration_mode', true) = 'true' then
    return new;
  end if;

  if new.stage = 'won' and (tg_op = 'INSERT' or old.stage is distinct from 'won') then
    if new.cohort_id is not null then
      select * into v_cohort from cohorts where id = new.cohort_id;
    end if;

    -- Idempotent: the unique constraint on enrollments.opportunity_id means
    -- re-saving Won never creates a duplicate. `returning ... into` only
    -- assigns on a genuine insert, so the block below stays replay-safe.
    insert into enrollments (opportunity_id, status, start_date, end_date, onboarding_tracking, start_date_source)
    values (
      new.id,
      'onboarding',
      v_cohort.program_start_at::date,
      v_cohort.program_end_at::date,
      -- A sale made today is tracked. legacy_untracked is only ever a
      -- statement about the past, never a default for new work.
      'tracked',
      -- A Cohort start is a date Leif published when he created the round,
      -- so a cohort Enrollment begins life with an owner-stated Start Week.
      -- An individual Offer has no such date to snapshot: the Start Week is
      -- Leif's to set, and until he does it stays unknown rather than being
      -- inferred from a booking, a Won date or a payment.
      case when v_cohort.program_start_at is not null then 'owner' end
    )
    on conflict (opportunity_id) do nothing
    returning id into v_enrollment_id;

    if v_enrollment_id is not null then
      perform public.seed_enrollment_onboarding(v_enrollment_id);

      -- Scholarship slot occupancy moves from Deal to Enrollment in the
      -- same transaction, so the slot is never observably free between the
      -- two.
      if new.pricing_mode = 'scholarship' then
        update scholarship_slots
           set holder_deal_id = null, holder_enrollment_id = v_enrollment_id, updated_at = now()
         where offer_id = new.offer_id and holder_deal_id = new.id;
        if not found then
          raise exception 'Deal % reached Won as scholarship but held no scholarship slot for offer % — data inconsistency', new.id, new.offer_id;
        end if;

        insert into scholarship_slot_events (offer_id, deal_id, enrollment_id, event_type, occurred_at)
        values (new.offer_id, new.id, v_enrollment_id, 'deal_converted_to_enrollment', now());
      end if;
    end if;
  end if;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- The privilege repair survives this migration
-- ---------------------------------------------------------------------------
-- This file redefines handle_deal_won() and applies after 20260921100000,
-- which is what makes the check worth having: a redefinition that dropped
-- SECURITY DEFINER would re-break every paid sale, and would do it
-- silently, at deploy time, with no test failing.
do $$
begin
  if not exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'handle_deal_won'
       and p.prosecdef
  ) then
    raise exception
      'handle_deal_won() is no longer SECURITY DEFINER — this reverts the fix for 42501 on seed_enrollment_onboarding';
  end if;
end $$;
