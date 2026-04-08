--
-- Wave 3.1A: Audit & System tables
-- Creates audit_results, audit_reports, n8n_workflow_runs, integration_log, system_settings.
-- Table definitions from Architecture.md Zone 3 + Zone 4.
-- integration_log schema follows Platform Contract Section 5 (canonical).
--

-- ============================================================
-- Zone 3: Audit Integration
-- ============================================================

-- audit_results: one row per audit run against a company
CREATE TABLE public.audit_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id BIGINT REFERENCES public.contacts(id) ON DELETE SET NULL,

  -- Audit metadata
  business_name TEXT,
  mode TEXT DEFAULT 'deep',
  status TEXT DEFAULT 'pending',

  -- Scoring
  overall_score INT,
  overall_classification TEXT,
  confidence NUMERIC(3,2),

  -- Full results blob
  results JSONB DEFAULT '{}',
  findings JSONB DEFAULT '{}',
  limitations TEXT[],

  -- Source data reference
  source_file_name TEXT,
  source_row_count INT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- audit_reports: generated presentation layer per audit
CREATE TABLE public.audit_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_result_id UUID REFERENCES public.audit_results(id) ON DELETE CASCADE,

  report_url TEXT,
  report_type TEXT DEFAULT 'interactive',
  report_data JSONB DEFAULT '{}',

  shared_with TEXT[],
  view_count INT DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit indexes
CREATE INDEX idx_audit_results_company ON public.audit_results(company_id);
CREATE INDEX idx_audit_results_status ON public.audit_results(status);
CREATE INDEX idx_audit_reports_result ON public.audit_reports(audit_result_id);

-- updated_at trigger for audit_results
CREATE TRIGGER set_audit_results_updated_at
  BEFORE UPDATE ON public.audit_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- Zone 4: System & Orchestration
-- ============================================================

-- n8n workflow execution log
CREATE TABLE public.n8n_workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name TEXT NOT NULL,
  workflow_id TEXT,
  trigger_table TEXT,
  trigger_row_id TEXT,
  status TEXT DEFAULT 'started',
  result JSONB DEFAULT '{}',
  error TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Integration event log (Platform Contract Section 5 schema)
CREATE TABLE public.integration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  payload JSONB DEFAULT '{}',
  result JSONB DEFAULT '{}',
  idempotency_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- System settings (key-value store for runtime config)
CREATE TABLE public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- System indexes
CREATE INDEX idx_integration_log_source ON public.integration_log(source, created_at DESC);
CREATE INDEX idx_n8n_runs_trigger ON public.n8n_workflow_runs(trigger_table, trigger_row_id);

-- updated_at trigger for system_settings
CREATE TRIGGER set_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- RLS: Enable + policies (auth.uid() IS NOT NULL pattern)
-- ============================================================

-- Enable RLS on all new tables
ALTER TABLE public.audit_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.n8n_workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- audit_results: authenticated full access (service role bypasses for audit system)
CREATE POLICY "authenticated_select_audit_results" ON public.audit_results FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_insert_audit_results" ON public.audit_results FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_update_audit_results" ON public.audit_results FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_delete_audit_results" ON public.audit_results FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- audit_reports: authenticated full access
CREATE POLICY "authenticated_select_audit_reports" ON public.audit_reports FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_insert_audit_reports" ON public.audit_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_update_audit_reports" ON public.audit_reports FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_delete_audit_reports" ON public.audit_reports FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- n8n_workflow_runs: authenticated read-only (n8n writes via dedicated role, bypasses RLS)
CREATE POLICY "authenticated_select_n8n_workflow_runs" ON public.n8n_workflow_runs FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- integration_log: authenticated read-only (written by edge functions/n8n via service role)
CREATE POLICY "authenticated_select_integration_log" ON public.integration_log FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- system_settings: read = authenticated, write = admin only
CREATE POLICY "authenticated_select_system_settings" ON public.system_settings FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_write_system_settings" ON public.system_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
