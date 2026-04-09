-- Create the deals_summary view that the frontend reads from.
--
-- History: a previous attempt landed in migration
-- 20260408120000_deals_summary_view.sql, but that file shares its timestamp
-- with 20260408120000_enforce_rls_security.sql. Supabase tracks migrations by
-- their leading timestamp, so only one of the two ever made it into
-- supabase_migrations.schema_migrations on the remote — the view was never
-- created, which surfaced as PostgREST's "Could not find the table
-- 'public.deals_summary' in the schema cache" error on /deals.
--
-- This migration uses CREATE OR REPLACE VIEW so it is safe to run whether or
-- not the old file happened to execute. It also aligns the view's GRANTs with
-- 20260408120000_enforce_rls_security.sql: anon must never receive privileges
-- on public relations, only authenticated and service_role do.

create or replace view public.deals_summary
  with (security_invoker = on)
  as
select
    d.*,
    coalesce(string_agg((c.first_name || ' ' || c.last_name), ' '), '') as contact_names,
    lower(immutable_unaccent(coalesce(string_agg((c.first_name || ' ' || c.last_name), ' '), ''))) as contact_names_search
from public.deals d
    left join public.contacts c on c.id = any(d.contact_ids)
group by d.id;

-- Make sure anon never has access, even if the old duplicate-timestamp
-- migration previously granted it.
revoke all on table public.deals_summary from anon;

grant all on table public.deals_summary to authenticated;
grant all on table public.deals_summary to service_role;
