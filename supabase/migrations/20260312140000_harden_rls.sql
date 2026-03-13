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

-- Contacts: restrict by sales_id, admins can see all
drop policy if exists "Enable insert for authenticated users only" on public.contacts;
drop policy if exists "Enable read access for authenticated users" on public.contacts;
drop policy if exists "Enable update for authenticated users only" on public.contacts;
drop policy if exists "Contact Delete Policy" on public.contacts;

create policy "Contacts insert own"
on public.contacts
as permissive
for insert
to authenticated
with check (
  current_sales_is_admin()
  or sales_id = current_sales_id()
  or sales_id is null
);

create policy "Contacts select scoped"
on public.contacts
as permissive
for select
to authenticated
using (
  current_sales_is_admin()
  or sales_id = current_sales_id()
);

create policy "Contacts update own"
on public.contacts
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

create policy "Contacts delete own"
on public.contacts
as permissive
for delete
to authenticated
using (
  current_sales_is_admin()
  or sales_id = current_sales_id()
);

-- Deals: restrict by sales_id, admins can see all
drop policy if exists "Enable insert for authenticated users only" on public.deals;
drop policy if exists "Enable read access for authenticated users" on public.deals;
drop policy if exists "Enable update for authenticated users only" on public.deals;
drop policy if exists "Deals Delete Policy" on public.deals;

create policy "Deals insert own"
on public.deals
as permissive
for insert
to authenticated
with check (
  current_sales_is_admin()
  or sales_id = current_sales_id()
  or sales_id is null
);

create policy "Deals select scoped"
on public.deals
as permissive
for select
to authenticated
using (
  current_sales_is_admin()
  or sales_id = current_sales_id()
);

create policy "Deals update own"
on public.deals
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

create policy "Deals delete own"
on public.deals
as permissive
for delete
to authenticated
using (
  current_sales_is_admin()
  or sales_id = current_sales_id()
);

-- Tasks: restrict by related contact.sales_id, admins can see all
drop policy if exists "Enable insert for authenticated users only" on public.tasks;
drop policy if exists "Enable read access for authenticated users" on public.tasks;
drop policy if exists "Task Delete Policy" on public.tasks;
drop policy if exists "Task Update Policy" on public.tasks;

create policy "Tasks insert via contact"
on public.tasks
as permissive
for insert
to authenticated
with check (
  current_sales_is_admin()
  or exists (
    select 1
    from public.contacts c
    where c.id = contact_id
      and c.sales_id = current_sales_id()
  )
);

create policy "Tasks select scoped"
on public.tasks
as permissive
for select
to authenticated
using (
  current_sales_is_admin()
  or exists (
    select 1
    from public.contacts c
    where c.id = contact_id
      and c.sales_id = current_sales_id()
  )
);

create policy "Tasks update scoped"
on public.tasks
as permissive
for update
to authenticated
using (
  current_sales_is_admin()
  or exists (
    select 1
    from public.contacts c
    where c.id = contact_id
      and c.sales_id = current_sales_id()
  )
)
with check (
  current_sales_is_admin()
  or exists (
    select 1
    from public.contacts c
    where c.id = contact_id
      and c.sales_id = current_sales_id()
  )
);

create policy "Tasks delete scoped"
on public.tasks
as permissive
for delete
to authenticated
using (
  current_sales_is_admin()
  or exists (
    select 1
    from public.contacts c
    where c.id = contact_id
      and c.sales_id = current_sales_id()
  )
);

-- Contact notes: restrict by related contact.sales_id, admins can see all
drop policy if exists "Enable insert for authenticated users only" on public."contactNotes";
drop policy if exists "Enable read access for authenticated users" on public."contactNotes";
drop policy if exists "Contact Notes Delete Policy" on public."contactNotes";
drop policy if exists "Contact Notes Update policy" on public."contactNotes";

create policy "ContactNotes insert via contact"
on public."contactNotes"
as permissive
for insert
to authenticated
with check (
  current_sales_is_admin()
  or exists (
    select 1
    from public.contacts c
    where c.id = contact_id
      and c.sales_id = current_sales_id()
  )
);

create policy "ContactNotes select scoped"
on public."contactNotes"
as permissive
for select
to authenticated
using (
  current_sales_is_admin()
  or exists (
    select 1
    from public.contacts c
    where c.id = contact_id
      and c.sales_id = current_sales_id()
  )
);

create policy "ContactNotes update scoped"
on public."contactNotes"
as permissive
for update
to authenticated
using (
  current_sales_is_admin()
  or exists (
    select 1
    from public.contacts c
    where c.id = contact_id
      and c.sales_id = current_sales_id()
  )
)
with check (
  current_sales_is_admin()
  or exists (
    select 1
    from public.contacts c
    where c.id = contact_id
      and c.sales_id = current_sales_id()
  )
);

create policy "ContactNotes delete scoped"
on public."contactNotes"
as permissive
for delete
to authenticated
using (
  current_sales_is_admin()
  or exists (
    select 1
    from public.contacts c
    where c.id = contact_id
      and c.sales_id = current_sales_id()
  )
);

-- Deal notes: restrict by related deal.sales_id, admins can see all
drop policy if exists "Enable insert for authenticated users only" on public."dealNotes";
drop policy if exists "Enable read access for authenticated users" on public."dealNotes";
drop policy if exists "Deal Notes Delete Policy" on public."dealNotes";
drop policy if exists "Deal Notes Update Policy" on public."dealNotes";

create policy "DealNotes insert via deal"
on public."dealNotes"
as permissive
for insert
to authenticated
with check (
  current_sales_is_admin()
  or exists (
    select 1
    from public.deals d
    where d.id = deal_id
      and d.sales_id = current_sales_id()
  )
);

create policy "DealNotes select scoped"
on public."dealNotes"
as permissive
for select
to authenticated
using (
  current_sales_is_admin()
  or exists (
    select 1
    from public.deals d
    where d.id = deal_id
      and d.sales_id = current_sales_id()
  )
);

create policy "DealNotes update scoped"
on public."dealNotes"
as permissive
for update
to authenticated
using (
  current_sales_is_admin()
  or exists (
    select 1
    from public.deals d
    where d.id = deal_id
      and d.sales_id = current_sales_id()
  )
)
with check (
  current_sales_is_admin()
  or exists (
    select 1
    from public.deals d
    where d.id = deal_id
      and d.sales_id = current_sales_id()
  )
);

create policy "DealNotes delete scoped"
on public."dealNotes"
as permissive
for delete
to authenticated
using (
  current_sales_is_admin()
  or exists (
    select 1
    from public.deals d
    where d.id = deal_id
      and d.sales_id = current_sales_id()
  )
);

-- Sales: restrict to own row, admins can see all
drop policy if exists "Enable insert for authenticated users only" on public.sales;
drop policy if exists "Enable update for authenticated users only" on public.sales;
drop policy if exists "Enable read access for authenticated users" on public.sales;

create policy "Sales select scoped"
on public.sales
as permissive
for select
to authenticated
using (
  current_sales_is_admin()
  or user_id = auth.uid()
);

create policy "Sales update self"
on public.sales
as permissive
for update
to authenticated
using (
  current_sales_is_admin()
  or user_id = auth.uid()
)
with check (
  current_sales_is_admin()
  or user_id = auth.uid()
);

-- Tags: keep global but drop extra delete/update policies to minimise surface
drop policy if exists "Enable delete for authenticated users only" on public.tags;
drop policy if exists "Enable update for authenticated users only" on public.tags;








