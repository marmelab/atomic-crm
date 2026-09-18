-- Owner-verified payment truth for the five clients whose money the CRM
-- could not represent, now that it can represent it.
--
-- Nothing here is inferred. Each fact below was stated by Leif and then
-- matched against live Stripe evidence, and the two agree.

begin;

do $$
declare
  v_mia_contact bigint;
  v_mia_deal bigint;
  v_emily_deal bigint;
  v_jess_deal bigint;
  v_linda_deal bigint;
  v_linda_owner_row bigint;
  v_voided int;
begin
  select c.id, d.id into v_mia_contact, v_mia_deal
  from public.contacts c
  join public.deals d on d.contact_id = c.id and d.archived_at is null
  where c.first_name = 'Mia' and c.last_name = 'Cosme';

  select d.id into v_emily_deal from public.deals d join public.contacts c on c.id = d.contact_id
    where c.first_name = 'Emily' and c.last_name = 'Loeb' and d.archived_at is null;
  select d.id into v_jess_deal from public.deals d join public.contacts c on c.id = d.contact_id
    where c.first_name = 'Jess' and c.last_name = 'Beauchamp' and d.archived_at is null;
  select d.id into v_linda_deal from public.deals d join public.contacts c on c.id = d.contact_id
    where c.first_name = 'Linda' and c.last_name = 'Turner' and d.archived_at is null;

  if v_mia_deal is null or v_emily_deal is null or v_jess_deal is null or v_linda_deal is null then
    raise exception 'expected one live Opportunity each for Mia Cosme, Emily Loeb, Jess Beauchamp and Linda Turner';
  end if;

  -- -------------------------------------------------------------------
  -- MIA COSME — legal name Maria Cosme, one human, five Stripe Customers
  -- -------------------------------------------------------------------
  -- Every one of these carries the same email and the same person's name
  -- in one of its two forms, and Leif has confirmed the identity. Four of
  -- them hold one $925 payment each; the fifth holds only a SetupIntent
  -- and is kept so that no future sweep treats it as a stranger.
  insert into public.contact_stripe_customers
    (contact_id, stripe_customer_id, is_primary, verified_by, note)
  values
    (v_mia_contact, 'cus_UyuGYhRFibbZdr', true,  'owner_confirmed', 'Owner-confirmed: Mia Cosme / legal name Maria Cosme. Holds the 2026-07-30 payment.'),
    (v_mia_contact, 'cus_Uwi1wkTdzRGDrT', false, 'owner_confirmed', 'Owner-confirmed: same human. Holds the 2026-07-24 payment.'),
    (v_mia_contact, 'cus_UuFc9VyO0OnCsJ', false, 'owner_confirmed', 'Owner-confirmed: same human. Holds the 2026-07-18 payment.'),
    (v_mia_contact, 'cus_UtNLYF5AuoynNQ', false, 'owner_confirmed', 'Owner-confirmed: same human. Holds the 2026-07-15 payment.'),
    (v_mia_contact, 'cus_Ut0rVfqiipYNyb', false, 'owner_confirmed', 'Owner-confirmed: same human. SetupIntents only, no payment.')
  on conflict (stripe_customer_id) do update set
    contact_id = excluded.contact_id,
    verified_by = excluded.verified_by,
    note = excluded.note,
    updated_at = now();

  -- Historical LE price, and the structure she actually paid it in.
  update public.deals set
    selected_payment_total = 3700.00,
    selected_installment_count = 4,
    selected_installment_amount = 925.00,
    -- The question this raised is answered: the customer objects are hers.
    payment_review_reason = null
  where id = v_mia_deal;

  -- Her legal name belongs with the human memory cues, not in place of the
  -- name Leif actually calls her.
  update public.contacts set
    identifiers = case
      when identifiers is null or btrim(identifiers) = '' then 'legal name Maria Cosme'
      when identifiers like '%Maria Cosme%' then identifiers
      else identifiers || ' · legal name Maria Cosme'
    end
  where id = v_mia_contact;

  -- -------------------------------------------------------------------
  -- EMILY LOEB — historical LE price, settled in one payment
  -- -------------------------------------------------------------------
  update public.deals set
    selected_payment_total = 3700.00,
    selected_installment_count = 1,
    selected_installment_amount = 3700.00
  where id = v_emily_deal;

  -- -------------------------------------------------------------------
  -- JESS BEAUCHAMP — four installments satisfied by three transactions
  -- -------------------------------------------------------------------
  -- The $2,000 payment covered two installments. Transactions and
  -- installments are different counts and the UI derives the second from
  -- the money, so only the agreed structure is recorded here.
  update public.deals set
    selected_payment_total = 4000.00,
    selected_installment_count = 4,
    selected_installment_amount = 1000.00
  where id = v_jess_deal;

  -- -------------------------------------------------------------------
  -- LINDA TURNER — one $4,000 payment, two pieces of evidence
  -- -------------------------------------------------------------------
  -- Her owner-stated paid-in-full row and the Stripe PaymentIntent are the
  -- same economic payment. The owner-stated row is voided rather than
  -- deleted: the note keeps the provenance that Leif confirmed this before
  -- Stripe could be read, while the money is counted once.
  select i.id into v_linda_owner_row
  from public.deal_payment_schedule_items i
  where i.deal_id = v_linda_deal and i.status = 'paid' and i.source = 'owner_stated'
  order by i.sequence
  limit 1;

  if v_linda_owner_row is not null then
    update public.deal_payment_schedule_items set
      status = 'void',
      paid_on = null,
      notes = 'Superseded by the Stripe payment for the same $4,000. Owner confirmed paid in full before Stripe reconciliation could see it; kept as provenance, not counted again.'
    where id = v_linda_owner_row;
  end if;

  update public.deals set
    selected_payment_total = 4000.00,
    selected_installment_count = 1,
    selected_installment_amount = 4000.00,
    payment_review_reason = null
  where id = v_linda_deal;

  select count(*) into v_voided
  from public.deal_payment_schedule_items
  where deal_id = v_linda_deal and status = 'paid';

  if v_voided <> 1 then
    raise exception 'Linda Turner should have exactly one counted payment, found %', v_voided;
  end if;
end $$;

commit;
