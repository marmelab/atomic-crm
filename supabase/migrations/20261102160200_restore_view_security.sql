-- Hand-written follow-up to the generated 20261102160000 migration.
--
-- `supabase db diff` recreates views without their `security_invoker` option,
-- which would make them run as their owner and bypass RLS (a bde could read
-- every lead through contacts_summary). Restore the option declared in
-- supabase/schemas/03_views.sql, and take back the anon grants Supabase's
-- default privileges gave the new import_batches table.
alter view public.contacts_summary set (security_invoker = on);
alter view public.companies_summary set (security_invoker = on);
alter view public.activity_log set (security_invoker = on);

revoke all on table public.import_batches from anon;
revoke all on table public.contacts_summary from anon;
revoke all on table public.companies_summary from anon;
revoke all on table public.activity_log from anon;
