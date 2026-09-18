-- Live data brought into the canonical semantics.
--
-- Three things, none of which changes how much money anybody has paid:
--
--   1. Five more agreed totals derived from Stripe, so nothing falls back
--      to the Offer's current list price.
--   2. Linda Turner's and Lara Spagnola's duplicated payments collapsed
--      into ONE row each, carrying both provenances instead of a voided
--      row beside a live one.
--   3. Review reasons given a machine-readable code, and the onboarding
--      facts Leif has confirmed recorded as such.
--
-- Every collected total is asserted unchanged at the end.

begin;

-- ---------------------------------------------------------------------
-- 0. Provenance for a checklist item somebody confirmed rather than did
-- ---------------------------------------------------------------------
alter table public.enrollment_onboarding_items
  add column if not exists completion_source text;

alter table public.enrollment_onboarding_items
  drop constraint if exists enrollment_onboarding_items_completion_source_check;
alter table public.enrollment_onboarding_items
  add constraint enrollment_onboarding_items_completion_source_check check (
    completion_source is null
    or completion_source in ('app', 'owner_confirmed', 'historical_confirmed')
  );

comment on column public.enrollment_onboarding_items.completion_source is
  'How this item came to be done. historical_confirmed means Leif confirmed it for a client who predates the checklist — completed_at stays null rather than inventing a date.';

-- ---------------------------------------------------------------------
-- 1. Agreed totals derived from Stripe
-- ---------------------------------------------------------------------
-- subscription unit_amount x months in the schedule phase window, written
-- only where the result reconciles exactly against money collected.
do $$
declare
  r record;
  v_paid numeric;
  v_updated int;
begin
  for r in
    select * from (values
      ('Han',     'Terzek',          1400.00, 4, 350.00, '$350/month, 2026-09-01 to 2027-01-01'),
      ('Jennifer','Smith',           1400.00, 2, 700.00, '$700/month, 2026-09-01 to 2026-11-01'),
      ('Lauren',  'Gaw',             1400.00, 2, 700.00, '$700/month, 2026-09-01 to 2026-11-01'),
      ('Maureen', 'Vivas O''Keefe',  1400.00, 2, 700.00, '$700/month, 2026-09-01 to 2026-11-01'),
      ('Yossi',   'Frankl',          1400.00, 2, 700.00, '$700/month, 2026-09-01 to 2026-11-01')
    ) as t(first_name, last_name, total, installments, each, evidence)
  loop
    select coalesce(sum(i.amount), 0) into v_paid
    from public.deal_payment_schedule_items i
    join public.deals d on d.id = i.deal_id
    join public.contacts c on c.id = d.contact_id
    where c.first_name = r.first_name and c.last_name = r.last_name
      and d.archived_at is null and i.status = 'paid';

    if v_paid > r.total + 0.01 then
      raise exception '% % collected % against a derived total of %',
        r.first_name, r.last_name, v_paid, r.total;
    end if;
    if mod((v_paid * 100)::bigint, (r.each * 100)::bigint) <> 0 then
      raise exception '% % collected %, not a whole number of % installments',
        r.first_name, r.last_name, v_paid, r.each;
    end if;

    update public.deals d
    set selected_payment_total = r.total,
        selected_installment_count = r.installments,
        selected_installment_amount = r.each,
        selected_payment_total_source = 'stripe_derived'
    from public.contacts c
    where c.id = d.contact_id
      and c.first_name = r.first_name and c.last_name = r.last_name
      and d.archived_at is null and d.selected_payment_total is null;

    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception 'expected one Opportunity for % %, updated %',
        r.first_name, r.last_name, v_updated;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. One economic payment, one row
-- ---------------------------------------------------------------------
-- The voided owner row and the Stripe row describe the same money. The
-- owner row becomes the payment — it is the older fact, and the one that
-- records Leif knew before Stripe could be read — and takes the
-- PaymentIntent with it. The Stripe row is then removed, not voided:
-- keeping it would be keeping a second copy of one payment.
do $$
declare
  r record;
  v_before numeric;
  v_after numeric;
