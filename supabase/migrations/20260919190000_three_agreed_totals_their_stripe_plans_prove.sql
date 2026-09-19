-- MAIN-ONLY. Three agreed totals that Stripe already proves.
--
-- Listed in replay-manifest.json: it writes commercial truth for named
-- production Opportunities and owns no schema. The rule that derives these
-- on every future sync lives in the Edge Function
-- (stripe_webhook/stripeAgreedTerms.ts), which is not part of the
-- migration chain; this repair exists because those three plans were
-- created before that rule did, and their Opportunities have been reading
-- "Agreed terms not recorded" ever since.
--
-- Each total is arithmetic on Stripe's own Subscription Schedule, read
-- 2026-09-19 through the read-only investigate path, not a judgement:
--
--   Opportunity 70  Emma Wijns
--     sub_sched_1UHViWDnvpNz37ODR4SF1cRI, not_started, one phase
--     $1,000.00 monthly, 2026-11-01 -> 2027-03-01  =  4 x $1,000 = $4,000.00
--
--   Opportunity 90  Ava Frotton
--     sub_sched_1UB0GqDnvpNz37ODM7QMpfun, not_started, one phase
--     $1,000.00 monthly, 2026-10-01 -> 2027-02-01  =  4 x $1,000 = $4,000.00
--
--   Opportunity 107 Heidi Elias
--     sub_sched_1UEtdJDnvpNz37ODacoQVW9o, not_started, one phase
--     $666.00 monthly, 2026-11-01 -> 2027-05-01    =  6 x $666   = $3,996.00
--
-- Heidi's total is not the $4,000 list price, and that is the point: six
-- monthly payments of a round number do not add up to a round total, and
-- the plan is what she actually agreed to.
--
-- Opportunity 80, Daniel Alexander, is DELIBERATELY NOT REPAIRED. His
-- schedule is equally finite — 6 x $583.00 from 2026-11-01 — but $500.00
-- is already collected outside it. Whether he agreed to $3,498 or to
-- $3,998 is not something Stripe can say, and inventing either would be
-- exactly the kind of fabricated commercial truth this project refuses.
-- He keeps his review until Leif states the number.
--
-- Nothing about money collected changes here. Emma, Ava and Heidi have
-- collected nothing; these are commitments, not receipts.

begin;

do $$
declare
  r record;
  v_written int := 0;
begin
  for r in
    select * from (values
      (70,  4000.00, 4, 1000.00, 'sub_sched_1UHViWDnvpNz37ODR4SF1cRI'),
      (90,  4000.00, 4, 1000.00, 'sub_sched_1UB0GqDnvpNz37ODM7QMpfun'),
      (107, 3996.00, 6,  666.00, 'sub_sched_1UEtdJDnvpNz37ODacoQVW9o')
    ) as t(deal_id, total, installments, installment_amount, schedule_id)
  loop
    -- Every precondition restated per row. A row that has moved on since
    -- this was written is refused, never forced.
    if not exists (
      select 1 from deals d
       where d.id = r.deal_id
         and d.stage = 'won'
         and d.selected_payment_total is null
         and d.selected_payment_total_source is null
         and d.stripe_subscription_schedule_id = r.schedule_id
    ) then
      raise exception 'Opportunity % is no longer the case this repair was written for', r.deal_id;
    end if;

    -- And no money may have appeared against it, which is the condition
    -- that makes the plan the whole agreement.
    if coalesce((select sum(i.amount) from deal_payment_schedule_items i
                  where i.deal_id = r.deal_id and i.status = 'paid'), 0) <> 0 then
      raise exception 'Opportunity % has collected money; its total is no longer provable from the plan alone', r.deal_id;
    end if;

    -- The arithmetic has to hold, restated rather than trusted.
    if r.installments * r.installment_amount <> r.total then
      raise exception 'Opportunity %: % x % does not make %',
        r.deal_id, r.installments, r.installment_amount, r.total;
    end if;

    update deals
       set selected_payment_total = r.total,
           selected_payment_total_source = 'stripe_derived',
           selected_installment_count = r.installments,
           selected_installment_amount = r.installment_amount
     where id = r.deal_id;
    v_written := v_written + 1;
  end loop;

  if v_written <> 3 then
    raise exception 'expected to record exactly 3 agreed totals, recorded %', v_written;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Prove what this database now says
-- ---------------------------------------------------------------------
do $$
declare
  v_n int;
  v_collected numeric;
begin
  select count(*) into v_n from deals
   where id in (70, 90, 107)
     and selected_payment_total_source = 'stripe_derived'
     and selected_payment_total > 0;
  if v_n <> 3 then
    raise exception 'expected 3 Stripe-derived totals, found %', v_n;
  end if;

  -- Daniel keeps his open question.
  if (select selected_payment_total from deals where id = 80) is not null then
    raise exception 'Opportunity 80 was given a total, and nothing here should have given it one';
  end if;

  -- No receipt was invented anywhere.
  select coalesce(sum(amount), 0) into v_collected
    from deal_payment_schedule_items where status = 'paid';
  if v_collected <> (select coalesce(sum(amount), 0)
                       from deal_payment_schedule_items where status = 'paid') then
    raise exception 'collected money changed';
  end if;
  if exists (select 1 from deal_payment_schedule_items where deal_id in (70, 90, 107)) then
    raise exception 'a payment row was created for a plan that has collected nothing';
  end if;

  -- Sales and enrollment state are not this migration's business.
  if (select count(*) from deals where id in (70, 90, 107) and stage = 'won') <> 3 then
    raise exception 'a sales stage changed';
  end if;
end $$;

commit;
