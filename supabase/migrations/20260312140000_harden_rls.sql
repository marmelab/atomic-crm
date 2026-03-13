-- Harden RLS policies for core CRM tables
-- This migration replaces overly-permissive policies with tenant-aware rules.
-- SELECT policies remain open to all authenticated users (single-team CRM design),
-- but INSERT/UPDATE/DELETE are scoped to the owner or an admin.

set check_function_bodies = off;

-- Helper: returns the sales.id for the currently authenticated user
create or replace function public.current_sales_id()
returns bigint
language sql
stable
security invoker
set search_path to public
as $$
  select id
  from public.sales
  where user_id = auth.uid()
  limit 1
$$;

-- Helper: returns true if the current user is an administrator
create or replace function public.current_sales_is_admin()
returns boolean
language sql
stable
security invoker
set search_path to public
as $$
  select coalesce(administrator, false)
  from public.sales
  where user_id = auth.uid()
  limit 1
$$;

-- ────────────────────────────────────────────
-- companies
-- ────────────────────────────────────────────
drop policy if exists "Enable insert for authenticated users only" on public.companies;
drop policy if exists "Enable read access for authenticated users"  on public.companies;
drop policy if exists "Enable update for authenticated users only"  on public.companies;
drop policy if exists "Company Delete Policy"                       on public.companies;

-- All authenticated users can read all companies (shared CRM workspace)
create policy "Companies select all"
on public.companies as permissive for select
to authenticated using (true);

create policy "Companies insert own"
on public.companies as permissive for insert
to authenticated with check (
  current_sales_is_admin()
  or sales_id = current_sales_id()
  or sales_id is null
);

create policy "Companies update own"
on public.companies as permissive for update
to authenticated
using  (current_sales_is_admin() or sales_id = current_sales_id())
with check (current_sales_is_admin() or sales_id = current_sales_id());

create policy "Companies delete own"
on public.companies as permissive for delete
to authenticated
using (current_sales_is_admin() or sales_id = current_sales_id());

-- ────────────────────────────────────────────
-- contacts
-- ────────────────────────────────────────────
drop policy if exists "Enable insert for authenticated users only" on public.contacts;
drop policy if exists "Enable read access for authenticated users"  on public.contacts;
drop policy if exists "Enable update for authenticated users only"  on public.contacts;
drop policy if exists "Contact Delete Policy"                       on public.contacts;

create policy "Contacts select all"
on public.contacts as permissive for select
to authenticated using (true);

create policy "Contacts insert own"
on public.contacts as permissive for insert
to authenticated with check (
  current_sales_is_admin()
  or sales_id = current_sales_id()
  or sales_id is null
);

create policy "Contacts update own"
on public.contacts as permissive for update
to authenticated
using  (current_sales_is_admin() or sales_id = current_sales_id())
with check (current_sales_is_admin() or sales_id = current_sales_id());

create policy "Contacts delete own"
on public.contacts as permissive for delete
to authenticated
using (current_sales_is_admin() or sales_id = current_sales_id());

-- ────────────────────────────────────────────
-- deals
-- ────────────────────────────────────────────
drop policy if exists "Enable insert for authenticated users only" on public.deals;
drop policy if exists "Enable read access for authenticated users"  on public.deals;
drop policy if exists "Enable update for authenticated users only"  on public.deals;
drop policy if exists "Deals Delete Policy"                         on public.deals;

create policy "Deals select all"
on public.deals as permissive for select
to authenticated using (true);

create policy "Deals insert own"
on public.deals as permissive for insert
to authenticated with check (
  current_sales_is_admin()
  or sales_id = current_sales_id()
  or sales_id is null
);

create policy "Deals update own"
on public.deals as permissive for update
to authenticated
using  (current_sales_is_admin() or sales_id = current_sales_id())
with check (current_sales_is_admin() or sales_id = current_sales_id());

create policy "Deals delete own"
on public.deals as permissive for delete
to authenticated
using (current_sales_is_admin() or sales_id = current_sales_id());

