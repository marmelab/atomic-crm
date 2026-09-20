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

-- Contact identity safety rails, 20260918330000: callable by nobody but
-- the owner. This function repoints only tasks, contact_notes and deals
-- and then deletes the losing Contact, so calling it destroys client
-- sessions, Stripe identities, sales calls and waitlist entries through
-- the foreign keys. PUBLIC is revoked explicitly because a function with
-- no ACL defaults to EXECUTE for PUBLIC — revoking anon and authenticated
-- alone would change nothing. Every real merge to date was a deliberate
-- SQL migration run as the owner, which is the access this leaves.
revoke all on function public.merge_contacts(bigint, bigint) from public;
revoke all on function public.merge_contacts(bigint, bigint) from anon;
revoke all on function public.merge_contacts(bigint, bigint) from authenticated;
revoke all on function public.merge_contacts(bigint, bigint) from service_role;

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
-- Contact identity safety rails, 20260918330000: authenticated keeps read,
-- insert and update, and loses DELETE. Deleting a Contact cascades into
-- client_sessions, contact_notes, contact_stripe_customers, deals,
-- sales_calls, tasks and waitlist_entries. service_role keeps it: that is
-- the role the recovery and import tooling runs as.
revoke delete on table public.contacts from authenticated;

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

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.offers from anon;

grant all on table public.offer_payment_options to anon;
grant all on table public.offer_payment_options to authenticated;
grant all on table public.offer_payment_options to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.offer_payment_options from anon;

grant all on table public.cohorts to anon;
grant all on table public.cohorts to authenticated;
grant all on table public.cohorts to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.cohorts from anon;

grant all on table public.applications to anon;
grant all on table public.applications to authenticated;
grant all on table public.applications to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.applications from anon;

grant all on table public.enrollments to anon;
grant all on table public.enrollments to authenticated;
grant all on table public.enrollments to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.enrollments from anon;

grant all on table public.onboarding_requirement_templates to anon;
grant all on table public.onboarding_requirement_templates to authenticated;
grant all on table public.onboarding_requirement_templates to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.onboarding_requirement_templates from anon;

grant all on table public.deal_payment_schedule_items to authenticated;
grant all on table public.deal_payment_schedule_items to service_role;
grant all on table public.enrollment_onboarding_items to anon;
grant all on table public.enrollment_onboarding_items to authenticated;
grant all on table public.enrollment_onboarding_items to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.enrollment_onboarding_items from anon;

grant all on table public.offboarding_requirement_templates to anon;
grant all on table public.offboarding_requirement_templates to authenticated;
grant all on table public.offboarding_requirement_templates to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.offboarding_requirement_templates from anon;

grant all on table public.enrollment_offboarding_items to anon;
grant all on table public.enrollment_offboarding_items to authenticated;
grant all on table public.enrollment_offboarding_items to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.enrollment_offboarding_items from anon;

grant all on table public.enrollment_status_events to anon;
grant all on table public.enrollment_status_events to authenticated;
grant all on table public.enrollment_status_events to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.enrollment_status_events from anon;

grant all on table public.scholarship_slots to anon;
grant all on table public.scholarship_slots to authenticated;
grant all on table public.scholarship_slots to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.scholarship_slots from anon;

grant all on table public.scholarship_slot_events to anon;
grant all on table public.scholarship_slot_events to authenticated;
grant all on table public.scholarship_slot_events to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.scholarship_slot_events from anon;

grant all on table public.waitlist_entries to anon;
grant all on table public.waitlist_entries to authenticated;
grant all on table public.waitlist_entries to service_role;
grant all on table public.waitlist_invitation_batches to authenticated;
grant all on table public.waitlist_invitation_batches to service_role;
grant all on table public.waitlist_invitations to authenticated;
grant all on table public.waitlist_invitations to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.waitlist_entries from anon;
revoke select, insert, update, delete on table public.waitlist_invitation_batches from anon;
revoke select, insert, update, delete on table public.waitlist_invitations from anon;

grant all on table public.sales_calls to anon;
grant all on table public.sales_calls to authenticated;
grant all on table public.sales_calls to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.sales_calls from anon;

