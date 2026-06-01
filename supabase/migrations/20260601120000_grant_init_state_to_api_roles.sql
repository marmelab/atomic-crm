-- The CRM's public views (activity_log, companies_summary, contacts_summary
-- and init_state) are queried through the Supabase Data API by the anon and
-- authenticated roles. `init_state` in particular is read by the anon role
-- *before* login (see src/components/atomic-crm/providers/supabase/authProvider.ts)
-- to decide whether the CRM has already been initialized.
--
-- Unlike the tables -- whose grants were captured in earlier migrations -- these
-- views never had explicit grants in a migration: they were reachable only
-- because Supabase used to grant every object in the `public` schema to the
-- anon/authenticated/service_role API roles automatically. That behavior has
-- been removed: objects are no longer exposed to the Data/GraphQL API unless
-- access is granted explicitly.
-- https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
--
-- These grants are already declared in supabase/schemas/06_grants.sql (the
-- source of truth) but were never applied through a migration. Re-declare them
-- explicitly so production keeps exposing the views.

grant all on table public.activity_log to anon;
grant all on table public.activity_log to authenticated;
grant all on table public.activity_log to service_role;

grant all on table public.companies_summary to anon;
grant all on table public.companies_summary to authenticated;
grant all on table public.companies_summary to service_role;

grant all on table public.contacts_summary to anon;
grant all on table public.contacts_summary to authenticated;
grant all on table public.contacts_summary to service_role;

grant all on table public.init_state to anon;
grant all on table public.init_state to authenticated;
grant all on table public.init_state to service_role;
