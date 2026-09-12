--
-- Grants
-- This file declares all grants and default privileges for the public schema.
--

-- Schema usage
grant usage on schema public to postgres;
grant usage on schema public to anon;
grant usage on schema public to authenticated;
grant usage on schema public to service_role;

-- Function grants
grant all on function public.cleanup_note_attachments() to anon;
grant all on function public.cleanup_note_attachments() to authenticated;
grant all on function public.cleanup_note_attachments() to service_role;

grant all on function public.get_avatar_for_email(text) to anon;
grant all on function public.get_avatar_for_email(text) to authenticated;
grant all on function public.get_avatar_for_email(text) to service_role;

grant all on function public.get_domain_favicon(text) to anon;
grant all on function public.get_domain_favicon(text) to authenticated;
grant all on function public.get_domain_favicon(text) to service_role;

grant all on function public.get_note_attachments_function_url() to anon;
grant all on function public.get_note_attachments_function_url() to authenticated;
grant all on function public.get_note_attachments_function_url() to service_role;

revoke all on function public.get_user_id_by_email(text) from public;
grant all on function public.get_user_id_by_email(text) to service_role;

grant all on function public.handle_company_saved() to anon;
grant all on function public.handle_company_saved() to authenticated;
grant all on function public.handle_company_saved() to service_role;

grant all on function public.handle_deal_saved() to anon;
grant all on function public.handle_deal_saved() to authenticated;
grant all on function public.handle_deal_saved() to service_role;

grant all on function public.handle_deal_won() to anon;
grant all on function public.handle_deal_won() to authenticated;
grant all on function public.handle_deal_won() to service_role;

grant all on function public.handle_contact_note_created_or_updated() to anon;
grant all on function public.handle_contact_note_created_or_updated() to authenticated;
grant all on function public.handle_contact_note_created_or_updated() to service_role;

grant all on function public.handle_contact_saved() to anon;
grant all on function public.handle_contact_saved() to authenticated;
grant all on function public.handle_contact_saved() to service_role;

grant all on function public.handle_new_user() to anon;
grant all on function public.handle_new_user() to authenticated;
grant all on function public.handle_new_user() to service_role;

grant all on function public.handle_update_user() to anon;
grant all on function public.handle_update_user() to authenticated;
grant all on function public.handle_update_user() to service_role;

grant all on function public.is_admin() to anon;
grant all on function public.is_admin() to authenticated;
grant all on function public.is_admin() to service_role;

grant all on function public.lowercase_email_jsonb() to anon;
grant all on function public.lowercase_email_jsonb() to authenticated;
grant all on function public.lowercase_email_jsonb() to service_role;

grant all on function public.merge_contacts(bigint, bigint) to anon;
grant all on function public.merge_contacts(bigint, bigint) to authenticated;
grant all on function public.merge_contacts(bigint, bigint) to service_role;

grant all on function public.set_sales_id_default() to anon;
grant all on function public.set_sales_id_default() to authenticated;
grant all on function public.set_sales_id_default() to service_role;

-- Application Intake Atomicity + Idempotency slice: reachable ONLY via
-- service_role, tighter than every other callable function above
-- (merge_contacts included) — this is the transactional primitive behind
-- the existing public /apply intake, not a new public capability. The
-- Edge Function (public_application/index.ts, already service_role-only)
-- remains the sole public entry point; anon/authenticated get nothing new.
revoke all on function public.submit_public_application(bigint, bigint, text, text, text, text, jsonb) from public;
revoke all on function public.submit_public_application(bigint, bigint, text, text, text, text, jsonb) from anon;
revoke all on function public.submit_public_application(bigint, bigint, text, text, text, text, jsonb) from authenticated;
grant all on function public.submit_public_application(bigint, bigint, text, text, text, text, jsonb) to service_role;

-- Table grants
grant all on table public.companies to anon;
grant all on table public.companies to authenticated;
grant all on table public.companies to service_role;
-- Narrowed for anon: same rationale as contacts below -- see
-- 20260911120000_remaining_anon_grant_drift.sql.
revoke select, insert, update, delete on table public.companies from anon;

grant all on table public.contacts to anon;
grant all on table public.contacts to authenticated;
grant all on table public.contacts to service_role;
-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- (05_policies.sql), and nothing in the app touches contacts through the
-- anon role (public_application uses service_role) -- see
-- 20260902020000_contacts_deals_tasks_anon_grant_drift.sql for why this
-- exists as an explicit revoke rather than simply not granting "all".
revoke select, insert, update, delete on table public.contacts from anon;

