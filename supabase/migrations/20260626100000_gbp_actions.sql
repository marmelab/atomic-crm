-- Google Business-actions (Fas 1F av synlighetssatsningen)
-- Additiv migration — inga DROP/ALTER på befintlig data.
--   1) gbp_location_id per kund (GBP-location, t.ex. "locations/12345")
--   2) gbp_actions lagras i varje snapshot (samtal/vägbeskrivningar/webbklick)
--
-- Kräver konfiguration för att ge data: OAuth-credential med business.manage-
-- scope (samma authorized_user som GSC, men med utökad scope) + att kundens
-- GBP-location-ID fylls i. Saknas något hämtas inget (icke-fatalt).

ALTER TABLE public.customer_details
  ADD COLUMN IF NOT EXISTS gbp_location_id text;

COMMENT ON COLUMN public.customer_details.gbp_location_id IS
  'Google Business Profile location-resurs (t.ex. "locations/12345678901234567890") för att hämta åtgärdsstatistik.';

ALTER TABLE public.website_snapshots
  ADD COLUMN IF NOT EXISTS gbp_actions jsonb;

COMMENT ON COLUMN public.website_snapshots.gbp_actions IS
  'Google Business-åtgärder senaste perioden: { calls, website_clicks, direction_requests, period_start, period_end }. null = ej konfigurerat eller ingen åtkomst.';
