-- Fix the Security Advisor "rls_policy_always_true" warnings.
-- Every INSERT / UPDATE / DELETE policy used `true`, so any authenticated
-- session could write, including one whose sales account has been disabled
-- (its JWT stays valid until it expires). Writes now require an active sales
-- account. The CRM data stays shared between all active users.
-- The helper is wrapped in a sub-select so Postgres evaluates it once per
-- statement instead of once per row.
-- UPDATE policies that had no WITH CHECK now get one, so a row cannot be
-- updated into a state the policy would not accept.

CREATE OR REPLACE FUNCTION "public"."is_active_sale"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1 from public.sales where user_id = auth.uid() and disabled = false
  );
$$;

revoke execute on function public.is_active_sale() from public, anon;
grant all on function public.is_active_sale() to authenticated;
grant all on function public.is_active_sale() to service_role;

-- A disabled administrator must lose admin rights (configuration writes) too.
-- is_admin() only reads public.sales, which authenticated users can already
-- select, so it no longer needs SECURITY DEFINER.
CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  return exists (
    select 1 from public.sales where user_id = auth.uid() and administrator = true and disabled = false
  );
end;
$$;


alter policy "Enable insert for authenticated users only" on public.companies with check ((select public.is_active_sale()));
alter policy "Enable update for authenticated users only" on public.companies using ((select public.is_active_sale())) with check ((select public.is_active_sale()));
alter policy "Company Delete Policy" on public.companies using ((select public.is_active_sale()));

alter policy "Enable insert for authenticated users only" on public.contacts with check ((select public.is_active_sale()));
alter policy "Enable update for authenticated users only" on public.contacts using ((select public.is_active_sale())) with check ((select public.is_active_sale()));
alter policy "Contact Delete Policy" on public.contacts using ((select public.is_active_sale()));

alter policy "Enable insert for authenticated users only" on public.contact_notes with check ((select public.is_active_sale()));
alter policy "Contact Notes Update policy" on public.contact_notes using ((select public.is_active_sale())) with check ((select public.is_active_sale()));
alter policy "Contact Notes Delete Policy" on public.contact_notes using ((select public.is_active_sale()));

alter policy "Enable insert for authenticated users only" on public.deals with check ((select public.is_active_sale()));
alter policy "Enable update for authenticated users only" on public.deals using ((select public.is_active_sale())) with check ((select public.is_active_sale()));
alter policy "Deals Delete Policy" on public.deals using ((select public.is_active_sale()));

alter policy "Enable insert for authenticated users only" on public.deal_notes with check ((select public.is_active_sale()));
alter policy "Deal Notes Update Policy" on public.deal_notes using ((select public.is_active_sale())) with check ((select public.is_active_sale()));
alter policy "Deal Notes Delete Policy" on public.deal_notes using ((select public.is_active_sale()));

alter policy "Enable insert for authenticated users only" on public.tags with check ((select public.is_active_sale()));
alter policy "Enable update for authenticated users only" on public.tags using ((select public.is_active_sale())) with check ((select public.is_active_sale()));
alter policy "Enable delete for authenticated users only" on public.tags using ((select public.is_active_sale()));

alter policy "Enable insert for authenticated users only" on public.tasks with check ((select public.is_active_sale()));
alter policy "Task Update Policy" on public.tasks using ((select public.is_active_sale())) with check ((select public.is_active_sale()));
alter policy "Task Delete Policy" on public.tasks using ((select public.is_active_sale()));

-- This policy has no FOR clause, so it also covers SELECT. Reads stay shared
-- (get_domain_favicon() is security invoker and must see every exclusion).
alter policy "Enable access for authenticated users only" on public.favicons_excluded_domains using ((select public.is_active_sale())) with check ((select public.is_active_sale()));
create policy "Enable read access for authenticated users" on public.favicons_excluded_domains for select to authenticated using (true);

alter policy "Enable insert for admins" on public.configuration with check ((select public.is_admin()));
alter policy "Enable update for admins" on public.configuration using ((select public.is_admin())) with check ((select public.is_admin()));

-- Note attachments: a disabled account must not upload or delete files either.
alter policy "Attachments 1mt4rzk_1" on storage.objects with check (bucket_id = 'attachments' and (select public.is_active_sale()));
alter policy "Attachments 1mt4rzk_3" on storage.objects using (bucket_id = 'attachments' and (select public.is_active_sale()));
