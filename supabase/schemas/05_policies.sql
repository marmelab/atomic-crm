--
-- Row Level Security
-- This file declares RLS policies for all tables.
--
-- Predicates are wrapped as `(select private.is_active_sales())` on purpose: a
-- bare call is evaluated once per scanned row, the sub-select once per
-- statement (InitPlan). Unwrapping it costs ~300x on inserts and list queries.
-- UPDATE policies omit `with check`, which then reuses the `using` expression.
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
create policy "Enable read access for authenticated users" on public.companies for select to authenticated using ((select private.is_active_sales()));
create policy "Enable insert for authenticated users only" on public.companies for insert to authenticated with check ((select private.is_active_sales()));
create policy "Enable update for authenticated users only" on public.companies for update to authenticated using ((select private.is_active_sales()));
create policy "Company Delete Policy" on public.companies for delete to authenticated using ((select private.is_active_sales()));

-- Contacts
create policy "Enable read access for authenticated users" on public.contacts for select to authenticated using ((select private.is_active_sales()));
create policy "Enable insert for authenticated users only" on public.contacts for insert to authenticated with check ((select private.is_active_sales()));
create policy "Enable update for authenticated users only" on public.contacts for update to authenticated using ((select private.is_active_sales()));
create policy "Contact Delete Policy" on public.contacts for delete to authenticated using ((select private.is_active_sales()));

-- Contact Notes
create policy "Enable read access for authenticated users" on public.contact_notes for select to authenticated using ((select private.is_active_sales()));
create policy "Enable insert for authenticated users only" on public.contact_notes for insert to authenticated with check ((select private.is_active_sales()));
create policy "Contact Notes Update policy" on public.contact_notes for update to authenticated using ((select private.is_active_sales()));
create policy "Contact Notes Delete Policy" on public.contact_notes for delete to authenticated using ((select private.is_active_sales()));

-- Deals
create policy "Enable read access for authenticated users" on public.deals for select to authenticated using ((select private.is_active_sales()));
create policy "Enable insert for authenticated users only" on public.deals for insert to authenticated with check ((select private.is_active_sales()));
create policy "Enable update for authenticated users only" on public.deals for update to authenticated using ((select private.is_active_sales()));
create policy "Deals Delete Policy" on public.deals for delete to authenticated using ((select private.is_active_sales()));

-- Deal Notes
create policy "Enable read access for authenticated users" on public.deal_notes for select to authenticated using ((select private.is_active_sales()));
create policy "Enable insert for authenticated users only" on public.deal_notes for insert to authenticated with check ((select private.is_active_sales()));
create policy "Deal Notes Update Policy" on public.deal_notes for update to authenticated using ((select private.is_active_sales()));
create policy "Deal Notes Delete Policy" on public.deal_notes for delete to authenticated using ((select private.is_active_sales()));

-- Sales
create policy "Enable read access for authenticated users" on public.sales for select to authenticated using ((select private.is_active_sales()));

-- Tags
create policy "Enable read access for authenticated users" on public.tags for select to authenticated using ((select private.is_active_sales()));
create policy "Enable insert for authenticated users only" on public.tags for insert to authenticated with check ((select private.is_active_sales()));
create policy "Enable update for authenticated users only" on public.tags for update to authenticated using ((select private.is_active_sales()));
create policy "Enable delete for authenticated users only" on public.tags for delete to authenticated using ((select private.is_active_sales()));

-- Tasks
create policy "Enable read access for authenticated users" on public.tasks for select to authenticated using ((select private.is_active_sales()));
create policy "Enable insert for authenticated users only" on public.tasks for insert to authenticated with check ((select private.is_active_sales()));
create policy "Task Update Policy" on public.tasks for update to authenticated using ((select private.is_active_sales()));
create policy "Task Delete Policy" on public.tasks for delete to authenticated using ((select private.is_active_sales()));

-- Configuration (admin-only for writes)
-- The read stays open to any authenticated user: it holds only branding and
-- taxonomy, it is prefetched during login, and anon has no grant on the table.
create policy "Enable read for authenticated" on public.configuration for select to authenticated using (true);
create policy "Enable insert for admins" on public.configuration for insert to authenticated with check ((select private.is_admin()));
create policy "Enable update for admins" on public.configuration for update to authenticated using ((select private.is_admin()));

-- Favicons excluded domains
create policy "Enable access for authenticated users only" on public.favicons_excluded_domains to authenticated using ((select private.is_active_sales()));
