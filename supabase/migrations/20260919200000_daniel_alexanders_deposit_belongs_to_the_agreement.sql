-- MAIN-ONLY. Daniel Alexander's $500 was a deposit, not a separate thing.
--
-- Listed in replay-manifest.json: it records owner-stated commercial truth
-- for one named production Opportunity and owns no schema.
--
-- Stripe can prove the plan and cannot prove the agreement. His schedule
-- sub_sched_1UDvoEDnvpNz37ODOBwSsLOR is six monthly payments of $583.00
-- from 2026-11-01, and $500.00 was taken on 2026-09-10 under payment
-- intent pi_3UDvmgDnvpNz37OD4cVqwA9s. Read from Stripe alone that is two
-- defensible readings — $3,498 for the plan by itself, or $3,998 with the
-- deposit counted in — so the derivation in stripeAgreedTerms.ts refuses
-- it, which is why it is still unresolved and why this migration exists.
--
-- Leif states it was a deposit toward the same programme:
--
--   $500.00 deposit  +  6 x $583.00  =  $3,998.00 agreed
--
-- So the total is recorded as owner_confirmed, and NOTHING about the money
-- moves. The $500 row is the same row, the six installments stay in Stripe
-- where they live, the plan object is untouched. What is written here is
-- the RELATIONSHIP between facts that were already recorded separately.
--
-- The installment columns describe the plan, not the total, and do not
-- multiply out to it — that is the shape of a deposit-plus-plan agreement
-- and describeAgreedTerms() states it without pretending the arithmetic
-- closes.

begin;

do $$
declare
  v_global_before numeric;
  v_global_after numeric;
  v_items_before int;
  v_plans_before int;
  v_his numeric;
begin
  -- ---- what must be true before anything is written ----
  if not exists (
    select 1 from deals
     where id = 80
       and stage = 'won'
       and outcome is null
       and archived_at is null
       and selected_payment_total is null
       and selected_payment_total_source is null
       and stripe_subscription_schedule_id = 'sub_sched_1UDvoEDnvpNz37ODOBwSsLOR'
  ) then
    raise exception 'Opportunity 80 is no longer the case this repair was written for';
  end if;

  -- Exactly one payment, and it is the deposit.
  select count(*), coalesce(sum(amount), 0)
    into v_items_before, v_his
    from deal_payment_schedule_items
   where deal_id = 80 and status = 'paid';
  if v_items_before <> 1 or v_his <> 500.00 then
    raise exception 'expected one paid $500.00 deposit on Opportunity 80, found % rows totalling %',
      v_items_before, v_his;
  end if;
  if not exists (
    select 1 from deal_payment_schedule_items
     where deal_id = 80
       and stripe_payment_intent_id = 'pi_3UDvmgDnvpNz37OD4cVqwA9s'
  ) then
    raise exception 'the $500.00 on Opportunity 80 is not the deposit this repair describes';
  end if;

  select count(*) into v_plans_before from deal_stripe_plan_objects where deal_id = 80;

  -- The arithmetic, restated rather than trusted.
  if 500.00 + (6 * 583.00) <> 3998.00 then
    raise exception 'the deposit and the plan do not make the stated total';
  end if;

  -- Money across the whole database, so "nothing moved" can be proved
  -- rather than asserted.
  select coalesce(sum(amount), 0) into v_global_before
    from deal_payment_schedule_items where status = 'paid';

  -- ---- the one write ----
  update deals
     set selected_payment_total = 3998.00,
         selected_payment_total_source = 'owner_confirmed',
         selected_installment_count = 6,
         selected_installment_amount = 583.00
   where id = 80;

  -- ---- what must be true after ----
  if not exists (
    select 1 from deals
     where id = 80
       and selected_payment_total = 3998.00
       and selected_payment_total_source = 'owner_confirmed'
       and selected_installment_count = 6
       and selected_installment_amount = 583.00
       and stage = 'won'
       and outcome is null
  ) then
    raise exception 'Opportunity 80 did not end up as stated';
  end if;

  -- No money was created, moved or reinterpreted — here or anywhere.
  select coalesce(sum(amount), 0) into v_global_after
    from deal_payment_schedule_items where status = 'paid';
  if v_global_after <> v_global_before then
    raise exception 'collected money changed from % to %', v_global_before, v_global_after;
  end if;
  if (select count(*) from deal_payment_schedule_items where deal_id = 80) <> v_items_before then
    raise exception 'a payment row was created or removed on Opportunity 80';
  end if;
  if (select count(*) from deal_stripe_plan_objects where deal_id = 80) <> v_plans_before then
    raise exception 'a Stripe plan object was created or removed on Opportunity 80';
  end if;
  if (select status from enrollments where opportunity_id = 80) <> 'active' then
    raise exception 'the Enrollment changed, and nothing here should have changed it';
  end if;

  -- And the remaining amount the CRM will show is the one Leif stated.
  select coalesce(sum(amount), 0) into v_his
    from deal_payment_schedule_items where deal_id = 80 and status = 'paid';
  if v_his <> 500.00 then
    raise exception 'his collected amount changed, and nothing here should have changed it';
  end if;
  if (select selected_payment_total from deals where id = 80) - v_his <> 3498.00 then
    raise exception 'remaining is not the stated $3,498.00';
  end if;
end $$;

commit;
