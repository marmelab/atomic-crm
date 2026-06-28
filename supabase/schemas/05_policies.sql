--
-- Row Level Security
-- This file declares RLS policies for all tables.
--

-- Enable RLS on all tables
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_notes enable row level security;
alter table public.outreach_events enable row level security;
alter table public.deals enable row level security;
alter table public.deal_notes enable row level security;
alter table public.sales enable row level security;
alter table public.tags enable row level security;
alter table public.tasks enable row level security;
alter table public.configuration enable row level security;
alter table public.favicons_excluded_domains enable row level security;
alter table public.daily_research_activities enable row level security;

-- Companies
create policy "Enable read access for authenticated users" on public.companies for select to authenticated using (public.current_user_role() in ('admin', 'sales_manager', 'viewer') or assigned_to_user_id = public.current_sale_id() or sales_id = public.current_sale_id());
create policy "Enable insert for authenticated users only" on public.companies for insert to authenticated with check (public.current_user_role() in ('admin', 'sales_manager') or (public.current_user_role() = 'lead_researcher' and coalesce(assigned_to_user_id, public.current_sale_id()) = public.current_sale_id() and approved_for_instantly = false));
create policy "Enable update for authenticated users only" on public.companies for update to authenticated using (public.current_user_role() in ('admin', 'sales_manager') or (public.current_user_role() = 'lead_researcher' and coalesce(assigned_to_user_id, sales_id) = public.current_sale_id())) with check (public.current_user_role() in ('admin', 'sales_manager') or (public.current_user_role() = 'lead_researcher' and coalesce(assigned_to_user_id, sales_id) = public.current_sale_id() and approved_for_instantly = false and research_status <> 'approved_for_instantly'));
create policy "Company Delete Policy" on public.companies for delete to authenticated using (public.current_user_role() in ('admin', 'sales_manager'));

-- Contacts
create policy "Enable read access for authenticated users" on public.contacts for select to authenticated using (public.current_user_role() in ('admin', 'sales_manager', 'viewer') or assigned_to_user_id = public.current_sale_id() or sales_id = public.current_sale_id() or exists (select 1 from public.companies c where c.id = contacts.company_id and c.assigned_to_user_id = public.current_sale_id()));
create policy "Enable insert for authenticated users only" on public.contacts for insert to authenticated with check (public.current_user_role() in ('admin', 'sales_manager') or (public.current_user_role() = 'lead_researcher' and coalesce(assigned_to_user_id, public.current_sale_id()) = public.current_sale_id() and approved_for_instantly = false));
create policy "Enable update for authenticated users only" on public.contacts for update to authenticated using (public.current_user_role() in ('admin', 'sales_manager') or (public.current_user_role() = 'lead_researcher' and coalesce(assigned_to_user_id, sales_id) = public.current_sale_id())) with check (public.current_user_role() in ('admin', 'sales_manager') or (public.current_user_role() = 'lead_researcher' and coalesce(assigned_to_user_id, sales_id) = public.current_sale_id() and approved_for_instantly = false and research_status <> 'approved_for_instantly'));
create policy "Contact Delete Policy" on public.contacts for delete to authenticated using (public.current_user_role() in ('admin', 'sales_manager'));

-- Contact Notes
create policy "Enable read access for authenticated users" on public.contact_notes for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.contact_notes for insert to authenticated with check (public.current_user_role() in ('admin', 'sales_manager') or (public.current_user_role() = 'lead_researcher' and exists (select 1 from public.contacts c where c.id = contact_notes.contact_id and coalesce(c.assigned_to_user_id, c.sales_id) = public.current_sale_id())));
create policy "Contact Notes Update policy" on public.contact_notes for update to authenticated using (public.current_user_role() in ('admin', 'sales_manager') or (public.current_user_role() = 'lead_researcher' and exists (select 1 from public.contacts c where c.id = contact_notes.contact_id and coalesce(c.assigned_to_user_id, c.sales_id) = public.current_sale_id())));
create policy "Contact Notes Delete Policy" on public.contact_notes for delete to authenticated using (public.current_user_role() in ('admin', 'sales_manager'));