grant all on table public.contact_notes to anon;
grant all on table public.contact_notes to authenticated;
grant all on table public.contact_notes to service_role;
-- Narrowed for anon: same rationale as contacts above.
revoke select, insert, update, delete on table public.contact_notes from anon;

grant all on table public.deals to anon;
grant all on table public.deals to authenticated;
grant all on table public.deals to service_role;
-- Narrowed for anon: same rationale as contacts above.
revoke select, insert, update, delete on table public.deals from anon;

grant all on table public.deal_notes to anon;
grant all on table public.deal_notes to authenticated;
grant all on table public.deal_notes to service_role;
-- Narrowed for anon: same rationale as contacts above.
revoke select, insert, update, delete on table public.deal_notes from anon;

grant all on table public.sales to anon;
grant all on table public.sales to authenticated;
grant all on table public.sales to service_role;
-- Narrowed for anon: same rationale as contacts above.
revoke select, insert, update, delete on table public.sales from anon;

grant all on table public.tags to anon;
grant all on table public.tags to authenticated;
grant all on table public.tags to service_role;
-- Narrowed for anon: same rationale as contacts above.
revoke select, insert, update, delete on table public.tags from anon;

grant all on table public.tasks to anon;
grant all on table public.tasks to authenticated;
grant all on table public.tasks to service_role;
-- Narrowed for anon: same rationale as contacts above.
revoke select, insert, update, delete on table public.tasks from anon;

grant all on table public.configuration to anon;
grant all on table public.configuration to authenticated;
grant all on table public.configuration to service_role;
-- Narrowed for anon: same rationale as contacts above.
revoke select, insert, update, delete on table public.configuration from anon;
-- Narrowed for authenticated/service_role: configuration is a structural
-- singleton meant to be updated in place, never deleted -- its own creating
-- migration (20260211194545_app_configuration.sql) only ever granted
-- select/insert/update to these roles, and there is no DELETE RLS policy
-- for anyone. See 20260911140000_configuration_delete_grant_drift.sql for
-- the full investigation.
revoke delete on table public.configuration from authenticated;
revoke delete on table public.configuration from service_role;

grant all on table public.favicons_excluded_domains to anon;
grant all on table public.favicons_excluded_domains to authenticated;
grant all on table public.favicons_excluded_domains to service_role;
-- Narrowed for anon: same rationale as contacts above.
revoke select, insert, update, delete on table public.favicons_excluded_domains from anon;

grant all on table public.offers to anon;
grant all on table public.offers to authenticated;
grant all on table public.offers to service_role;

grant all on table public.offer_payment_options to anon;
grant all on table public.offer_payment_options to authenticated;
grant all on table public.offer_payment_options to service_role;

grant all on table public.cohorts to anon;
grant all on table public.cohorts to authenticated;
grant all on table public.cohorts to service_role;

grant all on table public.applications to anon;
grant all on table public.applications to authenticated;
grant all on table public.applications to service_role;

grant all on table public.enrollments to anon;
grant all on table public.enrollments to authenticated;
grant all on table public.enrollments to service_role;

grant all on table public.onboarding_requirement_templates to anon;
grant all on table public.onboarding_requirement_templates to authenticated;
grant all on table public.onboarding_requirement_templates to service_role;

grant all on table public.enrollment_onboarding_items to anon;
grant all on table public.enrollment_onboarding_items to authenticated;
grant all on table public.enrollment_onboarding_items to service_role;

grant all on table public.offboarding_requirement_templates to anon;
grant all on table public.offboarding_requirement_templates to authenticated;
grant all on table public.offboarding_requirement_templates to service_role;

grant all on table public.enrollment_offboarding_items to anon;
grant all on table public.enrollment_offboarding_items to authenticated;
grant all on table public.enrollment_offboarding_items to service_role;

grant all on table public.enrollment_status_events to anon;
grant all on table public.enrollment_status_events to authenticated;
grant all on table public.enrollment_status_events to service_role;

grant all on table public.scholarship_slots to anon;
grant all on table public.scholarship_slots to authenticated;
grant all on table public.scholarship_slots to service_role;