begin
  for r in
    select d.id as deal_id,
           owner_row.id as owner_id,
           stripe_row.id as stripe_id,
           stripe_row.stripe_payment_intent_id as pi,
           stripe_row.paid_on as paid_on,
           owner_row.amount as amount
    from public.deals d
    join public.contacts c on c.id = d.contact_id
    join public.deal_payment_schedule_items owner_row
      on owner_row.deal_id = d.id and owner_row.status = 'void'
     and owner_row.source = 'owner_stated'
    join public.deal_payment_schedule_items stripe_row
      on stripe_row.deal_id = d.id and stripe_row.status = 'paid'
     and stripe_row.source = 'stripe'
     and stripe_row.amount = owner_row.amount
    where d.archived_at is null
  loop
    select coalesce(sum(i.amount), 0) into v_before
    from public.deal_payment_schedule_items i
    where i.deal_id = r.deal_id and i.status = 'paid';

    -- The PaymentIntent is unique across the whole ledger, which is what
    -- makes one payment countable once. So the duplicate row releases it
    -- before the surviving row takes it.
    delete from public.deal_payment_schedule_items where id = r.stripe_id;

    update public.deal_payment_schedule_items set
      status = 'paid',
      paid_on = r.paid_on,
      stripe_payment_intent_id = r.pi,
      verified_by_stripe_at = now(),
      notes = 'Recorded by Leif, later confirmed by Stripe as the same payment. One payment, both provenances.'
    where id = r.owner_id;

    select coalesce(sum(i.amount), 0) into v_after
    from public.deal_payment_schedule_items i
    where i.deal_id = r.deal_id and i.status = 'paid';

    if v_before <> v_after then
      raise exception 'deal % collected total changed from % to %',
        r.deal_id, v_before, v_after;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. Review codes, so the UI can render the question against live figures
-- ---------------------------------------------------------------------
update public.deals
set payment_review_code = 'collected_exceeds_agreed'
where payment_review_reason is not null
  and payment_review_code is null
  and payment_review_reason like '%is recorded against an agreed total%'
   or (payment_review_reason like '%collected%against an agreed total%'
       and payment_review_code is null);

update public.deals
set payment_review_code = 'terms_unknown'
where payment_review_reason is not null
  and payment_review_code is null
  and payment_review_reason like '%no agreed total is recorded%';

-- Anything else a human raised keeps its own words.
update public.deals
set payment_review_code = 'owner_flagged'
where payment_review_reason is not null and payment_review_code is null;

-- ---------------------------------------------------------------------
-- 4. Onboarding facts Leif has confirmed
-- ---------------------------------------------------------------------
-- Only for the clients whose access/contract Leif has explicitly
-- confirmed complete. completed_at stays NULL: nobody knows the date, and
-- inventing one would be worse than admitting that.
--
-- Everyone else keeps no rows at all, which means NOT TRACKED — never
-- "nothing done". Seeding pending items for clients Leif has said nothing
-- about would drag finished people back onto the board.
insert into public.enrollment_onboarding_items
  (enrollment_id, requirement_key, label, task_text_template, is_required,
   sort_order, status, completed_at, completion_source)
select e.id, t.key, t.label, t.task_text_template, t.is_required,
       t.sort_order, 'done', null, 'historical_confirmed'
from public.enrollments e
join public.deals d on d.id = e.opportunity_id
join public.contacts c on c.id = d.contact_id
join public.onboarding_requirement_templates t
  on t.offer_id = d.offer_id and t.is_active
where (c.first_name, c.last_name) in (
    ('Denise', 'Cormier'), ('Ava', 'Frotton'),
    ('Linda', 'Turner'), ('Emma', 'Wijns')
  )
  and not exists (
    select 1 from public.enrollment_onboarding_items existing
    where existing.enrollment_id = e.id and existing.requirement_key = t.key
  );

-- ---------------------------------------------------------------------
-- 5. Prove nothing moved that should not have
-- ---------------------------------------------------------------------
do $$
declare
  v_linda numeric;
  v_lara numeric;
  v_dupes int;
  v_confirmed int;
begin
  select coalesce(sum(i.amount), 0) into v_linda
  from public.deal_payment_schedule_items i where i.deal_id = 74 and i.status = 'paid';
  select coalesce(sum(i.amount), 0) into v_lara
  from public.deal_payment_schedule_items i where i.deal_id = 149 and i.status = 'paid';

  if v_linda <> 4000.00 then raise exception 'Linda collected %, expected 4000', v_linda; end if;
  if v_lara <> 400.00 then raise exception 'Lara collected %, expected 400', v_lara; end if;

  select count(*) into v_dupes
  from public.deal_payment_schedule_items
  where status = 'void' and source = 'owner_stated';
  if v_dupes <> 0 then raise exception '% voided duplicate rows remain', v_dupes; end if;

  select count(*) into v_confirmed
  from public.enrollment_onboarding_items where completion_source = 'historical_confirmed';
  if v_confirmed = 0 then raise exception 'no owner-confirmed onboarding items were recorded'; end if;
end $$;

commit;
