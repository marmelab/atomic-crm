-- scripts/financial-data-quality-check.sql
-- Check for data quality issues before migration

-- Payments where client_id mismatches project's client_id
\echo '=== PAYMENTS: client_id mismatch with project ==='
SELECT
  p.id AS payment_id,
  p.client_id AS payment_client_id,
  pr.client_id AS project_client_id,
  pr.name AS project_name
FROM payments p
JOIN projects pr ON pr.id = p.project_id
WHERE p.project_id IS NOT NULL
  AND p.client_id IS DISTINCT FROM pr.client_id;

-- Services where client_id mismatches project's client_id
\echo '=== SERVICES: client_id mismatch with project ==='
SELECT
  s.id AS service_id,
  s.client_id AS service_client_id,
  pr.client_id AS project_client_id,
  pr.name AS project_name
FROM services s
JOIN projects pr ON pr.id = s.project_id
WHERE s.project_id IS NOT NULL
  AND s.client_id IS DISTINCT FROM pr.client_id;

-- Expenses where client_id mismatches project's client_id
\echo '=== EXPENSES: client_id mismatch with project ==='
SELECT
  e.id AS expense_id,
  e.client_id AS expense_client_id,
  pr.client_id AS project_client_id,
  pr.name AS project_name
FROM expenses e
JOIN projects pr ON pr.id = e.project_id
WHERE e.project_id IS NOT NULL
  AND e.client_id IS DISTINCT FROM pr.client_id;

-- Orphan records (no project, no client)
\echo '=== ORPHAN RECORDS (no project, no client) ==='
SELECT 'payments' AS source, COUNT(*) FROM payments WHERE project_id IS NULL AND client_id IS NULL
UNION ALL
SELECT 'services', COUNT(*) FROM services WHERE project_id IS NULL AND client_id IS NULL
UNION ALL
SELECT 'expenses', COUNT(*) FROM expenses WHERE project_id IS NULL AND client_id IS NULL;
