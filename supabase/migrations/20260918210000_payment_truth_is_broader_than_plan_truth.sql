-- Payment truth is broader than plan truth.
--
-- The CRM was reading "no active Stripe subscription" as "no payment", and
-- those are different facts. Four live clients proved it:
--
--   Emily Loeb      paid $3,700 in one go on 2026-07-16. A one-time payment
--                   creates no subscription at all, so she read as
--                   "Payment setup pending" while fully paid.
--
--   Jules Litman-   is 4 of 6 installments into a real plan. His schedule
--   Cleper          reads "completed" and his subscription "canceled" in
--                   Stripe, and both were filtered out as not-live, so four
--                   collected payments of $666 were invisible.
--
--   Jess Beauchamp  paid all four installments, then asked for her card to
--                   be removed. No card on file is not unpaid.
--
--   Mia Cosme       has $3,700 of successful payments spread across FIVE
--                   separate Stripe Customer objects, only one of which the
--                   CRM is linked to. That one holds a single $925 payment.
--
-- Two structural changes here, plus the commercial terms the owner stated.
-- No per-person logic: the terms below are data, and the generic resolver
-- computes state from terms plus real collected money.

begin;

-- deal_payment_schedule_items_stripe_pi_key and deals.payment_review_reason moved to 20260918155000_structure_owned_by_historical_repairs.sql.
-- This migration repairs historical production data and is not replayed
-- into an empty database, so it must not be the only thing that creates
-- structure the finished CRM needs. Its assertions below are unchanged.


-- 1. Ingesting a Stripe payment twice must be impossible. The reconciler
--    keys each row on the PaymentIntent that produced it, so a second sweep
--    over unchanged Stripe data writes nothing.


-- 2. Uncertainty gets its own state. Before this, anything the CRM could
--    not explain fell through to "Payment setup pending" — which reads as
--    "this person owes you a payment plan" and is a lie when the truth is
--    "we do not yet know". A non-null reason means a human must look.




-- 3. Owner-stated commercial terms. These are the amounts actually agreed,
--    which is not always the offer list price: Emily settled at $3,700 and
--    Jules at 6 x $666. Recording them lets the generic resolver reach
--    "paid in full" and "4 of 6 paid" deterministically from Stripe money,
--    instead of anybody hardcoding a name.
do $$
declare
  v_emily bigint;
  v_jess bigint;
  v_jules bigint;
  v_mia bigint;
begin
  select d.id into v_emily from public.deals d join public.contacts c on c.id = d.contact_id
    where c.first_name = 'Emily' and c.last_name = 'Loeb' and d.archived_at is null;
  select d.id into v_jess from public.deals d join public.contacts c on c.id = d.contact_id
    where c.first_name = 'Jess' and c.last_name = 'Beauchamp' and d.archived_at is null;
  select d.id into v_jules from public.deals d join public.contacts c on c.id = d.contact_id
    where c.first_name = 'Jules' and c.last_name = 'Litman-Cleper' and d.archived_at is null;
  select d.id into v_mia from public.deals d join public.contacts c on c.id = d.contact_id
    where c.first_name = 'Mia' and c.last_name = 'Cosme' and d.archived_at is null;

  if v_emily is null or v_jess is null or v_jules is null or v_mia is null then
    raise exception 'expected one live Opportunity each for Emily Loeb, Jess Beauchamp, Jules Litman-Cleper and Mia Cosme';
  end if;

  -- Paid in full, one payment, 2026-07-16.
  update public.deals set
    selected_payment_total = 3700.00,
    selected_installment_count = 1,
    selected_installment_amount = 3700.00
  where id = v_emily;

  -- Four installments of $1,000, all collected. The card was removed
  -- afterwards at her request, which says nothing about payment.
  update public.deals set
    selected_payment_total = 4000.00,
    selected_installment_count = 4,
    selected_installment_amount = 1000.00
  where id = v_jess;

  -- Six installments of $666; four collected, two remaining.
  update public.deals set
    selected_payment_total = 3996.00,
    selected_installment_count = 6,
    selected_installment_amount = 666.00
  where id = v_jules;

  -- Mia is NOT given terms. Her money is real but scattered across five
  -- Stripe Customer objects, and relinking financial identity on a matching
  -- email address is exactly the mistake that attaches the wrong person's
  -- money. A human decides which customers are hers.
  update public.deals set
    payment_review_reason =
      'Stripe holds four successful $925 payments (2026-07-15, 07-18, 07-24, 07-30) across four different Customer objects, plus a fifth with only a SetupIntent. The linked customer cus_UyuGYhRFibbZdr holds one of them. Confirm which Customer objects are Mia''s before recording payment.'
  where id = v_mia;
end $$;

commit;
