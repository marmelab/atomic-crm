-- Lokal map-pack-rank (Fas 2B)
-- Additiv migration — inga DROP/ALTER på befintlig data.
--   1) local_rank_keywords per kund (vilka "tjänst nära mig"-sökord som spåras)
--   2) local_rank lagras i varje snapshot (placering per sökord, tidsserie)
--
-- Kräver konfiguration för data: DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD som
-- secrets + att kundens lokala sökord fylls i. Saknas något hämtas inget.

ALTER TABLE public.customer_details
  ADD COLUMN IF NOT EXISTS local_rank_keywords jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.customer_details.local_rank_keywords IS
  'Lokala sökord ("takläggare östersund") vars map-pack-placering spåras via DataForSEO.';

ALTER TABLE public.website_snapshots
  ADD COLUMN IF NOT EXISTS local_rank jsonb;

COMMENT ON COLUMN public.website_snapshots.local_rank IS
  'Map-pack-placering per sökord: [{ keyword, position, found }]. null = ej konfigurerat eller ingen åtkomst.';
