-- Security Advisor hardening.
--
-- 0010 security_definer_view    init_state becomes security_invoker, its
--                               RLS-bypassing read moved into a function.
-- 0024 rls_policy_always_true   CRM policies gate on active sales-team
--                               membership instead of the literal `true`.
-- 0025 public_bucket_allows_listing
--                               the attachments bucket is public, so its broad
--                               SELECT policy only enabled enumeration.
-- 0026 pg_graphql_anon_table_exposed
--                               fixed by the anon revoke below: with no grants
--                               on public, anon reflects nothing. pg_graphql
--                               stays installed, so 0027 (relations visible to
--                               authenticated) keeps firing - that is the
--                               intended behaviour of the GraphQL API and the
--                               lint is informational.
-- 0028/0029 definer functions    helpers move to the unexposed `private` schema,
--                               trigger functions lose their API-role grants.

set check_function_bodies = off;

create schema if not exists private;

grant usage on schema private to anon;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

CREATE OR REPLACE FUNCTION "private"."get_init_state"() RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return (select count(sub.id) from (select id from public.sales limit 1) sub);
end;
$$;

CREATE OR REPLACE FUNCTION "private"."is_active_sales"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return exists (
    select 1 from public.sales
    where user_id = auth.uid() and disabled = false
  );
end;
$$;

CREATE OR REPLACE FUNCTION "private"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return exists (
    select 1 from public.sales where user_id = auth.uid() and administrator = true
  );
end;
$$;

grant all on function private.get_init_state() to anon;
grant all on function private.get_init_state() to authenticated;
grant all on function private.get_init_state() to service_role;

grant all on function private.is_active_sales() to authenticated;
grant all on function private.is_active_sales() to service_role;

grant all on function private.is_admin() to authenticated;
grant all on function private.is_admin() to service_role;

-- CREATE OR REPLACE VIEW keeps existing reloptions; flip it explicitly.
create or replace view public.init_state as
select private.get_init_state() as is_initialized;
alter view public.init_state set (security_invoker = on);

-- Companies
drop policy if exists "Enable read access for authenticated users" on public.companies;
create policy "Enable read access for authenticated users" on public.companies for select to authenticated using ((select private.is_active_sales()));
drop policy if exists "Enable insert for authenticated users only" on public.companies;
create policy "Enable insert for authenticated users only" on public.companies for insert to authenticated with check ((select private.is_active_sales()));
drop policy if exists "Enable update for authenticated users only" on public.companies;
create policy "Enable update for authenticated users only" on public.companies for update to authenticated using ((select private.is_active_sales()));
drop policy if exists "Company Delete Policy" on public.companies;
create policy "Company Delete Policy" on public.companies for delete to authenticated using ((select private.is_active_sales()));

-- Contacts
drop policy if exists "Enable read access for authenticated users" on public.contacts;
create policy "Enable read access for authenticated users" on public.contacts for select to authenticated using ((select private.is_active_sales()));
drop policy if exists "Enable insert for authenticated users only" on public.contacts;
create policy "Enable insert for authenticated users only" on public.contacts for insert to authenticated with check ((select private.is_active_sales()));
drop policy if exists "Enable update for authenticated users only" on public.contacts;
create policy "Enable update for authenticated users only" on public.contacts for update to authenticated using ((select private.is_active_sales()));
drop policy if exists "Contact Delete Policy" on public.contacts;
create policy "Contact Delete Policy" on public.contacts for delete to authenticated using ((select private.is_active_sales()));

-- Contact Notes
drop policy if exists "Enable read access for authenticated users" on public.contact_notes;
create policy "Enable read access for authenticated users" on public.contact_notes for select to authenticated using ((select private.is_active_sales()));
drop policy if exists "Enable insert for authenticated users only" on public.contact_notes;
create policy "Enable insert for authenticated users only" on public.contact_notes for insert to authenticated with check ((select private.is_active_sales()));
drop policy if exists "Contact Notes Update policy" on public.contact_notes;
create policy "Contact Notes Update policy" on public.contact_notes for update to authenticated using ((select private.is_active_sales()));
drop policy if exists "Contact Notes Delete Policy" on public.contact_notes;
create policy "Contact Notes Delete Policy" on public.contact_notes for delete to authenticated using ((select private.is_active_sales()));

