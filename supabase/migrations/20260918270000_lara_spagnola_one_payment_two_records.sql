-- Lara Spagnola's $400 was recorded twice, once by Leif and once by Stripe.
--
-- The same shape as Linda Turner's, and invisible for a different reason:
-- Linda's duplicate pushed her over her agreed total, while Lara's sat
-- inside a $1,400 agreement and looked like ordinary progress toward it.
-- The reconciler now recognises an owner-stated amount that exactly
-- matches a Stripe amount, whatever the total, so this shape is reported
-- rather than waited on.
--
-- Her remaining $1,000, due 2027-01-01, stays exactly as it is: a
-- 'scheduled' row is a statement of terms, not collected money, and it
-- does not enter any paid total. When Leif creates that arrangement in
-- Stripe, reconciliation will record the real payment when it is actually
-- collected.

begin;

do $$
declare
  v_deal bigint;
  v_owner_row bigint;
  v_paid numeric;
begin
  select d.id into v_deal
  from public.deals d
  join public.contacts c on c.id = d.contact_id
  where c.first_name = 'Lara' and c.last_name = 'Spagnola' and d.archived_at is null;

  if v_deal is null then
    raise exception 'expected one live Opportunity for Lara Spagnola';
  end if;

  -- The owner-stated record of the payment Stripe also holds. Voided, not
  -- deleted: the note keeps the provenance that Leif recorded it first.
  select i.id into v_owner_row
  from public.deal_payment_schedule_items i
  where i.deal_id = v_deal
    and i.status = 'paid'
    and i.source = 'owner_stated'
    and i.amount = 400.00
  order by i.sequence
  limit 1;

  if v_owner_row is not null then
    update public.deal_payment_schedule_items set
      status = 'void',
      paid_on = null,
      notes = 'Superseded by the Stripe payment of the same $400 on 2026-08-25. Owner recorded it before Stripe reconciliation could see it; kept as provenance, not counted again.'
    where id = v_owner_row;
  end if;

  select coalesce(sum(i.amount), 0) into v_paid
  from public.deal_payment_schedule_items i
  where i.deal_id = v_deal and i.status = 'paid';

  if v_paid <> 400.00 then
    raise exception 'Lara Spagnola should have exactly $400 collected, found %', v_paid;
  end if;
end $$;

commit;
