-- Update deals_summary view to include venue information
-- This view provides aggregated data for gigs including venue details

DROP VIEW IF EXISTS "public"."deals_summary";

CREATE VIEW "public"."deals_summary"
WITH (security_invoker=on)
AS
SELECT
  d.*,
  c.name AS company_name,
  v.name AS venue_name,
  v.city AS venue_city,
  v.address AS venue_address,
  s.first_name || ' ' || s.last_name AS sales_name
FROM deals d
LEFT JOIN companies c ON d.company_id = c.id
LEFT JOIN venues v ON d.venue_id = v.id
LEFT JOIN sales s ON d.sales_id = s.id;

-- Add comment
COMMENT ON VIEW deals_summary IS 'Aggregated view of gigs with company, venue, and band member details';
