--
-- Row Level Security
-- This file declares RLS policies for all tables.
--

-- Enable RLS on all tables
alter table public.businesses enable row level security;
alter table public.members enable row level security;
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
alter table public.user_invitations enable row level security;

-- Business data tables (companies, contacts, notes, deals, tags, tasks):
-- policies in 09_businesses.sql, after their business_id columns.

-- Configuration (one row per business, id = business id): members read, owners write
create policy "Business read" on public.configuration for select to authenticated using (id = (select public.current_business_id()));
create policy "Owner insert" on public.configuration for insert to authenticated with check (id = (select public.current_business_id()) and (select public.is_admin()));
create policy "Owner update" on public.configuration for update to authenticated using (id = (select public.current_business_id()) and (select public.is_admin())) with check (id = (select public.current_business_id()));

-- Sales (user profiles): yourself and the members of your current business
create policy "Visible users" on public.sales for select to authenticated using (((select auth.uid()) = user_id) or public.is_visible_user(user_id));

-- Businesses: those you are an active member of; owners rename the current one.
-- Created and deleted through create_business() and delete_business().
create policy "Member read" on public.businesses for select to authenticated using (
    exists (select 1 from public.members m where m.business_id = businesses.id and m.user_id = (select auth.uid()) and not m.disabled)
);
create policy "Owner update" on public.businesses for update to authenticated using (id = (select public.current_business_id()) and (select public.is_admin())) with check (id = (select public.current_business_id()));

-- Members: your own memberships and the members of your current business.
-- Changed through functions and the users edge function.
create policy "Member read" on public.members for select to authenticated using ((user_id = (select auth.uid())) or (business_id = (select public.current_business_id())));

-- Favicons excluded domains
create policy "Enable access for authenticated users only" on public.favicons_excluded_domains to authenticated using (true) with check (true);
