--
-- Security hardening: revoke anon access, remove stale grants, add missing grants,
-- fix integration_log RLS, scope storage delete to owner.
--

-- ============================================================
-- 1. Revoke ALL anon grants on functions
-- ============================================================
revoke all on function public.cleanup_note_attachments() from anon;
revoke all on function public.get_note_attachments_function_url() from anon;
revoke all on function public.get_user_id_by_email(text) from anon;
revoke all on function public.handle_company_saved() from anon;
revoke all on function public.handle_contact_note_created_or_updated() from anon;
revoke all on function public.handle_contact_saved() from anon;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_update_user() from anon;
revoke all on function public.is_admin() from anon;
revoke all on function public.lowercase_email_jsonb() from anon;
revoke all on function public.merge_contacts(bigint, bigint) from anon;
revoke all on function public.set_sales_id_default() from anon;
revoke all on function public.update_updated_at() from anon;

-- ============================================================
-- 2. Revoke ALL anon grants on tables
-- ============================================================
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
revoke all on table public.trade_types from anon;
revoke all on table public.lead_sources from anon;
revoke all on table public.contact_tags from anon;
revoke all on table public.deal_contacts from anon;
revoke all on table public.intake_leads from anon;
revoke all on table public.audit_results from anon;
revoke all on table public.audit_reports from anon;
revoke all on table public.n8n_workflow_runs from anon;
revoke all on table public.integration_log from anon;
revoke all on table public.system_settings from anon;

-- Views
revoke all on table public.activity_log from anon;
revoke all on table public.companies_summary from anon;
revoke all on table public.contacts_summary from anon;
revoke all on table public.init_state from anon;

-- ============================================================
-- 3. Revoke ALL anon grants on sequences
-- ============================================================
revoke all on sequence public.companies_id_seq from anon;
revoke all on sequence public."contactNotes_id_seq" from anon;
revoke all on sequence public.contacts_id_seq from anon;
revoke all on sequence public."dealNotes_id_seq" from anon;
revoke all on sequence public.deals_id_seq from anon;
revoke all on sequence public.favicons_excluded_domains_id_seq from anon;
revoke all on sequence public.sales_id_seq from anon;
revoke all on sequence public.tags_id_seq from anon;
revoke all on sequence public.tasks_id_seq from anon;

-- ============================================================
-- 4. Revoke anon default privileges
-- ============================================================
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;

-- ============================================================
-- 5. Add missing grants for tables added after initial setup
-- ============================================================
grant all on table public.trade_types to authenticated;
grant all on table public.trade_types to service_role;

grant all on table public.lead_sources to authenticated;
grant all on table public.lead_sources to service_role;

grant all on table public.contact_tags to authenticated;
grant all on table public.contact_tags to service_role;

grant all on table public.deal_contacts to authenticated;
grant all on table public.deal_contacts to service_role;

grant all on table public.intake_leads to authenticated;
grant all on table public.intake_leads to service_role;

-- Missing function grant
grant all on function public.update_updated_at() to authenticated;
grant all on function public.update_updated_at() to service_role;

-- ============================================================
-- 6. Fix integration_log RLS — admin-only, not all authenticated
-- ============================================================
drop policy if exists "authenticated_select_integration_log" on public.integration_log;
create policy "admin_select_integration_log" on public.integration_log
  for select to authenticated using (public.is_admin());

-- ============================================================
-- 7. Scope storage delete to file owner
-- ============================================================
drop policy if exists "authenticated_delete_attachments" on storage.objects;
create policy "authenticated_delete_attachments" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and owner_id = auth.uid());