grant all on table public.sales_call_events to anon;
grant all on table public.sales_call_events to authenticated;
grant all on table public.sales_call_events to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.sales_call_events from anon;

grant all on table public.client_sessions to anon;
grant all on table public.client_sessions to authenticated;
grant all on table public.client_sessions to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.client_sessions from anon;

grant all on table public.client_session_events to anon;
grant all on table public.client_session_events to authenticated;
grant all on table public.client_session_events to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.client_session_events from anon;

grant all on table public.expected_session_windows to anon;
grant all on table public.expected_session_windows to authenticated;
grant all on table public.expected_session_windows to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.expected_session_windows from anon;

grant all on table public.enrollment_expected_sessions to anon;
grant all on table public.enrollment_expected_sessions to authenticated;
grant all on table public.enrollment_expected_sessions to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.enrollment_expected_sessions from anon;

grant all on table public.client_session_cadence_issues to anon;
grant all on table public.client_session_cadence_issues to authenticated;
grant all on table public.client_session_cadence_issues to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.client_session_cadence_issues from anon;

grant all on table public.client_session_cadence_issue_events to anon;
grant all on table public.client_session_cadence_issue_events to authenticated;
grant all on table public.client_session_cadence_issue_events to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.client_session_cadence_issue_events from anon;

grant all on table public.deal_stage_events to anon;
grant all on table public.deal_stage_events to authenticated;
grant all on table public.deal_stage_events to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.deal_stage_events from anon;

-- View grants
grant all on table public.activity_log to anon;
grant all on table public.activity_log to authenticated;
grant all on table public.activity_log to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.activity_log from anon;

grant all on table public.companies_summary to anon;
grant all on table public.companies_summary to authenticated;
grant all on table public.companies_summary to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.companies_summary from anon;

grant all on table public.contacts_summary to anon;
grant all on table public.contacts_summary to authenticated;
grant all on table public.contacts_summary to service_role;

-- Narrowed for anon: RLS already restricts all access to `authenticated`
-- only (see 05_policies.sql) and nothing in the app -- including every
-- public Edge Function -- reads or writes this table through the anon
-- role, only through service_role. See 20260913230000_anon_table_grant_hardening.sql.
revoke select, insert, update, delete on table public.contacts_summary from anon;

grant all on table public.init_state to anon;
grant all on table public.init_state to authenticated;
grant all on table public.init_state to service_role;

-- init_state is security_invoker = off (see 03_views.sql), so unlike
-- every other view/table above it does NOT inherit anon's RLS block --
-- SELECT is a genuine, load-bearing anon dependency: the pre-login "is
-- this CRM initialized yet" check the app performs before any user
-- exists to log in. Kept deliberately. insert/update/delete are narrowed
-- for completeness -- structurally inert on this count() aggregate view
-- regardless, but removed rather than left as unused surface. See 20260913230000_anon_table_grant_hardening.sql.
revoke insert, update, delete on table public.init_state from anon;

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
-- Anon is deliberately absent from all three blocks below (narrowed by
-- 20260913230000_anon_table_grant_hardening.sql): this is the exact
-- mechanism that silently re-granted every table/sequence/function to
-- anon by default the moment it was created, which is why so many tables
-- ended up with an unrevoked "grant all ... to anon" in the first place
-- (and why submit_public_application() needed its own explicit revoke —
-- see that function's own grant block above — despite never having been
-- explicitly granted to anon anywhere). A future table/function that
-- genuinely needs anon access still can — just explicitly, in its own
-- migration, the same way every other deliberate anon grant in this file
-- already is.
-- Sequences and functions are narrowed to owner-only
-- (20260920120000_security_posture_covers_sequences_and_functions.sql), the
-- other half of the hardening MAIN carried without the repository knowing.
-- A rebuilt database was handing clients UPDATE on 23 sequences and EXECUTE
-- on five privileged functions — merging contacts, writing external
-- identity, and the three reconcilers — none of which a browser may call on
-- MAIN. Anything a client genuinely needs is granted explicitly, in the
-- migration that knows why.
alter default privileges for role postgres in schema public grant all on sequences to postgres;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public grant all on functions to postgres;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role;

