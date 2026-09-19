-- An empty onboarding checklist means three different things today.
--
-- Nothing records whether the CRM is supposed to know an Enrollment's
-- onboarding, so every consumer guessed, and they guessed differently:
--
--   assessPostSaleSetup    no rows -> nothing is blocking -> effectively done
--   computeOnboardingProgress  no rows -> allRequiredComplete false -> not done
--   the activation trigger  no incomplete row EXISTS -> activation allowed
--
-- All three are defensible readings of the same absence, which is the
-- proof that absence was never the right thing to read. Twenty-eight of
-- this database's thirty-three Enrollments were imported as already-running
-- clients whose onboarding happened before any of this existed; their empty
-- checklist is a fact about the CRM, not about the client. Lara Spagnola's
-- empty checklist means the opposite — her onboarding has not happened yet.
--
-- So the Enrollment says which it is, and nobody infers it again.
--
--   tracked            the CRM is expected to know and enforce this
--                      checklist. Zero required items is an integrity
--                      problem, not a completion.
--   legacy_untracked   onboarding happened outside the tracked system.
--                      Zero rows is valid and must not be rendered as
--                      0% complete or as broken onboarding.
--
-- New Enrollments are tracked. That is the default in every sense: the
-- column's default, what the Won path produces, and what somebody gets if
-- they forget to think about it.
--
-- This migration is deterministic and must rebuild from empty. Classifying
-- THIS database's existing rows, and repairing Lara, are production facts
-- and live in 20260919040000.

begin;

-- ---------------------------------------------------------------------
-- 1. The state itself
-- ---------------------------------------------------------------------
alter table public.enrollments
  add column if not exists onboarding_tracking text not null default 'tracked';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'enrollments_onboarding_tracking_check'
       and conrelid = 'public.enrollments'::regclass
  ) then
    alter table public.enrollments
      add constraint enrollments_onboarding_tracking_check check (
        onboarding_tracking in ('tracked', 'legacy_untracked')
      );
  end if;
end $$;

comment on column public.enrollments.onboarding_tracking is
  'Whether the CRM is expected to know this Enrollment''s onboarding checklist. tracked = zero required items is an integrity problem. legacy_untracked = onboarding happened before the checklist existed, and zero rows is valid. Never inferred from the row count.';

-- A container cannot finish before it starts. Only asserted where both
-- dates are known: a missing date is not permission to invent one.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'enrollments_end_after_start_check'
       and conrelid = 'public.enrollments'::regclass
  ) then
    alter table public.enrollments
      add constraint enrollments_end_after_start_check check (
        start_date is null or end_date is null or end_date >= start_date
      );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Seeding, in one place instead of inside one trigger
-- ---------------------------------------------------------------------
-- The Won trigger did this inline, which meant it was the only thing that
-- could do it: a repair, a backfill or a second creation path had to
-- reimplement it and would drift. It is a function now, and the trigger
-- calls it, so "the checklist a tracked Enrollment should have" has
-- exactly one definition.
--
-- Idempotent twice over — the unique key on (enrollment_id,
-- requirement_key) absorbs repeated items, and a required item only gets a
-- Task when it has none. Safe to call on retry, on re-save, or on a row
-- that is already half-seeded.
create or replace function public.seed_enrollment_onboarding(
  p_enrollment_id bigint,
  p_due_at timestamptz default now() + interval '3 days'
) returns int
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_deal deals%rowtype;
  v_contact_name text;
  v_item record;
  v_seeded int := 0;
