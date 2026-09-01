-- Native Application Intake slice: the public application form is a new
-- Entry Path distinct from every existing value ('instagram_conversation',
-- 'sales_page', 'other') — none of those correctly describe "the applicant
-- filled out the native public form". Adds 'application_form' to the
-- existing entry_path enum rather than inventing a new column: entry_path
-- already exists for exactly this purpose (§9: never conflate Entry Path
-- with Lead Source).
--
-- Hand-authored (no local Postgres/Docker available in the session that
-- wrote this migration to run `supabase db diff` against) — mirrors the
-- declarative schema change in supabase/schemas/01_tables.sql exactly.
-- Verify with `npx supabase db diff --local` before trusting this file
-- blindly in an environment where that's possible.

ALTER TABLE "public"."deals"
    DROP CONSTRAINT "deals_entry_path_check";

ALTER TABLE "public"."deals"
    ADD CONSTRAINT "deals_entry_path_check" CHECK (entry_path IN ('instagram_conversation', 'sales_page', 'application_form', 'other'));