-- Deals
drop policy if exists "Enable read access for authenticated users" on public.deals;
create policy "Enable read access for authenticated users" on public.deals for select to authenticated using ((select private.is_active_sales()));
drop policy if exists "Enable insert for authenticated users only" on public.deals;
create policy "Enable insert for authenticated users only" on public.deals for insert to authenticated with check ((select private.is_active_sales()));
drop policy if exists "Enable update for authenticated users only" on public.deals;
create policy "Enable update for authenticated users only" on public.deals for update to authenticated using ((select private.is_active_sales()));
drop policy if exists "Deals Delete Policy" on public.deals;
create policy "Deals Delete Policy" on public.deals for delete to authenticated using ((select private.is_active_sales()));

-- Deal Notes
drop policy if exists "Enable read access for authenticated users" on public.deal_notes;
create policy "Enable read access for authenticated users" on public.deal_notes for select to authenticated using ((select private.is_active_sales()));
drop policy if exists "Enable insert for authenticated users only" on public.deal_notes;
create policy "Enable insert for authenticated users only" on public.deal_notes for insert to authenticated with check ((select private.is_active_sales()));
drop policy if exists "Deal Notes Update Policy" on public.deal_notes;
create policy "Deal Notes Update Policy" on public.deal_notes for update to authenticated using ((select private.is_active_sales()));
drop policy if exists "Deal Notes Delete Policy" on public.deal_notes;
create policy "Deal Notes Delete Policy" on public.deal_notes for delete to authenticated using ((select private.is_active_sales()));

-- Sales
drop policy if exists "Enable read access for authenticated users" on public.sales;
create policy "Enable read access for authenticated users" on public.sales for select to authenticated using ((select private.is_active_sales()));

-- Tags
drop policy if exists "Enable read access for authenticated users" on public.tags;
create policy "Enable read access for authenticated users" on public.tags for select to authenticated using ((select private.is_active_sales()));
drop policy if exists "Enable insert for authenticated users only" on public.tags;
create policy "Enable insert for authenticated users only" on public.tags for insert to authenticated with check ((select private.is_active_sales()));
drop policy if exists "Enable update for authenticated users only" on public.tags;
create policy "Enable update for authenticated users only" on public.tags for update to authenticated using ((select private.is_active_sales()));
drop policy if exists "Enable delete for authenticated users only" on public.tags;
create policy "Enable delete for authenticated users only" on public.tags for delete to authenticated using ((select private.is_active_sales()));

-- Tasks
drop policy if exists "Enable read access for authenticated users" on public.tasks;
create policy "Enable read access for authenticated users" on public.tasks for select to authenticated using ((select private.is_active_sales()));
drop policy if exists "Enable insert for authenticated users only" on public.tasks;
create policy "Enable insert for authenticated users only" on public.tasks for insert to authenticated with check ((select private.is_active_sales()));
drop policy if exists "Task Update Policy" on public.tasks;
create policy "Task Update Policy" on public.tasks for update to authenticated using ((select private.is_active_sales()));
drop policy if exists "Task Delete Policy" on public.tasks;
create policy "Task Delete Policy" on public.tasks for delete to authenticated using ((select private.is_active_sales()));

-- Configuration: the read policy is left as is, only the admin writes move.
drop policy if exists "Enable insert for admins" on public.configuration;
create policy "Enable insert for admins" on public.configuration for insert to authenticated with check ((select private.is_admin()));
drop policy if exists "Enable update for admins" on public.configuration;
create policy "Enable update for admins" on public.configuration for update to authenticated using ((select private.is_admin()));

-- Favicons excluded domains
drop policy if exists "Enable access for authenticated users only" on public.favicons_excluded_domains;
create policy "Enable access for authenticated users only" on public.favicons_excluded_domains to authenticated using ((select private.is_active_sales()));

drop function if exists public.is_admin();

revoke all on all functions in schema public from public, anon, authenticated;
grant all on all functions in schema public to service_role;

grant all on function public.get_avatar_for_email(text) to authenticated;
grant all on function public.get_domain_favicon(text) to authenticated;
grant all on function public.merge_contacts(bigint, bigint) to authenticated;

revoke all on all tables in schema public from anon;
grant all on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

revoke all on all sequences in schema public from anon;
grant all on all sequences in schema public to authenticated;
grant all on all sequences in schema public to service_role;

-- Must stay after the blanket revoke above.
grant all on table public.init_state to anon;

alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke all on functions from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;

-- The bucket is public, so objects are served by URL without any policy on
-- storage.objects; this one only enabled enumeration. See 07_storage.sql.
drop policy if exists "Attachments 1mt4rzk_0" on storage.objects;
