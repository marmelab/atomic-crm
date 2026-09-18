-- Restore the payment review the first reconciliation sweep erased.
--
-- The sweep cleared any review it could not currently see a problem with.
-- For Mia Cosme that was exactly wrong: her linked Stripe Customer holds
-- one $925 payment against a $4,000 offer, which is indistinguishable from
-- an ordinary part-paid plan — and is not one. Her other three $925
-- payments sit on Customer objects the CRM is not linked to, where the
-- sweep cannot see them.
--
-- The reconciler no longer lifts a review; only a human does. This puts
-- back the one it took away.

begin;

do $$
declare
  v_mia bigint;
begin
  select d.id into v_mia
  from public.deals d
  join public.contacts c on c.id = d.contact_id
  where c.first_name = 'Mia' and c.last_name = 'Cosme' and d.archived_at is null;

  if v_mia is null then
    raise exception 'expected one live Opportunity for Mia Cosme';
  end if;

  update public.deals set
    payment_review_reason =
      'Stripe holds four successful $925 payments (2026-07-15, 07-18, 07-24, 07-30) across four different Customer objects, plus a fifth with only a SetupIntent. The linked customer cus_UyuGYhRFibbZdr holds one of them. Confirm which Customer objects are Mia''s before recording payment.'
  where id = v_mia;
end $$;

commit;
