-- Konkurrentbenchmark (Fas 1E av synlighetssatsningen)
-- Additiv migration — inga DROP/ALTER på befintlig data.
--   1) competitor_urls per kund (vilka konkurrenter som jämförs)
--   2) competitors-benchmark lagras i varje snapshot (tidsserie)

ALTER TABLE public.customer_details
  ADD COLUMN IF NOT EXISTS competitor_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.customer_details.competitor_urls IS
  'Lista av konkurrent-URL:er (strängar) som jämförs i hemsideanalysen.';

ALTER TABLE public.website_snapshots
  ADD COLUMN IF NOT EXISTS competitors jsonb;

COMMENT ON COLUMN public.website_snapshots.competitors IS
  'Benchmark mot konkurrenter: [{ url, performance_score, seo_score, lcp_ms, cls, has_title, has_schema, has_sitemap }]. null = ingen konkurrent angiven.';
