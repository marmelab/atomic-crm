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

revoke all on function public.save_company_with_contacts(bigint, jsonb, jsonb) from public, anon;
grant all on function public.save_company_with_contacts(bigint, jsonb, jsonb) to authenticated;
grant all on function public.save_company_with_contacts(bigint, jsonb, jsonb) to service_role;

grant all on function public.set_sales_id_default() to anon;
grant all on function public.set_sales_id_default() to authenticated;
grant all on function public.set_sales_id_default() to service_role;

-- Table grants
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

revoke all on table public.user_invitations from anon, authenticated;
grant all on table public.user_invitations to service_role;

-- View grants
grant all on table public.activity_log to authenticated;
grant all on table public.activity_log to service_role;

grant all on table public.companies_summary to authenticated;
grant all on table public.companies_summary to service_role;

grant all on table public.contacts_summary to authenticated;
grant all on table public.contacts_summary to service_role;

grant all on table public.init_state to anon;
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

-- No default privileges: every new table, view, sequence or function must
-- declare its grants explicitly in the migration that creates it.

-- Lead calling foundation. anon gets nothing: only init_state stays readable
-- before login.
grant all on table public.import_batches to authenticated;
grant all on table public.import_batches to service_role;
grant all on sequence public.import_batches_id_seq to authenticated;
grant all on sequence public.import_batches_id_seq to service_role;

grant all on table public.brochures to authenticated;
grant all on table public.brochures to service_role;
grant all on sequence public.brochures_id_seq to authenticated;
grant all on sequence public.brochures_id_seq to service_role;
revoke all on table public.brochures from anon;
revoke all on sequence public.brochures_id_seq from anon;

grant all on function public.crm_role() to authenticated;
grant all on function public.crm_role() to service_role;
grant all on function public.current_sales_id() to authenticated;
grant all on function public.current_sales_id() to service_role;
grant all on function public.is_manager() to authenticated;
grant all on function public.is_manager() to service_role;
grant all on function public.can_see_company(bigint) to authenticated;
grant all on function public.can_see_company(bigint) to service_role;
grant all on function public.call_engine_settings() to authenticated;
grant all on function public.call_engine_settings() to service_role;
revoke all on function public.import_leads(text, jsonb) from public, anon;
grant all on function public.import_leads(text, jsonb) to authenticated;
grant all on function public.import_leads(text, jsonb) to service_role;
revoke all on function public.open_cold_deal(bigint, bigint[], bigint, text) from public, anon;
grant all on function public.open_cold_deal(bigint, bigint[], bigint, text) to authenticated;
grant all on function public.open_cold_deal(bigint, bigint[], bigint, text) to service_role;
grant all on function public.protect_brochure_columns() to authenticated;
grant all on function public.protect_brochure_columns() to service_role;
revoke all on function public.protect_brochure_columns() from public, anon;
revoke all on function public.crm_role() from public, anon;
revoke all on function public.current_sales_id() from public, anon;
revoke all on function public.is_manager() from public, anon;
revoke all on function public.can_see_company(bigint) from public, anon;
revoke all on function public.call_engine_settings() from public, anon;

-- Supabase default privileges grant anon everything on new objects: take it
-- back explicitly (no anon RLS policy exists, this keeps it that way).
revoke all on table public.companies from anon;
revoke all on table public.contacts from anon;
revoke all on table public.contact_notes from anon;
revoke all on table public.deals from anon;
revoke all on table public.deal_notes from anon;
revoke all on table public.sales from anon;
revoke all on table public.tags from anon;
revoke all on table public.tasks from anon;
revoke all on table public.configuration from anon;
revoke all on table public.favicons_excluded_domains from anon;
revoke all on table public.company_sectors from anon;
revoke all on table public.import_batches from anon;
revoke all on table public.activity_log from anon;
revoke all on table public.companies_summary from anon;
revoke all on table public.contacts_summary from anon;
revoke all on sequence public.companies_id_seq from anon;
revoke all on sequence public."contactNotes_id_seq" from anon;
revoke all on sequence public.contacts_id_seq from anon;
revoke all on sequence public."dealNotes_id_seq" from anon;
revoke all on sequence public.deals_id_seq from anon;
revoke all on sequence public.favicons_excluded_domains_id_seq from anon;
revoke all on sequence public.sales_id_seq from anon;
revoke all on sequence public.tags_id_seq from anon;
revoke all on sequence public.tasks_id_seq from anon;
revoke all on sequence public.import_batches_id_seq from anon;