begin
  select d.* into v_deal
    from deals d
    join enrollments e on e.opportunity_id = d.id
   where e.id = p_enrollment_id;
  if not found then
    raise exception 'enrollment % does not exist', p_enrollment_id;
  end if;

  select nullif(trim(both ' ' from coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '')
    into v_contact_name
    from contacts where id = v_deal.contact_id;
  v_contact_name := coalesce(v_contact_name, v_deal.name);

  for v_item in
    insert into enrollment_onboarding_items
      (enrollment_id, requirement_key, label, task_text_template, is_required, sort_order)
    select p_enrollment_id, t.key, t.label, t.task_text_template, t.is_required, t.sort_order
      from onboarding_requirement_templates t
     where t.offer_id = v_deal.offer_id and t.is_active
    on conflict (enrollment_id, requirement_key) do nothing
    returning id, is_required
  loop
    v_seeded := v_seeded + 1;
    -- Optional items deliberately get no Task: an auto-task for something
    -- nobody has to do is noise on Leif's dashboard.
    if v_item.is_required and not exists (
      select 1 from tasks where onboarding_item_id = v_item.id
    ) then
      insert into tasks (contact_id, type, text, due_date, status, enrollment_id, onboarding_item_id)
      select v_deal.contact_id, 'onboarding_item',
             replace(i.task_text_template, '{name}', v_contact_name),
             -- Not now(): every required item due the instant somebody
             -- pays reads as instantly overdue, which is noise rather
             -- than urgency.
             p_due_at, 'pending', p_enrollment_id, i.id
        from enrollment_onboarding_items i
       where i.id = v_item.id;
    end if;
  end loop;

  return v_seeded;
end;
$$;

comment on function public.seed_enrollment_onboarding(bigint, timestamptz) is
  'Seeds a tracked Enrollment''s onboarding checklist from its Offer''s active templates, with one Task per required item. Idempotent: safe on retry, re-save or a half-seeded row. The single definition of what checklist a tracked Enrollment should have.';

revoke all on function public.seed_enrollment_onboarding(bigint, timestamptz) from public, anon;

-- ---------------------------------------------------------------------
-- 3. Activation stops reading absence as completion
-- ---------------------------------------------------------------------
-- Two defects, both from the old guard asking only whether an INCOMPLETE
-- row exists:
--
--   A tracked Enrollment with NO items at all activated silently. No row
--   is incomplete when no row exists, so the emptiest possible checklist
--   passed the check that the full one would fail. This is the shape an
--   Offer with no active templates produces, and it looked like success.
--
--   It only ever fired for onboarding -> active. Every other route into
--   active — from offboarding, from completed — skipped the requirement
--   entirely.
--
-- Now: any entry into active is checked, and a tracked Enrollment must
-- have required items AND have finished them. legacy_untracked activates
-- deliberately, because for those rows the absence is the truth.
create or replace function public.enforce_enrollment_activation_requirements()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_required int;
  v_outstanding int;
begin
  if new.status is distinct from 'active' or old.status is not distinct from 'active' then
    return new;
  end if;

  -- The historical importer writes truthful final states directly and must
  -- not be forced through a live checklist it is not describing. Only
  -- set_historical_migration_mode() can set this, and only for one
  -- transaction.
  if current_setting('app.migration_mode', true) = 'true' then
    return new;
  end if;

  if new.onboarding_tracking = 'legacy_untracked' then
    return new;
  end if;

  select count(*) filter (where is_required),
         count(*) filter (where is_required and status <> 'done')
    into v_required, v_outstanding
    from enrollment_onboarding_items
   where enrollment_id = new.id;

  if v_required = 0 then
    raise exception 'Cannot activate enrollment %: it is tracked but has no required onboarding items. Either its Offer has no active onboarding templates, or seeding did not run. An empty checklist is not a finished one.', new.id
      using hint = 'Seed it with seed_enrollment_onboarding(), or record it as legacy_untracked if its onboarding genuinely happened outside the CRM.';
  end if;

  if v_outstanding > 0 then
    raise exception 'Cannot activate enrollment %: % of % required onboarding items are not done', new.id, v_outstanding, v_required;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. The Won path uses the shared seeder
-- ---------------------------------------------------------------------
create or replace function public.handle_deal_won()
returns trigger
language plpgsql
set search_path to 'public'
as $$
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
    insert into enrollments (opportunity_id, status, start_date, end_date, onboarding_tracking)
    values (
      new.id,
      'onboarding',
      v_cohort.program_start_at::date,
      v_cohort.program_end_at::date,
      -- A sale made today is tracked. legacy_untracked is only ever a
      -- statement about the past, never a default for new work.
      'tracked'
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
$$;

-- ---------------------------------------------------------------------
-- 5. A tracked Enrollment with no required items, as a question anybody
--    can ask
-- ---------------------------------------------------------------------
-- Not a CHECK: a CHECK cannot see child rows, and one that could would
-- refuse the Enrollment INSERT that must happen before its items exist.
-- A view instead, so the condition is visible rather than silent, and so
-- the answer is the same for a person, a test and an operations query.
create or replace view public.enrollments_missing_onboarding as
select e.id as enrollment_id,
       e.opportunity_id,
       e.status,
       e.onboarding_tracking,
       d.offer_id,
       (select count(*) from public.onboarding_requirement_templates t
         where t.offer_id = d.offer_id and t.is_active) as active_templates
  from public.enrollments e
  join public.deals d on d.id = e.opportunity_id
 where e.onboarding_tracking = 'tracked'
   and not exists (
     select 1 from public.enrollment_onboarding_items i
      where i.enrollment_id = e.id and i.is_required
   );

comment on view public.enrollments_missing_onboarding is
  'Tracked Enrollments carrying no required onboarding items. Empty is the healthy state. A row here means seeding did not run, or the Offer has no active onboarding templates — either way the checklist is missing rather than finished, and activation will refuse.';

grant select on public.enrollments_missing_onboarding to authenticated;

-- ---------------------------------------------------------------------
-- 6. Prove it landed
-- ---------------------------------------------------------------------
do $$
declare
  v_missing text := '';
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'enrollments'
                    and column_name = 'onboarding_tracking') then
    v_missing := v_missing || 'enrollments.onboarding_tracking ';
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'enrollments_onboarding_tracking_check') then
    v_missing := v_missing || 'enrollments_onboarding_tracking_check ';
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'enrollments_end_after_start_check') then
    v_missing := v_missing || 'enrollments_end_after_start_check ';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'seed_enrollment_onboarding') then
    v_missing := v_missing || 'seed_enrollment_onboarding() ';
  end if;
  if not exists (select 1 from information_schema.views
                  where table_schema = 'public'
                    and table_name = 'enrollments_missing_onboarding') then
    v_missing := v_missing || 'enrollments_missing_onboarding ';
  end if;

  if v_missing <> '' then
    raise exception 'onboarding tracking did not land: %', v_missing;
  end if;
end $$;

commit;
