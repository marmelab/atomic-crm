-- Create deals_summary view to expose aggregated contact names for search
CREATE VIEW deals_summary
  WITH (security_invoker = on)
  AS
SELECT
    d.*,
    coalesce(string_agg((c.first_name || ' ' || c.last_name), ' '), '') AS contact_names,
    lower(immutable_unaccent(coalesce(string_agg((c.first_name || ' ' || c.last_name), ' '), ''))) AS contact_names_search
FROM public.deals d
    LEFT JOIN public.contacts c ON c.id = ANY(d.contact_ids)
GROUP BY d.id;

GRANT SELECT ON deals_summary TO authenticated, anon;
