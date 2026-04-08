--
-- Row Level Security
-- This file declares RLS policies for all tables.
-- Phase 2: All policies use auth.uid() IS NOT NULL to block unauthenticated access.
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

-- Companies
create policy "authenticated_select_companies" on public.companies for select to authenticated using (auth.uid() is not null);
create policy "authenticated_insert_companies" on public.companies for insert to authenticated with check (auth.uid() is not null);
create policy "authenticated_update_companies" on public.companies for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated_delete_companies" on public.companies for delete to authenticated using (auth.uid() is not null);

-- Contacts
create policy "authenticated_select_contacts" on public.contacts for select to authenticated using (auth.uid() is not null);
create policy "authenticated_insert_contacts" on public.contacts for insert to authenticated with check (auth.uid() is not null);
create policy "authenticated_update_contacts" on public.contacts for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated_delete_contacts" on public.contacts for delete to authenticated using (auth.uid() is not null);

-- Contact Notes
create policy "authenticated_select_contact_notes" on public.contact_notes for select to authenticated using (auth.uid() is not null);
create policy "authenticated_insert_contact_notes" on public.contact_notes for insert to authenticated with check (auth.uid() is not null);
create policy "authenticated_update_contact_notes" on public.contact_notes for update to authenticated using (auth.uid() is not null);
create policy "authenticated_delete_contact_notes" on public.contact_notes for delete to authenticated using (auth.uid() is not null);

-- Deals
create policy "authenticated_select_deals" on public.deals for select to authenticated using (auth.uid() is not null);
create policy "authenticated_insert_deals" on public.deals for insert to authenticated with check (auth.uid() is not null);
create policy "authenticated_update_deals" on public.deals for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated_delete_deals" on public.deals for delete to authenticated using (auth.uid() is not null);

-- Deal Notes
create policy "authenticated_select_deal_notes" on public.deal_notes for select to authenticated using (auth.uid() is not null);
create policy "authenticated_insert_deal_notes" on public.deal_notes for insert to authenticated with check (auth.uid() is not null);
create policy "authenticated_update_deal_notes" on public.deal_notes for update to authenticated using (auth.uid() is not null);
create policy "authenticated_delete_deal_notes" on public.deal_notes for delete to authenticated using (auth.uid() is not null);

-- Sales (read-only for authenticated)
create policy "authenticated_select_sales" on public.sales for select to authenticated using (auth.uid() is not null);

-- Tags
create policy "authenticated_select_tags" on public.tags for select to authenticated using (auth.uid() is not null);
create policy "authenticated_insert_tags" on public.tags for insert to authenticated with check (auth.uid() is not null);
create policy "authenticated_update_tags" on public.tags for update to authenticated using (auth.uid() is not null);
create policy "authenticated_delete_tags" on public.tags for delete to authenticated using (auth.uid() is not null);

-- Tasks
create policy "authenticated_select_tasks" on public.tasks for select to authenticated using (auth.uid() is not null);
create policy "authenticated_insert_tasks" on public.tasks for insert to authenticated with check (auth.uid() is not null);
create policy "authenticated_update_tasks" on public.tasks for update to authenticated using (auth.uid() is not null);
create policy "authenticated_delete_tasks" on public.tasks for delete to authenticated using (auth.uid() is not null);

-- Configuration (read = authenticated, write = admin only)
create policy "authenticated_select_configuration" on public.configuration for select to authenticated using (auth.uid() is not null);
create policy "Enable insert for admins" on public.configuration for insert to authenticated with check (public.is_admin());
create policy "Enable update for admins" on public.configuration for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Favicons excluded domains
create policy "authenticated_all_favicons_excluded_domains" on public.favicons_excluded_domains for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);

-- Trade Types (read = authenticated, write = admin)
alter table public.trade_types enable row level security;
create policy "authenticated_select_trade_types" on public.trade_types for select to authenticated using (auth.uid() is not null);
create policy "admin_write_trade_types" on public.trade_types for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Lead Sources (read = authenticated, write = admin)
alter table public.lead_sources enable row level security;
create policy "authenticated_select_lead_sources" on public.lead_sources for select to authenticated using (auth.uid() is not null);
create policy "admin_write_lead_sources" on public.lead_sources for all to authenticated using (public.is_admin()) with check (public.is_admin());
