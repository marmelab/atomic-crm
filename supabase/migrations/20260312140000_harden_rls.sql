-- Harden RLS policies for core CRM tables
-- This migration replaces overly-permissive policies with tenant-aware rules
-- and scopes data access to the current sales user.

set check_function_bodies = off;

-- Helper function to get current sales id from auth.uid()
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

-- Helper function to know if current user is administrator
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

-- Companies: restrict by sales_id, admins can see all
drop policy if exists "Enable insert for authenticated users only" on public.companies;
drop policy if exists "Enable read access for authenticated users" on public.companies;
drop policy if exists "Enable update for authenticated users only" on public.companies;
drop policy if exists "Company Delete Policy" on public.companies;

create policy "Companies insert own"
on public.companies
as permissive
for insert
to authenticated
with check (
  current_sales_is_admin()
  or sales_id = current_sales_id()
  or sales_id is null
);

create policy "Companies select scoped"
on public.companies
as permissive
for select
to authenticated
using (
  current_sales_is_admin()
  or sales_id = current_sales_id()
);

create policy "Companies update own"
on public.companies
as permissive
for update
to authenticated
using (
  current_sales_is_admin()
  or sales_id = current_sales_id()
)
with check (
  current_sales_is_admin()
  or sales_id = current_sales_id()
);

create policy "Companies delete own"
on public.companies
as permissive
for delete
to authenticated
using (
  current_sales_is_admin()
  or sales_id = current_sales_id()
);

