-- Visibility reporting v2
-- Additive upgrade for period-safe snapshots, source diagnostics and private PDFs.

ALTER TABLE public.website_snapshots
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date,
  ADD COLUMN IF NOT EXISTS window_kind text NOT NULL DEFAULT 'legacy'
    CHECK (window_kind IN ('legacy', 'rolling_28d', 'calendar_month')),
  ADD COLUMN IF NOT EXISTS data_coverage jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS field_data jsonb;

COMMENT ON COLUMN public.website_snapshots.window_kind IS
  'legacy = pre-v2, rolling_28d = manual analysis, calendar_month = official reporting period';
COMMENT ON COLUMN public.website_snapshots.source_status IS
  'Per-source state: available, unavailable, error or not_applicable with optional message.';
COMMENT ON COLUMN public.website_snapshots.field_data IS
  'Real-user Core Web Vitals from PageSpeed/CrUX. Never Lighthouse lab TBT presented as INP.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_website_snapshots_calendar_period
  ON public.website_snapshots(company_id, period_start)
  WHERE window_kind = 'calendar_month';

CREATE INDEX IF NOT EXISTS idx_website_snapshots_company_period
  ON public.website_snapshots(company_id, window_kind, period_start DESC);

ALTER TABLE public.monthly_reports
  ADD COLUMN IF NOT EXISTS data_period_start date,
  ADD COLUMN IF NOT EXISTS data_period_end date,
  ADD COLUMN IF NOT EXISTS report_version integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS pdf_storage_path text,
  ADD COLUMN IF NOT EXISTS pdf_generated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS view_model jsonb;

COMMENT ON COLUMN public.monthly_reports.view_model IS
  'Deterministic source of truth shared by CRM preview, HTML email and PDF.';

INSERT INTO storage.buckets (id, name, public)
VALUES ('monthly-reports', 'monthly-reports', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Service-role edge functions own the private report artifacts. Authenticated
-- users download through the signed-URL edge method, not direct public URLs.

-- Official snapshot on the fourth at 06:00, then reports at 08:00. The report
-- job gets two hours of margin because PageSpeed runs can be slow.
SELECT cron.schedule(
  'monthly-website-snapshots',
  '0 6 4 * *',
  $$SELECT public.run_monthly_website_snapshots();$$
);

SELECT cron.schedule(
  'monthly-reports',
  '0 8 4 * *',
  $$SELECT public.run_monthly_reports();$$
);