-- Outreach Events
create policy "Enable read access for authenticated users" on public.outreach_events for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.outreach_events for insert to authenticated with check (public.current_user_role() in ('admin', 'sales_manager'));
create policy "Outreach Events Update Policy" on public.outreach_events for update to authenticated using (public.current_user_role() in ('admin', 'sales_manager'));
create policy "Outreach Events Delete Policy" on public.outreach_events for delete to authenticated using (public.current_user_role() in ('admin', 'sales_manager'));

-- Deals
create policy "Enable read access for authenticated users" on public.deals for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.deals for insert to authenticated with check (public.current_user_role() in ('admin', 'sales_manager'));
create policy "Enable update for authenticated users only" on public.deals for update to authenticated using (public.current_user_role() in ('admin', 'sales_manager')) with check (public.current_user_role() in ('admin', 'sales_manager'));
create policy "Deals Delete Policy" on public.deals for delete to authenticated using (public.current_user_role() in ('admin', 'sales_manager'));

-- Deal Notes
create policy "Enable read access for authenticated users" on public.deal_notes for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.deal_notes for insert to authenticated with check (public.current_user_role() in ('admin', 'sales_manager'));
create policy "Deal Notes Update Policy" on public.deal_notes for update to authenticated using (public.current_user_role() in ('admin', 'sales_manager'));
create policy "Deal Notes Delete Policy" on public.deal_notes for delete to authenticated using (public.current_user_role() in ('admin', 'sales_manager'));

-- Sales
create policy "Enable read access for authenticated users" on public.sales for select to authenticated using (true);

-- Tags
create policy "Enable read access for authenticated users" on public.tags for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.tags for insert to authenticated with check (public.current_user_role() in ('admin', 'sales_manager'));
create policy "Enable update for authenticated users only" on public.tags for update to authenticated using (public.current_user_role() in ('admin', 'sales_manager'));
create policy "Enable delete for authenticated users only" on public.tags for delete to authenticated using (public.current_user_role() = 'admin');

-- Tasks
create policy "Enable read access for authenticated users" on public.tasks for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.tasks for insert to authenticated with check (public.current_user_role() in ('admin', 'sales_manager') or (public.current_user_role() = 'lead_researcher' and sales_id = public.current_sale_id()));
create policy "Task Update Policy" on public.tasks for update to authenticated using (public.current_user_role() in ('admin', 'sales_manager') or (public.current_user_role() = 'lead_researcher' and sales_id = public.current_sale_id()));
create policy "Task Delete Policy" on public.tasks for delete to authenticated using (public.current_user_role() in ('admin', 'sales_manager'));

-- Configuration (admin-only for writes)
create policy "Enable read for authenticated" on public.configuration for select to authenticated using (true);
create policy "Enable insert for admins" on public.configuration for insert to authenticated with check (public.is_admin());
create policy "Enable update for admins" on public.configuration for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Favicons excluded domains
create policy "Enable access for authenticated users only" on public.favicons_excluded_domains to authenticated using (true) with check (true);

-- Daily research activities
create policy "Enable read daily research activities" on public.daily_research_activities for select to authenticated using (public.current_user_role() in ('admin', 'sales_manager') or user_id = public.current_sale_id());
create policy "Enable insert own daily research activity" on public.daily_research_activities for insert to authenticated with check (public.current_user_role() in ('admin', 'sales_manager') or (public.current_user_role() = 'lead_researcher' and user_id = public.current_sale_id()));
create policy "Enable update own daily research activity" on public.daily_research_activities for update to authenticated using (public.current_user_role() in ('admin', 'sales_manager') or (public.current_user_role() = 'lead_researcher' and user_id = public.current_sale_id())) with check (public.current_user_role() in ('admin', 'sales_manager') or (public.current_user_role() = 'lead_researcher' and user_id = public.current_sale_id()));
create policy "Enable delete daily research activities for admins" on public.daily_research_activities for delete to authenticated using (public.current_user_role() = 'admin');
