-- scripts/financial-baseline-before.sql
-- Capture the pre-refactor baseline using legacy project_financials semantics.
-- Safe to run from the final branch after `make supabase-reset-database`.

CREATE SCHEMA IF NOT EXISTS _migration_baseline;

DROP TABLE IF EXISTS _migration_baseline.project_before;
CREATE TABLE _migration_baseline.project_before AS
WITH service_view AS (
  SELECT
    services.project_id,
    COUNT(*) AS total_services,
    ROUND(
      SUM(
        services.fee_shooting
        + services.fee_editing
        + services.fee_other
        - services.discount
      ),
      2
    ) AS total_fees,
    ROUND(SUM(services.km_distance), 2) AS total_km,
    ROUND(SUM(services.km_distance * services.km_rate), 2) AS total_km_cost
  FROM services
  GROUP BY services.project_id
),
expense_view AS (
  SELECT
    expenses.project_id,
    ROUND(
      SUM(
        CASE
          WHEN expenses.expense_type = 'credito_ricevuto' THEN -COALESCE(expenses.amount, 0)
          WHEN expenses.expense_type = 'spostamento_km' THEN COALESCE(expenses.km_distance * expenses.km_rate, 0)
          ELSE COALESCE(expenses.amount, 0) * (1 + COALESCE(expenses.markup_percent, 0) / 100.0)
        END
      ),
      2
    ) AS total_expenses
  FROM expenses
  WHERE expenses.project_id IS NOT NULL
  GROUP BY expenses.project_id
),
legacy_payment_view AS (
  SELECT
    payments.project_id,
    ROUND(
      SUM(
        CASE
          WHEN payments.payment_type = 'rimborso' THEN -payments.amount
          ELSE payments.amount
        END
      ) FILTER (WHERE payments.status = 'ricevuto'),
      2
    ) AS total_paid_legacy
  FROM payments
  GROUP BY payments.project_id
),
foundation_payment_view AS (
  SELECT
    fdca.project_id,
    ROUND(SUM(fdca.allocation_amount), 2) AS total_paid_foundation
  FROM financial_document_cash_allocations fdca
  JOIN financial_documents fd ON fd.id = fdca.document_id
  JOIN cash_movements cm ON cm.id = fdca.cash_movement_id
  WHERE fdca.project_id IS NOT NULL
    AND fd.direction = 'outbound'
    AND fd.document_type = 'customer_invoice'
    AND cm.direction = 'inbound'
  GROUP BY fdca.project_id
),
foundation_document_view AS (
  SELECT
    fdpa.project_id,
    ROUND(
      SUM(
        CASE
          WHEN fd.direction = 'outbound' AND fd.document_type = 'customer_invoice'
            THEN fdpa.allocation_amount
          ELSE 0
        END
      ),
      2
    ) AS documented_outbound_total,
    ROUND(
      SUM(
        CASE
          WHEN fd.direction = 'inbound' AND fd.document_type = 'supplier_invoice'
            THEN fdpa.allocation_amount
          ELSE 0
        END
      ),
      2
    ) AS documented_inbound_total
  FROM financial_document_project_allocations fdpa
  JOIN financial_documents fd ON fd.id = fdpa.document_id
  WHERE fdpa.project_id IS NOT NULL
  GROUP BY fdpa.project_id
)
SELECT
  p.id AS project_id,
  p.name AS project_name,
  c.name AS client_name,
  COALESCE(sv.total_fees, 0) AS total_fees,
  COALESCE(ev.total_expenses, 0) AS total_expenses,
  CASE
    WHEN fdv.project_id IS NOT NULL THEN COALESCE(fp.total_paid_foundation, 0)
    ELSE COALESCE(lp.total_paid_legacy, 0)
  END AS total_paid,
  ROUND(
    COALESCE(sv.total_fees, 0) + COALESCE(ev.total_expenses, 0)
    - CASE
        WHEN fdv.project_id IS NOT NULL THEN COALESCE(fp.total_paid_foundation, 0)
        ELSE COALESCE(lp.total_paid_legacy, 0)
      END,
    2
  ) AS balance_due,
  CASE
    WHEN fdv.project_id IS NOT NULL AND COALESCE(fp.total_paid_foundation, 0) > 0 THEN 'financial_foundation'
    WHEN fdv.project_id IS NOT NULL THEN 'financial_documents'
    WHEN COALESCE(lp.total_paid_legacy, 0) > 0 THEN 'legacy_payments'
    ELSE 'none'
  END AS payment_semantics_basis
FROM projects p
JOIN clients c ON c.id = p.client_id
LEFT JOIN service_view sv ON sv.project_id = p.id
LEFT JOIN expense_view ev ON ev.project_id = p.id
LEFT JOIN legacy_payment_view lp ON lp.project_id = p.id
LEFT JOIN foundation_payment_view fp ON fp.project_id = p.id
LEFT JOIN foundation_document_view fdv ON fdv.project_id = p.id
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
  FROM _migration_baseline.project_before GROUP BY client_name
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
