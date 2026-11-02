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
alter table public.company_sectors enable row level security;
alter table public.import_batches enable row level security;
alter table public.brochures enable row level security;
alter table public.user_invitations enable row level security;

-- Role model: admin / manager see everything; a bde sees the leads assigned
-- to them or created by them, and what hangs off those leads. Disabled users
-- get no role (crm_role() is null) and therefore no rows at all.

-- Companies
create policy "Enable read access for authenticated users" on public.companies for select to authenticated using (public.can_see_company(id));
create policy "Enable insert for authenticated users only" on public.companies for insert to authenticated with check (public.crm_role() is not null);
create policy "Enable update for authenticated users only" on public.companies for update to authenticated using (public.can_see_company(id)) with check (public.crm_role() is not null);
create policy "Company Delete Policy" on public.companies for delete to authenticated using (public.is_manager() or sales_id = public.current_sales_id());

-- Contacts (leads)
create policy "Enable read access for authenticated users" on public.contacts for select to authenticated using (public.is_manager() or assigned_to = public.current_sales_id() or sales_id = public.current_sales_id());
create policy "Enable insert for authenticated users only" on public.contacts for insert to authenticated with check (public.is_manager() or (public.crm_role() is not null and assigned_to is null));
create policy "Enable update for authenticated users only" on public.contacts for update to authenticated using (public.is_manager() or assigned_to = public.current_sales_id() or sales_id = public.current_sales_id()) with check (public.is_manager() or assigned_to = public.current_sales_id() or sales_id = public.current_sales_id());
create policy "Contact Delete Policy" on public.contacts for delete to authenticated using (public.is_manager() or sales_id = public.current_sales_id());

-- Contact Notes (visible when their contact is visible)
create policy "Enable read access for authenticated users" on public.contact_notes for select to authenticated using (exists (select 1 from public.contacts c where c.id = contact_id));
create policy "Enable insert for authenticated users only" on public.contact_notes for insert to authenticated with check (exists (select 1 from public.contacts c where c.id = contact_id));
create policy "Contact Notes Update policy" on public.contact_notes for update to authenticated using (exists (select 1 from public.contacts c where c.id = contact_id));
create policy "Contact Notes Delete Policy" on public.contact_notes for delete to authenticated using (public.is_manager() or sales_id = public.current_sales_id());

-- Deals
create policy "Enable read access for authenticated users" on public.deals for select to authenticated using (public.is_manager() or sales_id = public.current_sales_id());
create policy "Enable insert for authenticated users only" on public.deals for insert to authenticated with check (public.crm_role() is not null);
create policy "Enable update for authenticated users only" on public.deals for update to authenticated using (public.is_manager() or sales_id = public.current_sales_id()) with check (public.crm_role() is not null);
create policy "Deals Delete Policy" on public.deals for delete to authenticated using (public.is_manager() or sales_id = public.current_sales_id());

-- Deal Notes (visible when their deal is visible)
create policy "Enable read access for authenticated users" on public.deal_notes for select to authenticated using (exists (select 1 from public.deals d where d.id = deal_id));
create policy "Enable insert for authenticated users only" on public.deal_notes for insert to authenticated with check (exists (select 1 from public.deals d where d.id = deal_id));
create policy "Deal Notes Update Policy" on public.deal_notes for update to authenticated using (exists (select 1 from public.deals d where d.id = deal_id));
create policy "Deal Notes Delete Policy" on public.deal_notes for delete to authenticated using (public.is_manager() or sales_id = public.current_sales_id());

-- Sales (team directory, read-only from the client)
create policy "Enable read access for authenticated users" on public.sales for select to authenticated using (public.crm_role() is not null or user_id = auth.uid());

-- Tags
create policy "Enable read access for authenticated users" on public.tags for select to authenticated using (public.crm_role() is not null);
create policy "Enable insert for authenticated users only" on public.tags for insert to authenticated with check (public.crm_role() is not null);
create policy "Enable update for authenticated users only" on public.tags for update to authenticated using (public.crm_role() is not null);
create policy "Enable delete for authenticated users only" on public.tags for delete to authenticated using (public.is_manager());

-- Tasks (visible when their contact is visible)
create policy "Enable read access for authenticated users" on public.tasks for select to authenticated using (exists (select 1 from public.contacts c where c.id = contact_id));
create policy "Enable insert for authenticated users only" on public.tasks for insert to authenticated with check (exists (select 1 from public.contacts c where c.id = contact_id));
create policy "Task Update Policy" on public.tasks for update to authenticated using (exists (select 1 from public.contacts c where c.id = contact_id));
create policy "Task Delete Policy" on public.tasks for delete to authenticated using (exists (select 1 from public.contacts c where c.id = contact_id));

-- Import batches (lead import history, admins and managers)
create policy "Enable read for managers" on public.import_batches for select to authenticated using (public.is_manager());

-- Brochures are written by the other app (service role bypasses RLS).
-- Signed-in users can read them. Only a manager or admin can set the status.
create policy "Enable read access for authenticated users" on public.brochures for select to authenticated using (public.crm_role() is not null);
create policy "Enable update for managers" on public.brochures for update to authenticated using (public.is_manager()) with check (public.is_manager());

-- Company Sectors
create policy "Enable read access for authenticated users" on public.company_sectors for select to authenticated using (public.crm_role() is not null);
create policy "Enable insert for authenticated users only" on public.company_sectors for insert to authenticated with check (public.is_manager());

-- Configuration (admin-only for writes)
create policy "Enable read for authenticated" on public.configuration for select to authenticated using (true);
create policy "Enable insert for admins" on public.configuration for insert to authenticated with check (public.is_admin());
create policy "Enable update for admins" on public.configuration for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Favicons excluded domains
create policy "Enable access for authenticated users only" on public.favicons_excluded_domains to authenticated using (true) with check (true);