-- Tables are narrowed further (20260919175000_security_posture_is_deterministic.sql).
-- MAIN had this hardening applied by hand and it was never written down, so
-- replaying this chain into an empty database produced a materially more
-- permissive result than production: 23 over-grants across 12 relations,
-- including client INSERT on the outcome audit trail. A table now arrives
-- with no read or write for any client role and must be granted what it
-- needs explicitly, which is what every recent migration already does.
-- TRUNCATE/REFERENCES/TRIGGER (and MAINTAIN from PG16) are what MAIN keeps.
alter default privileges for role postgres in schema public grant all on tables to postgres;
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant truncate, references, trigger on tables to authenticated, service_role;

-- Historical Migration slice: historical_import_records is never meant to be
-- reached by anon/authenticated at all (RLS above already enables it with
-- zero policies, which alone denies every row to both) — these explicit
-- revokes document that intent directly rather than relying on RLS silently.
revoke select, insert, update, delete on table public.historical_import_records from anon;
revoke select, insert, update, delete on table public.historical_import_records from authenticated;

-- set_historical_migration_mode() is the one deliberately narrow entry
-- point that may set app.migration_mode for the current transaction — see
-- its own header. Same restriction pattern as the existing
-- get_user_id_by_email() precedent above: revoke the ALTER DEFAULT
-- PRIVILEGES grant this function would otherwise inherit, leave only
-- service_role able to call it.
revoke all on function public.set_historical_migration_mode(boolean) from public;
revoke all on function public.set_historical_migration_mode(boolean) from authenticated;
grant all on function public.set_historical_migration_mode(boolean) to service_role;

-- =====================================================================
-- Declarative-schema reconciliation, 2026-09-18
-- =====================================================================
-- Grants for the tables migrations added. Each posture below is what MAIN
-- actually has and was verified against it, not a default copied from a
-- neighbouring table — the two grant-drift incidents this repo already
-- fixed (20260902020000, 20260911120000) both started as a blanket
-- "grant all" that nobody meant.

-- Acuity appointment-type map: ordinary authenticated CRUD.
grant all on table public.acuity_appointment_type_map to authenticated;
grant all on table public.acuity_appointment_type_map to service_role;
revoke select, insert, update, delete on table public.acuity_appointment_type_map from anon;

-- Stripe identity and plan history: readable and writable by the app, and
-- never deletable — a Stripe identity or plan object is history.
grant select, insert, update on table public.contact_stripe_customers to authenticated;
grant select, insert, update on table public.contact_stripe_customers to service_role;
revoke select, insert, update, delete on table public.contact_stripe_customers from anon;

grant select, insert, update on table public.deal_stripe_plan_objects to authenticated;
grant select, insert, update on table public.deal_stripe_plan_objects to service_role;
revoke select, insert, update, delete on table public.deal_stripe_plan_objects from anon;

-- Outcome history is append-only and written by a trigger, so nobody the
-- browser can become needs any privilege on it at all.
revoke select, insert, update, delete on table public.deal_outcome_events from anon;
revoke select, insert, update, delete on table public.deal_outcome_events from authenticated;
revoke select, insert, update, delete on table public.deal_outcome_events from service_role;

-- Historical Application source snapshots hold real applicant PII. RLS is
-- enabled with ZERO policies (05_policies.sql declares no policy for it)
-- and every grant is revoked, including service_role — which bypasses RLS
-- and would therefore undo the lock. Owner only.
revoke all on table public.historical_application_source_snapshots from public;
revoke all on table public.historical_application_source_snapshots from anon;
revoke all on table public.historical_application_source_snapshots from authenticated;
revoke all on table public.historical_application_source_snapshots from service_role;

grant select on public.enrollments_missing_onboarding to authenticated;

grant select on public.application_responses to authenticated;
revoke all on public.application_responses from anon;
grant select on public.application_form_versions to authenticated;
grant select on public.application_form_questions to authenticated;
revoke all on public.application_form_versions from anon;
revoke all on public.application_form_questions from anon;

grant select on public.applications_awaiting_review to authenticated;

grant select on public.contact_external_identities to authenticated;
revoke all on public.contact_external_identities from anon;
grant select on public.contact_merges to authenticated;
revoke all on public.contact_merges from anon;
grant select on public.contact_email_addresses to authenticated;
