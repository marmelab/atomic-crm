-- scripts/financial-baseline-before.sql
-- Run BEFORE migration. Uses old schema columns.

CREATE SCHEMA IF NOT EXISTS _migration_baseline;

DROP TABLE IF EXISTS _migration_baseline.project_before;
CREATE TABLE _migration_baseline.project_before AS
SELECT
  project_id,
  project_name,
  client_name,
  total_fees,
  total_expenses,
  total_paid,
  balance_due,
  payment_semantics_basis
FROM project_financials
ORDER BY project_name;

DROP TABLE IF EXISTS _migration_baseline.client_before;
CREATE TABLE _migration_baseline.client_before AS
SELECT
  c.id AS client_id,
  c.name AS client_name,
  COALESCE(pf.total_fees, 0) + COALESCE(ds.direct_fees, 0) AS total_fees,
  COALESCE(ex.total_expenses, 0) AS total_expenses,
  COALESCE(pay.total_paid, 0) AS total_paid,
  COALESCE(pf.total_fees, 0) + COALESCE(ds.direct_fees, 0)
    + COALESCE(ex.total_expenses, 0) - COALESCE(pay.total_paid, 0) AS balance_due
FROM clients c
LEFT JOIN (
  SELECT client_name, SUM(total_fees) AS total_fees
  FROM project_financials GROUP BY client_name
) pf ON pf.client_name = c.name
LEFT JOIN (
  SELECT client_id,
    SUM(COALESCE(fee_shooting,0) + COALESCE(fee_editing,0) + COALESCE(fee_other,0) - COALESCE(discount,0)) AS direct_fees
  FROM services WHERE project_id IS NULL GROUP BY client_id
) ds ON ds.client_id = c.id
LEFT JOIN (
  SELECT client_id, SUM(
    CASE
      WHEN expense_type = 'credito_ricevuto' THEN -COALESCE(amount, 0)
      WHEN expense_type = 'spostamento_km' THEN COALESCE(km_distance * km_rate, 0)
      ELSE COALESCE(amount, 0) * (1 + COALESCE(markup_percent, 0) / 100.0)
    END
  ) AS total_expenses
  FROM expenses GROUP BY client_id
) ex ON ex.client_id = c.id
LEFT JOIN (
  SELECT client_id, SUM(
    CASE WHEN payment_type = 'rimborso' THEN -amount ELSE amount END
  ) FILTER (WHERE status = 'ricevuto') AS total_paid
  FROM payments GROUP BY client_id
) pay ON pay.client_id = c.id
ORDER BY c.name;

\echo '=== PROJECT BASELINE (before) ==='
SELECT * FROM _migration_baseline.project_before;

\echo '=== CLIENT BASELINE (before) ==='
SELECT * FROM _migration_baseline.client_before;

\echo '=== FOUNDATION-PATH PROJECTS (will intentionally change) ==='
SELECT project_id, project_name, payment_semantics_basis, total_paid
FROM _migration_baseline.project_before
WHERE payment_semantics_basis IN ('financial_foundation', 'financial_documents');
