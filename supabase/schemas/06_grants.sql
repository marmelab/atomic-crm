--
-- Grants
-- This file declares all grants and default privileges for the public schema.
--

-- Schema usage
-- Note: anon retains USAGE on the schema (required so PostgREST can resolve
-- relation names) but never receives privileges on the relations themselves.
-- See migrations/20260408120000_enforce_rls_security.sql.
grant usage on schema public to postgres;
grant usage on schema public to anon;
grant usage on schema public to authenticated;
grant usage on schema public to service_role;

-- Function grants
-- The anon role is never granted EXECUTE: triggers fire under the role that
-- performed the DML, which is `authenticated` in normal operation, and edge
-- functions run as `service_role`. Internal trigger functions therefore only
-- need to be reachable from authenticated/service_role.
grant all on function public.cleanup_note_attachments() to authenticated;
grant all on function public.cleanup_note_attachments() to service_role;

grant all on function public.get_avatar_for_email(text) to authenticated;
grant all on function public.get_avatar_for_email(text) to service_role;

grant all on function public.get_domain_favicon(text) to authenticated;
grant all on function public.get_domain_favicon(text) to service_role;

grant all on function public.get_note_attachments_function_url() to authenticated;
grant all on function public.get_note_attachments_function_url() to service_role;

revoke all on function public.get_user_id_by_email(text) from public;
grant all on function public.get_user_id_by_email(text) to service_role;

grant all on function public.handle_company_saved() to authenticated;
grant all on function public.handle_company_saved() to service_role;

grant all on function public.handle_contact_note_created_or_updated() to authenticated;
grant all on function public.handle_contact_note_created_or_updated() to service_role;

grant all on function public.handle_contact_saved() to authenticated;
grant all on function public.handle_contact_saved() to service_role;

grant all on function public.handle_new_user() to authenticated;
grant all on function public.handle_new_user() to service_role;

grant all on function public.handle_update_user() to authenticated;
grant all on function public.handle_update_user() to service_role;

grant all on function public.is_admin() to authenticated;
grant all on function public.is_admin() to service_role;

grant all on function public.merge_contacts(bigint, bigint) to authenticated;
grant all on function public.merge_contacts(bigint, bigint) to service_role;

grant all on function public.set_sales_id_default() to authenticated;
grant all on function public.set_sales_id_default() to service_role;

-- Table grants
-- The anon role intentionally receives NO table privileges. Browser clients
-- authenticate before reading data; unauthenticated public access is blocked
-- both at the privilege layer and by the `deny_anon_all` RLS policy declared
-- in migrations/20260408120000_enforce_rls_security.sql.
grant all on table public.companies to authenticated;
grant all on table public.companies to service_role;

grant all on table public.contacts to authenticated;
grant all on table public.contacts to service_role;

grant all on table public.contact_notes to authenticated;
grant all on table public.contact_notes to service_role;

grant all on table public.deals to authenticated;
grant all on table public.deals to service_role;

grant all on table public.deal_notes to authenticated;
grant all on table public.deal_notes to service_role;

grant all on table public.sales to authenticated;
grant all on table public.sales to service_role;

grant all on table public.tags to authenticated;
grant all on table public.tags to service_role;

grant all on table public.tasks to authenticated;
grant all on table public.tasks to service_role;

grant all on table public.configuration to authenticated;
grant all on table public.configuration to service_role;

grant all on table public.favicons_excluded_domains to authenticated;
grant all on table public.favicons_excluded_domains to service_role;

-- View grants
grant all on table public.activity_log to authenticated;
grant all on table public.activity_log to service_role;

grant all on table public.companies_summary to authenticated;
grant all on table public.companies_summary to service_role;

grant all on table public.contacts_summary to authenticated;
grant all on table public.contacts_summary to service_role;

grant all on table public.deals_summary to authenticated;
grant all on table public.deals_summary to service_role;

grant all on table public.init_state to authenticated;
grant all on table public.init_state to service_role;

-- Sequence grants
grant all on sequence public.companies_id_seq to authenticated;
grant all on sequence public.companies_id_seq to service_role;

grant all on sequence public."contactNotes_id_seq" to authenticated;
grant all on sequence public."contactNotes_id_seq" to service_role;

grant all on sequence public.contacts_id_seq to authenticated;
grant all on sequence public.contacts_id_seq to service_role;

grant all on sequence public."dealNotes_id_seq" to authenticated;
grant all on sequence public."dealNotes_id_seq" to service_role;

grant all on sequence public.deals_id_seq to authenticated;
grant all on sequence public.deals_id_seq to service_role;

grant all on sequence public.favicons_excluded_domains_id_seq to authenticated;
grant all on sequence public.favicons_excluded_domains_id_seq to service_role;

grant all on sequence public.sales_id_seq to authenticated;
grant all on sequence public.sales_id_seq to service_role;

grant all on sequence public.tags_id_seq to authenticated;
grant all on sequence public.tags_id_seq to service_role;

grant all on sequence public.tasks_id_seq to authenticated;
grant all on sequence public.tasks_id_seq to service_role;

-- Default privileges
-- New tables / sequences / functions never auto-grant anything to anon.
alter default privileges for role postgres in schema public grant all on sequences to postgres;
alter default privileges for role postgres in schema public grant all on sequences to authenticated;
alter default privileges for role postgres in schema public grant all on sequences to service_role;

alter default privileges for role postgres in schema public grant all on functions to postgres;
alter default privileges for role postgres in schema public grant all on functions to authenticated;
alter default privileges for role postgres in schema public grant all on functions to service_role;

alter default privileges for role postgres in schema public grant all on tables to postgres;
alter default privileges for role postgres in schema public grant all on tables to authenticated;
alter default privileges for role postgres in schema public grant all on tables to service_role;
