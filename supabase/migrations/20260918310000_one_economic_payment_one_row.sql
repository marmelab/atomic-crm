-- The schema behind one canonical payment truth.
--
-- Four changes, each removing a way the CRM could hold two answers to one
-- question.
--
--   1. A payment Leif recorded and Stripe later evidenced is ONE payment
--      with two provenances, not two rows. The old CHECK made that
--      impossible: it required a PaymentIntent for a Stripe row and
--      FORBADE one on any other, so an owner-stated payment could never be
--      upgraded in place. Linda Turner and Lara Spagnola were each recorded
--      twice and repaired by voiding a row, which is provenance kept by
--      convention rather than by structure.
--
--   2. A scheduled obligation that Stripe has since collected is no longer
--      future money, but nothing recorded that. Lara's $1,000 due
--      2027-01-01 would have stayed "scheduled" forever after the charge,
--      beside a new paid row.
--
--   3. Payment setup can be real without Stripe. That has to be an
--      explicit statement, never inferred from a scheduled row.
--
--   4. A review needs a machine-readable reason. The stored text embeds
--      amounts that go stale: four live reviews still quote "an agreed
--      total of 4000.00" that has since been superseded.

begin;

-- ---------------------------------------------------------------------
-- 1. One economic payment, one row, both provenances
-- ---------------------------------------------------------------------
alter table public.deal_payment_schedule_items
  drop constraint if exists deal_payment_schedule_items_stripe_provenance_check;

-- A Stripe-sourced row still MUST carry the PaymentIntent that produced
-- it. What is now allowed is the other direction: a row whose original
-- provenance is Leif or a historical import may ALSO carry the
-- PaymentIntent, once Stripe is found to be describing the same money.
-- `source` keeps saying how the CRM first learned of the payment.
alter table public.deal_payment_schedule_items
  add constraint deal_payment_schedule_items_stripe_provenance_check check (
    source <> 'stripe' or stripe_payment_intent_id is not null
  );

alter table public.deal_payment_schedule_items
  add column if not exists verified_by_stripe_at timestamptz;

comment on column public.deal_payment_schedule_items.verified_by_stripe_at is
  'When Stripe evidence was attached to a payment the CRM already knew about. Non-null with source <> ''stripe'' means one economic payment carrying both provenances.';

-- ---------------------------------------------------------------------
-- 2. A scheduled obligation that has been collected
-- ---------------------------------------------------------------------
alter table public.deal_payment_schedule_items
  add column if not exists satisfied_by_payment_intent_id text;

comment on column public.deal_payment_schedule_items.satisfied_by_payment_intent_id is
  'The PaymentIntent that discharged this scheduled obligation. Deliberately NOT unique: one payment may satisfy several obligations. A satisfied obligation stops counting as future money; the receipt itself is still recorded exactly once on its own paid row.';

-- Only a future obligation can be satisfied, and only by real money.
alter table public.deal_payment_schedule_items
  drop constraint if exists deal_payment_schedule_items_satisfied_check;
alter table public.deal_payment_schedule_items
  add constraint deal_payment_schedule_items_satisfied_check check (
    satisfied_by_payment_intent_id is null or status = 'scheduled'
  );

create index if not exists deal_payment_schedule_items_satisfied_idx
  on public.deal_payment_schedule_items (satisfied_by_payment_intent_id)
  where satisfied_by_payment_intent_id is not null;

-- ---------------------------------------------------------------------
-- 3. Payment setup confirmed outside Stripe
-- ---------------------------------------------------------------------
alter table public.deals
  add column if not exists payment_setup_confirmed_at timestamptz;
alter table public.deals
  add column if not exists payment_setup_source text;

alter table public.deals
  drop constraint if exists deals_payment_setup_source_check;
alter table public.deals
  add constraint deals_payment_setup_source_check check (
    payment_setup_source is null
    or payment_setup_source in ('owner_confirmed', 'external_processor')
  );

alter table public.deals
  drop constraint if exists deals_payment_setup_pair_check;
alter table public.deals
  add constraint deals_payment_setup_pair_check check (
    (payment_setup_confirmed_at is null) = (payment_setup_source is null)
  );

comment on column public.deals.payment_setup_confirmed_at is
  'An explicit statement that a valid payment arrangement exists outside Stripe. Never inferred — a scheduled ledger row is terms, not an arrangement.';

-- ---------------------------------------------------------------------
-- 4. A review reason a machine can read
-- ---------------------------------------------------------------------
alter table public.deals
  add column if not exists payment_review_code text;

alter table public.deals
  drop constraint if exists deals_payment_review_code_check;
alter table public.deals
  add constraint deals_payment_review_code_check check (
    payment_review_code is null
    or payment_review_code in (
      'terms_unknown',
      'evidence_incomplete',
      'collected_exceeds_agreed',
      'duplicate_economic_payment',
      'identity_unresolved',
      'owner_flagged'
    )
  );

comment on column public.deals.payment_review_code is
  'Why this needs a human, as a code the UI renders against CURRENT figures. payment_review_reason stays as the human note; the code is what the app reasons about.';

commit;
