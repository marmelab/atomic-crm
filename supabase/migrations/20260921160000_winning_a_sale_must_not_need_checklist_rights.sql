-- ===========================================================================
-- Marking an Opportunity Won must not need rights to seed a checklist
-- ===========================================================================
--
-- A regression this repository introduced, found by its own new tests.
--
-- Migration 20260920120000 — Reliability Pass 1's own security work —
-- revoked EXECUTE on five privileged functions from anon, authenticated and
-- service_role. That was right for four of them. The fifth,
-- seed_enrollment_onboarding(), is not only called directly: it is called by
-- handle_deal_won(), the AFTER trigger that creates a client's Enrollment
-- the moment an Opportunity is marked Won.
--
-- handle_deal_won() was SECURITY INVOKER, so that inner call ran as whoever
-- saved the deal. Since 20260920120000 reached MAIN, every Won transition
-- has failed:
--
--   ERROR: 42501 permission denied for function seed_enrollment_onboarding
--
-- for `authenticated` — the role Leif's own browser holds — and for
-- `service_role`, which is how an Edge Function would do it. This is the
-- scheduled_on failure class again, and from the same pass that was built to
-- stop it: a privilege obligation tightened with no check that the writers
-- could still meet it. The sales-call writer contracts cover Sales Call
-- creation; nothing covered "mark an Opportunity Won".
--
-- The fix follows the precedent set by 20260920130000, which had to solve
-- exactly this for clamp_contact_last_seen(): elevate the TRIGGER, and leave
-- the callee locked down. seed_enrollment_onboarding() stays unreachable by
-- a client directly — a signed-in user still cannot seed a checklist onto
-- somebody else's Enrollment — while the trigger that legitimately needs it
-- can call it. search_path is pinned, same as every other SECURITY DEFINER
-- function here.

CREATE OR REPLACE FUNCTION public.handle_deal_won()
 RETURNS trigger
 LANGUAGE plpgsql
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
-- Verification: the role the browser actually holds can complete a Won
-- transition end to end. Runs the real write path rather than reading a
-- catalog — an ACL says what a lock is; this turns the handle.
do $$
declare
  v_sales bigint;
  v_contact bigint;
  v_deal bigint;
begin
  select id into v_sales from sales limit 1;
  if v_sales is null then
    raise notice 'no sales row to probe with; skipping behavioural check';
    return;
  end if;

  insert into contacts (first_name, last_name, sales_id)
    values ('Won', 'Probe', v_sales) returning id into v_contact;

  begin
    set local role authenticated;
    insert into deals (name, contact_id, offer_id, stage, amount, sales_id, index)
      values ('won probe', v_contact, 1, 'won', 0, v_sales, 0)
      returning id into v_deal;
    reset role;
  exception when insufficient_privilege then
    reset role;
    raise exception 'authenticated still cannot mark an Opportunity Won: %', sqlerrm;
  end;

  if not exists (select 1 from enrollments where opportunity_id = v_deal) then
    raise exception 'Won produced no Enrollment';
  end if;

  raise exception 'rollback probe';
exception when others then
  if sqlerrm <> 'rollback probe' then raise; end if;
  raise notice 'authenticated can mark an Opportunity Won, and it creates the Enrollment';
end $$;
