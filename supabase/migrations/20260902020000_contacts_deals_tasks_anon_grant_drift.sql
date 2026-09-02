-- Native Application Intake real-infrastructure audit: contacts, deals, and
-- tasks are the CRM's most sensitive tables (PII, pipeline financials, work
-- items), and every access to them is already gated by RLS policies scoped
-- to `authenticated` only (see supabase/schemas/05_policies.sql) -- anon has
-- no policy on any of the three, so no anon session can read or write a
-- single row regardless of the table-level grant below it.
--
-- Verified directly against the real linked dev project during this audit:
-- SELECT/INSERT/UPDATE/DELETE were already revoked from anon on these three
-- tables live (only REFERENCES/TRIGGER/TRUNCATE remain, likely a deliberate
-- prior hardening applied outside the migration flow), while
-- 06_grants.sql still declared unconditional "grant all ... to anon" for
-- all three with no matching revoke anywhere in migration history. That
-- drift meant a future `supabase db push` re-running this file's grants
-- could have silently re-widened anon's access back to full CRUD on these
-- tables the next time it touched them, without anyone noticing -- the
-- exact class of undocumented schema drift this audit exists to catch.
-- This migration and the matching 06_grants.sql update simply record the
-- live, safer reality in version control; no application behavior changes
-- (RLS was and remains the enforced boundary; nothing in the app -- the
-- public_application Edge Function included -- reads or writes these
-- tables through the anon role, only through service_role or an
-- authenticated admin session).

revoke select, insert, update, delete on table "public"."contacts" from "anon";
revoke select, insert, update, delete on table "public"."deals" from "anon";
revoke select, insert, update, delete on table "public"."tasks" from "anon";
