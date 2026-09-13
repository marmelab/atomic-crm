-- Anon table-grant hardening slice (Application Intake adversarial-review
-- follow-up): 25 tables plus the init_state view still carried unconditional
-- "grant all ... to anon" in 06_grants.sql with no matching revoke anywhere
-- in migration history -- the same drift class already recorded twice
-- before for a different set of tables (20260902020000_contacts_deals_tasks_
-- anon_grant_drift.sql, 20260911120000_remaining_anon_grant_drift.sql).
--
-- Verified directly against MAIN before writing this: every one of these
-- tables already has row level security enabled with policies scoped
-- `to authenticated` only (see 05_policies.sql) -- anon has no policy on any
-- of them, so no anon session can read or write a single row today
-- regardless of the table-level grant. Also verified directly: the public
-- application flow (src/components/atomic-crm/providers/supabase/
-- publicApplicationDataSource.ts) calls the public_application Edge
-- Function exclusively (browser -> Edge Function -> supabaseAdmin/
-- service_role) -- it never issues a direct anon-authenticated table
-- request for offers, cohorts, applications, enrollments, waitlist_entries,
-- or any other table narrowed here. The same is true of every other public
-- Edge Function (offer_page, stripe_checkout, stripe_webhook), all
-- previously audited to use supabaseAdmin exclusively. No public browser
-- feature depends on any of these anon table grants.
--
-- No application behavior changes: RLS was and remains the enforced
-- boundary. This migration and the matching 06_grants.sql update simply
-- record the narrower, safer reality in version control, closing the
-- defense-in-depth gap before real client data is authorized.
--
-- Root cause, also closed here: "alter default privileges ... grant all
-- on {tables,sequences,functions} ... to anon" (06_grants.sql) is what
-- silently re-grants anon on every NEW table/sequence/function the
-- moment it's created -- the exact mechanism that produced every drifted
-- grant above, across three separate migrations now, and the reason
-- submit_public_application() needed its own explicit revoke despite
-- never being explicitly granted to anon anywhere (Application Intake
-- slice). Revoked below so future migrations stop reintroducing this
-- class of drift; a future table/function that genuinely needs anon
-- access still can, explicitly, the same way every deliberate anon grant
-- in this file already is.
--
-- init_state is the one deliberate exception: it's a
-- `security_invoker = off` view (03_views.sql), so unlike every other
-- table/view here it does NOT inherit anon's RLS block -- its SELECT is a
-- genuine, load-bearing anon dependency (the pre-login "is this CRM
-- initialized yet" check the app performs before any user exists to log
-- in, confirmed live in production request logs: GET /rest/v1/init_state
-- ?select=is_initialized). SELECT is deliberately preserved; only
-- insert/update/delete are narrowed (structurally inert on this count()
-- aggregate view regardless, but removed rather than left as unused
-- surface).
--
-- Hand-written, not CLI-generated: this sandbox has no Docker/Podman, so
-- `supabase db diff` cannot spin up its shadow database (same constraint
-- as every other hand-written migration this project has needed). Every
-- statement below matches supabase/schemas/06_grants.sql exactly.

revoke select, insert, update, delete on table "public"."applications" from "anon";
revoke select, insert, update, delete on table "public"."enrollments" from "anon";
revoke select, insert, update, delete on table "public"."onboarding_requirement_templates" from "anon";
revoke select, insert, update, delete on table "public"."enrollment_onboarding_items" from "anon";
revoke select, insert, update, delete on table "public"."offboarding_requirement_templates" from "anon";
revoke select, insert, update, delete on table "public"."enrollment_offboarding_items" from "anon";
revoke select, insert, update, delete on table "public"."enrollment_status_events" from "anon";
revoke select, insert, update, delete on table "public"."scholarship_slots" from "anon";
revoke select, insert, update, delete on table "public"."scholarship_slot_events" from "anon";
revoke select, insert, update, delete on table "public"."waitlist_entries" from "anon";
revoke select, insert, update, delete on table "public"."sales_calls" from "anon";
revoke select, insert, update, delete on table "public"."sales_call_events" from "anon";
revoke select, insert, update, delete on table "public"."client_sessions" from "anon";
revoke select, insert, update, delete on table "public"."client_session_events" from "anon";
revoke select, insert, update, delete on table "public"."expected_session_windows" from "anon";
revoke select, insert, update, delete on table "public"."enrollment_expected_sessions" from "anon";
revoke select, insert, update, delete on table "public"."client_session_cadence_issues" from "anon";
revoke select, insert, update, delete on table "public"."client_session_cadence_issue_events" from "anon";
revoke select, insert, update, delete on table "public"."deal_stage_events" from "anon";
revoke select, insert, update, delete on table "public"."activity_log" from "anon";
revoke select, insert, update, delete on table "public"."companies_summary" from "anon";
revoke select, insert, update, delete on table "public"."contacts_summary" from "anon";
revoke select, insert, update, delete on table "public"."offers" from "anon";
revoke select, insert, update, delete on table "public"."offer_payment_options" from "anon";
revoke select, insert, update, delete on table "public"."cohorts" from "anon";

revoke insert, update, delete on table "public"."init_state" from "anon";

alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
