-- Phase 2 Wave 2.1A: RLS Hardening
-- Replace all "using (true)" policies with "using (auth.uid() IS NOT NULL)"
-- Blocks unauthenticated access while keeping all authenticated users permissive.
-- Configuration admin-only policies are left unchanged.

BEGIN;

-- ============================================================
-- Companies
-- ============================================================
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.companies;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.companies;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.companies;
DROP POLICY IF EXISTS "Company Delete Policy" ON public.companies;

CREATE POLICY "authenticated_select_companies" ON public.companies
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_insert_companies" ON public.companies
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_update_companies" ON public.companies
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_delete_companies" ON public.companies
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Contacts
-- ============================================================
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.contacts;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.contacts;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.contacts;
DROP POLICY IF EXISTS "Contact Delete Policy" ON public.contacts;

CREATE POLICY "authenticated_select_contacts" ON public.contacts
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_insert_contacts" ON public.contacts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_update_contacts" ON public.contacts
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_delete_contacts" ON public.contacts
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Contact Notes
-- ============================================================
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.contact_notes;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.contact_notes;
DROP POLICY IF EXISTS "Contact Notes Update policy" ON public.contact_notes;
DROP POLICY IF EXISTS "Contact Notes Delete Policy" ON public.contact_notes;

CREATE POLICY "authenticated_select_contact_notes" ON public.contact_notes
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_insert_contact_notes" ON public.contact_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_update_contact_notes" ON public.contact_notes
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_delete_contact_notes" ON public.contact_notes
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Deals
-- ============================================================
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.deals;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.deals;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.deals;
DROP POLICY IF EXISTS "Deals Delete Policy" ON public.deals;

CREATE POLICY "authenticated_select_deals" ON public.deals
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_insert_deals" ON public.deals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_update_deals" ON public.deals
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_delete_deals" ON public.deals
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Deal Notes
-- ============================================================
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.deal_notes;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.deal_notes;
DROP POLICY IF EXISTS "Deal Notes Update Policy" ON public.deal_notes;
DROP POLICY IF EXISTS "Deal Notes Delete Policy" ON public.deal_notes;

CREATE POLICY "authenticated_select_deal_notes" ON public.deal_notes
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_insert_deal_notes" ON public.deal_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_update_deal_notes" ON public.deal_notes
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_delete_deal_notes" ON public.deal_notes
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Sales
-- ============================================================
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.sales;

CREATE POLICY "authenticated_select_sales" ON public.sales
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Tags
-- ============================================================
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.tags;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.tags;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.tags;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.tags;

CREATE POLICY "authenticated_select_tags" ON public.tags
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_insert_tags" ON public.tags
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_update_tags" ON public.tags
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_delete_tags" ON public.tags
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Tasks
-- ============================================================
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.tasks;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.tasks;
DROP POLICY IF EXISTS "Task Update Policy" ON public.tasks;
DROP POLICY IF EXISTS "Task Delete Policy" ON public.tasks;

CREATE POLICY "authenticated_select_tasks" ON public.tasks
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_insert_tasks" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_update_tasks" ON public.tasks
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_delete_tasks" ON public.tasks
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Configuration — admin-only policies left UNCHANGED
-- Only harden the read policy
-- ============================================================
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.configuration;

CREATE POLICY "authenticated_select_configuration" ON public.configuration
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
-- insert/update admin policies ("Enable insert for admins", "Enable update for admins") remain as-is

-- ============================================================
-- Favicons Excluded Domains
-- ============================================================
DROP POLICY IF EXISTS "Enable access for authenticated users only" ON public.favicons_excluded_domains;

CREATE POLICY "authenticated_all_favicons_excluded_domains" ON public.favicons_excluded_domains
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- Trade Types — upgrade read policy
-- ============================================================
DROP POLICY IF EXISTS "authenticated_read_trade_types" ON public.trade_types;

CREATE POLICY "authenticated_select_trade_types" ON public.trade_types
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
-- admin_write_trade_types policy remains unchanged

-- ============================================================
-- Lead Sources — upgrade read policy
-- ============================================================
DROP POLICY IF EXISTS "authenticated_read_lead_sources" ON public.lead_sources;

CREATE POLICY "authenticated_select_lead_sources" ON public.lead_sources
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
-- admin_write_lead_sources policy remains unchanged

-- ============================================================
-- Storage policies — harden attachment access
-- ============================================================
DROP POLICY IF EXISTS "Attachments 1mt4rzk_0" ON storage.objects;
DROP POLICY IF EXISTS "Attachments 1mt4rzk_1" ON storage.objects;
DROP POLICY IF EXISTS "Attachments 1mt4rzk_3" ON storage.objects;

CREATE POLICY "authenticated_select_attachments" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'attachments' AND auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_insert_attachments" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments' AND auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_delete_attachments" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'attachments' AND auth.uid() IS NOT NULL);

COMMIT;
