--
-- Row Level Security
-- This file declares RLS policies for all tables.
--

-- Enable RLS on all tables
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_notes enable row level security;
alter table public.deals enable row level security;
alter table public.deal_notes enable row level security;
alter table public.sales enable row level security;
alter table public.tags enable row level security;
alter table public.tasks enable row level security;
alter table public.configuration enable row level security;
alter table public.favicons_excluded_domains enable row level security;
alter table public.offers enable row level security;
alter table public.offer_payment_options enable row level security;
alter table public.cohorts enable row level security;
alter table public.applications enable row level security;
alter table public.enrollments enable row level security;

-- Companies
create policy "Enable read access for authenticated users" on public.companies for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.companies for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.companies for update to authenticated using (true) with check (true);
create policy "Company Delete Policy" on public.companies for delete to authenticated using (true);

-- Contacts
create policy "Enable read access for authenticated users" on public.contacts for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.contacts for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.contacts for update to authenticated using (true) with check (true);
create policy "Contact Delete Policy" on public.contacts for delete to authenticated using (true);

-- Contact Notes
create policy "Enable read access for authenticated users" on public.contact_notes for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.contact_notes for insert to authenticated with check (true);
create policy "Contact Notes Update policy" on public.contact_notes for update to authenticated using (true);
create policy "Contact Notes Delete Policy" on public.contact_notes for delete to authenticated using (true);

-- Deals
create policy "Enable read access for authenticated users" on public.deals for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.deals for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.deals for update to authenticated using (true) with check (true);
create policy "Deals Delete Policy" on public.deals for delete to authenticated using (true);

-- Deal Notes
create policy "Enable read access for authenticated users" on public.deal_notes for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.deal_notes for insert to authenticated with check (true);
create policy "Deal Notes Update Policy" on public.deal_notes for update to authenticated using (true);
create policy "Deal Notes Delete Policy" on public.deal_notes for delete to authenticated using (true);

-- Sales
create policy "Enable read access for authenticated users" on public.sales for select to authenticated using (true);

-- Tags
create policy "Enable read access for authenticated users" on public.tags for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.tags for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.tags for update to authenticated using (true);
create policy "Enable delete for authenticated users only" on public.tags for delete to authenticated using (true);

-- Tasks
create policy "Enable read access for authenticated users" on public.tasks for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.tasks for insert to authenticated with check (true);
create policy "Task Update Policy" on public.tasks for update to authenticated using (true);
create policy "Task Delete Policy" on public.tasks for delete to authenticated using (true);

-- Configuration (admin-only for writes)
create policy "Enable read for authenticated" on public.configuration for select to authenticated using (true);
create policy "Enable insert for admins" on public.configuration for insert to authenticated with check (public.is_admin());
create policy "Enable update for admins" on public.configuration for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Favicons excluded domains
create policy "Enable access for authenticated users only" on public.favicons_excluded_domains to authenticated using (true) with check (true);

-- Offers
create policy "Enable read access for authenticated users" on public.offers for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.offers for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.offers for update to authenticated using (true) with check (true);
create policy "Offers Delete Policy" on public.offers for delete to authenticated using (true);

-- Offer Payment Options
create policy "Enable read access for authenticated users" on public.offer_payment_options for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.offer_payment_options for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.offer_payment_options for update to authenticated using (true) with check (true);
create policy "Offer Payment Options Delete Policy" on public.offer_payment_options for delete to authenticated using (true);

-- Cohorts
create policy "Enable read access for authenticated users" on public.cohorts for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.cohorts for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.cohorts for update to authenticated using (true) with check (true);
create policy "Cohorts Delete Policy" on public.cohorts for delete to authenticated using (true);

-- Applications
create policy "Enable read access for authenticated users" on public.applications for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.applications for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.applications for update to authenticated using (true) with check (true);
create policy "Applications Delete Policy" on public.applications for delete to authenticated using (true);

-- Enrollments
create policy "Enable read access for authenticated users" on public.enrollments for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.enrollments for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.enrollments for update to authenticated using (true) with check (true);
create policy "Enrollments Delete Policy" on public.enrollments for delete to authenticated using (true);