-- ────────────────────────────────────────────
-- tasks  (uses snake_case name from migration 20260115)
-- ────────────────────────────────────────────
drop policy if exists "Enable insert for authenticated users only" on public.tasks;
drop policy if exists "Enable read access for authenticated users"  on public.tasks;
drop policy if exists "Task Delete Policy"                          on public.tasks;
drop policy if exists "Task Update Policy"                          on public.tasks;

create policy "Tasks select all"
on public.tasks as permissive for select
to authenticated using (true);

create policy "Tasks insert own"
on public.tasks as permissive for insert
to authenticated with check (
  current_sales_is_admin()
  or sales_id = current_sales_id()
  or sales_id is null
);

create policy "Tasks update own"
on public.tasks as permissive for update
to authenticated
using  (current_sales_is_admin() or sales_id = current_sales_id())
with check (current_sales_is_admin() or sales_id = current_sales_id());

create policy "Tasks delete own"
on public.tasks as permissive for delete
to authenticated
using (current_sales_is_admin() or sales_id = current_sales_id());

-- ────────────────────────────────────────────
-- contact_notes  (renamed from "contactNotes" in migration 20260115)
-- ────────────────────────────────────────────
drop policy if exists "Enable insert for authenticated users only" on public.contact_notes;
drop policy if exists "Enable read access for authenticated users"  on public.contact_notes;
drop policy if exists "Contact Notes Delete Policy"                 on public.contact_notes;
drop policy if exists "Contact Notes Update policy"                 on public.contact_notes;

create policy "ContactNotes select all"
on public.contact_notes as permissive for select
to authenticated using (true);

create policy "ContactNotes insert own"
on public.contact_notes as permissive for insert
to authenticated with check (
  current_sales_is_admin()
  or sales_id = current_sales_id()
  or sales_id is null
);

create policy "ContactNotes update own"
on public.contact_notes as permissive for update
to authenticated
using  (current_sales_is_admin() or sales_id = current_sales_id())
with check (current_sales_is_admin() or sales_id = current_sales_id());

create policy "ContactNotes delete own"
on public.contact_notes as permissive for delete
to authenticated
using (current_sales_is_admin() or sales_id = current_sales_id());

-- ────────────────────────────────────────────
-- deal_notes  (renamed from "dealNotes" in migration 20260115)
-- ────────────────────────────────────────────
drop policy if exists "Enable insert for authenticated users only" on public.deal_notes;
drop policy if exists "Enable read access for authenticated users"  on public.deal_notes;
drop policy if exists "Deal Notes Delete Policy"                    on public.deal_notes;
drop policy if exists "Deal Notes Update Policy"                    on public.deal_notes;

create policy "DealNotes select all"
on public.deal_notes as permissive for select
to authenticated using (true);

create policy "DealNotes insert own"
on public.deal_notes as permissive for insert
to authenticated with check (
  current_sales_is_admin()
  or sales_id = current_sales_id()
  or sales_id is null
);

create policy "DealNotes update own"
on public.deal_notes as permissive for update
to authenticated
using  (current_sales_is_admin() or sales_id = current_sales_id())
with check (current_sales_is_admin() or sales_id = current_sales_id());

create policy "DealNotes delete own"
on public.deal_notes as permissive for delete
to authenticated
using (current_sales_is_admin() or sales_id = current_sales_id());

-- ────────────────────────────────────────────
-- sales
-- ────────────────────────────────────────────
drop policy if exists "Enable insert for authenticated users only" on public.sales;
drop policy if exists "Enable update for authenticated users only"  on public.sales;
drop policy if exists "Enable read access for authenticated users"  on public.sales;

-- All users can read the sales team list (needed for showing note authors etc.)
create policy "Sales select all"
on public.sales as permissive for select
to authenticated using (true);

-- Only admins or self can update a sales record
create policy "Sales update self or admin"
on public.sales as permissive for update
to authenticated
using  (current_sales_is_admin() or user_id = auth.uid())
with check (current_sales_is_admin() or user_id = auth.uid());

-- ────────────────────────────────────────────
-- tags  (drop superfluous duplicate policies added by init_db)
-- ────────────────────────────────────────────
drop policy if exists "Enable delete for authenticated users only" on public.tags;
drop policy if exists "Enable update for authenticated users only"  on public.tags;
