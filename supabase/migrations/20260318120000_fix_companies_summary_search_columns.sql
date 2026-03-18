-- Fix: Recreate companies_summary view to expose _search generated columns
-- The accent-insensitive search migration (20260317) added name_search,
-- city_search, state_abbr_search columns to the companies table but forgot
-- to recreate this view. PostgreSQL views freeze columns at CREATE time,
-- so the new columns were invisible through the view.

DROP VIEW IF EXISTS companies_summary;

CREATE VIEW companies_summary
  WITH (security_invoker = on)
  AS
SELECT
  c.*,
  count(DISTINCT d.id)  AS nb_deals,
  count(DISTINCT co.id) AS nb_contacts
FROM companies c
LEFT JOIN deals    d  ON c.id = d.company_id
LEFT JOIN contacts co ON c.id = co.company_id
GROUP BY c.id;

GRANT SELECT ON companies_summary TO authenticated, anon;
