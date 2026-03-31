-- Fix timezone in financial_documents_summary: use Europe/Rome business day
-- instead of CURRENT_DATE (which uses the DB session timezone, UTC on Supabase).
DROP VIEW IF EXISTS public.financial_documents_summary;
CREATE VIEW public.financial_documents_summary AS
WITH cash_totals AS (
  SELECT
    document_id,
    ROUND(SUM(allocation_amount)::numeric, 2) AS settled_amount
  FROM public.financial_document_cash_allocations
  GROUP BY document_id
),
project_totals AS (
  SELECT
    fdpa.document_id,
    COUNT(*) AS project_allocations_count,
    STRING_AGG(COALESCE(p.name, '(non allocato)'), ' · ' ORDER BY p.name NULLS LAST) AS project_names
  FROM public.financial_document_project_allocations fdpa
  LEFT JOIN public.projects p ON p.id = fdpa.project_id
  GROUP BY fdpa.document_id
)
SELECT
  fd.id,
  fd.client_id,
  fd.supplier_id,
  c.name AS client_name,
  s.name AS supplier_name,
  fd.direction,
  fd.xml_document_code,
  fd.document_type,
  fd.related_document_number,
  fd.document_number,
  fd.issue_date,
  fd.due_date,
  fd.total_amount,
  fd.taxable_amount,
  fd.tax_amount,
  fd.stamp_amount,
  LEAST(fd.total_amount, COALESCE(ct.settled_amount, 0)) AS settled_amount,
  GREATEST(
    fd.total_amount - LEAST(fd.total_amount, COALESCE(ct.settled_amount, 0)),
    0
  ) AS open_amount,
  CASE
    WHEN GREATEST(
      fd.total_amount - LEAST(fd.total_amount, COALESCE(ct.settled_amount, 0)),
      0
    ) <= 0.009 THEN 'settled'
    WHEN LEAST(fd.total_amount, COALESCE(ct.settled_amount, 0)) > 0 THEN 'partial'
    WHEN fd.due_date IS NOT NULL AND fd.due_date < (NOW() AT TIME ZONE 'Europe/Rome')::date THEN 'overdue'
    ELSE 'open'
  END AS settlement_status,
  COALESCE(pt.project_allocations_count, 0) AS project_allocations_count,
  pt.project_names,
  fd.currency_code,
  fd.source_path,
  fd.notes,
  fd.created_at,
  fd.updated_at
FROM public.financial_documents fd
LEFT JOIN public.clients c ON c.id = fd.client_id
LEFT JOIN public.suppliers s ON s.id = fd.supplier_id
LEFT JOIN cash_totals ct ON ct.document_id = fd.id
LEFT JOIN project_totals pt ON pt.document_id = fd.id;