grant all on table public.scholarship_slot_events to anon;
grant all on table public.scholarship_slot_events to authenticated;
grant all on table public.scholarship_slot_events to service_role;

grant all on table public.waitlist_entries to anon;
grant all on table public.waitlist_entries to authenticated;
grant all on table public.waitlist_entries to service_role;

grant all on table public.sales_calls to anon;
grant all on table public.sales_calls to authenticated;
grant all on table public.sales_calls to service_role;

grant all on table public.sales_call_events to anon;
grant all on table public.sales_call_events to authenticated;
grant all on table public.sales_call_events to service_role;

grant all on table public.client_sessions to anon;
grant all on table public.client_sessions to authenticated;
grant all on table public.client_sessions to service_role;

grant all on table public.client_session_events to anon;
grant all on table public.client_session_events to authenticated;
grant all on table public.client_session_events to service_role;

grant all on table public.expected_session_windows to anon;
grant all on table public.expected_session_windows to authenticated;
grant all on table public.expected_session_windows to service_role;

grant all on table public.enrollment_expected_sessions to anon;
grant all on table public.enrollment_expected_sessions to authenticated;
grant all on table public.enrollment_expected_sessions to service_role;

grant all on table public.client_session_cadence_issues to anon;
grant all on table public.client_session_cadence_issues to authenticated;
grant all on table public.client_session_cadence_issues to service_role;

grant all on table public.client_session_cadence_issue_events to anon;
grant all on table public.client_session_cadence_issue_events to authenticated;
grant all on table public.client_session_cadence_issue_events to service_role;

grant all on table public.deal_stage_events to anon;
grant all on table public.deal_stage_events to authenticated;
grant all on table public.deal_stage_events to service_role;

-- View grants
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

-- Sequence grants
grant all on sequence public.companies_id_seq to anon;
grant all on sequence public.companies_id_seq to authenticated;
grant all on sequence public.companies_id_seq to service_role;

grant all on sequence public."contactNotes_id_seq" to anon;
grant all on sequence public."contactNotes_id_seq" to authenticated;
grant all on sequence public."contactNotes_id_seq" to service_role;

grant all on sequence public.contacts_id_seq to anon;
grant all on sequence public.contacts_id_seq to authenticated;
grant all on sequence public.contacts_id_seq to service_role;

grant all on sequence public."dealNotes_id_seq" to anon;
grant all on sequence public."dealNotes_id_seq" to authenticated;
grant all on sequence public."dealNotes_id_seq" to service_role;

grant all on sequence public.deals_id_seq to anon;
grant all on sequence public.deals_id_seq to authenticated;
grant all on sequence public.deals_id_seq to service_role;

grant all on sequence public.favicons_excluded_domains_id_seq to anon;
grant all on sequence public.favicons_excluded_domains_id_seq to authenticated;
grant all on sequence public.favicons_excluded_domains_id_seq to service_role;

grant all on sequence public.sales_id_seq to anon;
grant all on sequence public.sales_id_seq to authenticated;
grant all on sequence public.sales_id_seq to service_role;

grant all on sequence public.tags_id_seq to anon;
grant all on sequence public.tags_id_seq to authenticated;
grant all on sequence public.tags_id_seq to service_role;

grant all on sequence public.tasks_id_seq to anon;
grant all on sequence public.tasks_id_seq to authenticated;
grant all on sequence public.tasks_id_seq to service_role;

grant all on sequence public.offers_id_seq to anon;
grant all on sequence public.offers_id_seq to authenticated;
grant all on sequence public.offers_id_seq to service_role;

grant all on sequence public.offer_payment_options_id_seq to anon;
grant all on sequence public.offer_payment_options_id_seq to authenticated;
grant all on sequence public.offer_payment_options_id_seq to service_role;

grant all on sequence public.cohorts_id_seq to anon;
grant all on sequence public.cohorts_id_seq to authenticated;
grant all on sequence public.cohorts_id_seq to service_role;

grant all on sequence public.applications_id_seq to anon;
grant all on sequence public.applications_id_seq to authenticated;
grant all on sequence public.applications_id_seq to service_role;

grant all on sequence public.enrollments_id_seq to anon;
grant all on sequence public.enrollments_id_seq to authenticated;
grant all on sequence public.enrollments_id_seq to service_role;

grant all on sequence public.onboarding_requirement_templates_id_seq to anon;
grant all on sequence public.onboarding_requirement_templates_id_seq to authenticated;
grant all on sequence public.onboarding_requirement_templates_id_seq to service_role;

