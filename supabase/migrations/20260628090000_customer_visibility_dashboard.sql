-- Kundradar: ett periodiserat, RLS-skyddat underlag för hela kundportföljen.
-- Funktionen returnerar råa snapshots och rapportens frysta view_model så att
-- CRM kan använda samma verifierade värden som kundfliken, mejlet och PDF:en.

CREATE OR REPLACE FUNCTION public.get_customer_visibility_dashboard(
  p_period date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  WITH requested_period AS (
    SELECT
      date_trunc('month', p_period)::date AS period_start,
      (date_trunc('month', p_period) + interval '1 month - 1 day')::date AS period_end,
      (date_trunc('month', p_period) - interval '1 month')::date AS previous_start,
      (date_trunc('month', p_period) - interval '1 day')::date AS previous_end
  ),
  delivered_customers AS (
    SELECT
      cd.company_id,
      c.name AS company_name,
      cd.delivered_website_url,
      cd.launch_date
    FROM public.customer_details cd
    JOIN public.companies c ON c.id = cd.company_id
    WHERE NULLIF(btrim(cd.delivered_website_url), '') IS NOT NULL
  ),
  customer_rows AS (
    SELECT
      dc.company_id,
      dc.company_name,
      dc.delivered_website_url,
      dc.launch_date,
      to_jsonb(current_snapshot) AS current_snapshot,
      to_jsonb(previous_snapshot) AS previous_snapshot,
      to_jsonb(current_report) AS report,
      COALESCE(history.snapshots, '[]'::jsonb) AS history
    FROM delivered_customers dc
    CROSS JOIN requested_period rp
    LEFT JOIN LATERAL (
      SELECT ws.*
      FROM public.website_snapshots ws
      WHERE ws.company_id = dc.company_id
        AND ws.window_kind = 'calendar_month'
        AND ws.period_start = rp.period_start
      ORDER BY ws.fetched_at DESC
      LIMIT 1
    ) current_snapshot ON true
    LEFT JOIN LATERAL (
      SELECT ws.*
      FROM public.website_snapshots ws
      WHERE ws.company_id = dc.company_id
        AND ws.window_kind = 'calendar_month'
        AND ws.period_start = rp.previous_start
      ORDER BY ws.fetched_at DESC
      LIMIT 1
    ) previous_snapshot ON true
    LEFT JOIN LATERAL (
      SELECT mr.*
      FROM public.monthly_reports mr
      WHERE mr.company_id = dc.company_id
        AND mr.period = rp.period_start
      ORDER BY mr.created_at DESC
      LIMIT 1
    ) current_report ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(to_jsonb(monthly_snapshot) ORDER BY monthly_snapshot.period_start) AS snapshots
      FROM (
        SELECT DISTINCT ON (ws.period_start) ws.*
        FROM public.website_snapshots ws
        WHERE ws.company_id = dc.company_id
          AND ws.window_kind = 'calendar_month'
          AND ws.period_start <= rp.period_start
          AND ws.period_start >= (rp.period_start - interval '11 months')::date
        ORDER BY ws.period_start, ws.fetched_at DESC
      ) monthly_snapshot
    ) history ON true
  )
  SELECT jsonb_build_object(
    'period', jsonb_build_object(
      'start', rp.period_start,
      'end', rp.period_end
    ),
    'previous_period', jsonb_build_object(
      'start', rp.previous_start,
      'end', rp.previous_end
    ),
    'rows', COALESCE(
      (SELECT jsonb_agg(to_jsonb(customer_rows) ORDER BY company_name) FROM customer_rows),
      '[]'::jsonb
    )
  )
  FROM requested_period rp;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_visibility_dashboard(date)
  TO authenticated;

COMMENT ON FUNCTION public.get_customer_visibility_dashboard(date) IS
  'Periodiserat underlag för Kundradar. Returnerar levererade kunder, snapshots, rapportstatus och 12 månaders historik i ett anrop.';
