-- Grants and row-level security for the two new Stripe relations.
--
-- Creating a table gives service_role only REFERENCES/TRIGGER/TRUNCATE by
-- default, so the reconciliation sweep read an empty identity list and
-- scanned nobody at all. Both tables now follow the same posture as
-- deal_payment_schedule_items: RLS on, authenticated users work through
-- policies, and no privilege is granted that the app does not use.
--
-- Deletion is deliberately NOT granted to authenticated. These rows are
-- financial provenance: unlinking a Stripe Customer or forgetting which
-- subscription collected four payments is not an ordinary edit, and
-- nothing in the UI does it.

begin;

grant select, insert, update on public.contact_stripe_customers to authenticated;
grant select, insert, update on public.contact_stripe_customers to service_role;
grant usage, select on sequence public.contact_stripe_customers_id_seq to authenticated, service_role;

grant select, insert, update on public.deal_stripe_plan_objects to authenticated;
grant select, insert, update on public.deal_stripe_plan_objects to service_role;
grant usage, select on sequence public.deal_stripe_plan_objects_id_seq to authenticated, service_role;

alter table public.contact_stripe_customers enable row level security;
alter table public.deal_stripe_plan_objects enable row level security;

create policy "Enable read access for authenticated users"
  on public.contact_stripe_customers for select to authenticated using (true);
create policy "Enable insert for authenticated users only"
  on public.contact_stripe_customers for insert to authenticated with check (true);
create policy "Enable update for authenticated users only"
  on public.contact_stripe_customers for update to authenticated using (true) with check (true);

create policy "Enable read access for authenticated users"
  on public.deal_stripe_plan_objects for select to authenticated using (true);
create policy "Enable insert for authenticated users only"
  on public.deal_stripe_plan_objects for insert to authenticated with check (true);
create policy "Enable update for authenticated users only"
  on public.deal_stripe_plan_objects for update to authenticated using (true) with check (true);

commit;