grant all on sequence public.enrollment_onboarding_items_id_seq to anon;
grant all on sequence public.enrollment_onboarding_items_id_seq to authenticated;
grant all on sequence public.enrollment_onboarding_items_id_seq to service_role;

grant all on sequence public.offboarding_requirement_templates_id_seq to anon;
grant all on sequence public.offboarding_requirement_templates_id_seq to authenticated;
grant all on sequence public.offboarding_requirement_templates_id_seq to service_role;

grant all on sequence public.enrollment_offboarding_items_id_seq to anon;
grant all on sequence public.enrollment_offboarding_items_id_seq to authenticated;
grant all on sequence public.enrollment_offboarding_items_id_seq to service_role;

grant all on sequence public.enrollment_status_events_id_seq to anon;
grant all on sequence public.enrollment_status_events_id_seq to authenticated;
grant all on sequence public.enrollment_status_events_id_seq to service_role;

grant all on sequence public.scholarship_slot_events_id_seq to anon;
grant all on sequence public.scholarship_slot_events_id_seq to authenticated;
grant all on sequence public.scholarship_slot_events_id_seq to service_role;

grant all on sequence public.scholarship_slots_id_seq to anon;
grant all on sequence public.scholarship_slots_id_seq to authenticated;
grant all on sequence public.scholarship_slots_id_seq to service_role;

grant all on sequence public.waitlist_entries_id_seq to anon;
grant all on sequence public.waitlist_entries_id_seq to authenticated;
grant all on sequence public.waitlist_entries_id_seq to service_role;

grant all on sequence public.sales_calls_id_seq to anon;
grant all on sequence public.sales_calls_id_seq to authenticated;
grant all on sequence public.sales_calls_id_seq to service_role;

grant all on sequence public.sales_call_events_id_seq to anon;
grant all on sequence public.sales_call_events_id_seq to authenticated;
grant all on sequence public.sales_call_events_id_seq to service_role;

grant all on sequence public.client_sessions_id_seq to anon;
grant all on sequence public.client_sessions_id_seq to authenticated;
grant all on sequence public.client_sessions_id_seq to service_role;

grant all on sequence public.client_session_events_id_seq to anon;
grant all on sequence public.client_session_events_id_seq to authenticated;
grant all on sequence public.client_session_events_id_seq to service_role;

grant all on sequence public.expected_session_windows_id_seq to anon;
grant all on sequence public.expected_session_windows_id_seq to authenticated;
grant all on sequence public.expected_session_windows_id_seq to service_role;

grant all on sequence public.enrollment_expected_sessions_id_seq to anon;
grant all on sequence public.enrollment_expected_sessions_id_seq to authenticated;
grant all on sequence public.enrollment_expected_sessions_id_seq to service_role;

grant all on sequence public.client_session_cadence_issues_id_seq to anon;
grant all on sequence public.client_session_cadence_issues_id_seq to authenticated;
grant all on sequence public.client_session_cadence_issues_id_seq to service_role;

grant all on sequence public.client_session_cadence_issue_events_id_seq to anon;
grant all on sequence public.client_session_cadence_issue_events_id_seq to authenticated;
grant all on sequence public.client_session_cadence_issue_events_id_seq to service_role;

grant all on sequence public.deal_stage_events_id_seq to anon;
grant all on sequence public.deal_stage_events_id_seq to authenticated;
grant all on sequence public.deal_stage_events_id_seq to service_role;

-- Default privileges
alter default privileges for role postgres in schema public grant all on sequences to postgres;
alter default privileges for role postgres in schema public grant all on sequences to anon;
alter default privileges for role postgres in schema public grant all on sequences to authenticated;
alter default privileges for role postgres in schema public grant all on sequences to service_role;

alter default privileges for role postgres in schema public grant all on functions to postgres;
alter default privileges for role postgres in schema public grant all on functions to anon;
alter default privileges for role postgres in schema public grant all on functions to authenticated;
alter default privileges for role postgres in schema public grant all on functions to service_role;

alter default privileges for role postgres in schema public grant all on tables to postgres;
alter default privileges for role postgres in schema public grant all on tables to anon;
alter default privileges for role postgres in schema public grant all on tables to authenticated;
alter default privileges for role postgres in schema public grant all on tables to service_role;
