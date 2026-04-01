-- scripts/km-expense-duplicate-audit.sql
-- Audit duplicate km expenses caused by mixed creation paths
-- (manual expense insert + DB trigger auto-expense).
--
-- Flags only groups where the same natural key exists both:
-- - linked to a service via source_service_id
-- - unlinked (legacy/manual orphan)

\echo '=== DUPLICATE KM EXPENSE GROUPS (linked + unlinked) ==='

WITH km_expenses AS (
  SELECT
    e.id,
    e.project_id,
    p.name AS project_name,
    e.client_id,
    c.name AS client_name,
    e.expense_date,
    e.description,
    e.km_distance,
    e.km_rate,
    ROUND(COALESCE(e.km_distance, 0) * COALESCE(e.km_rate, 0), 2) AS row_amount,
    e.source_service_id,
    e.created_at
  FROM expenses e
  LEFT JOIN projects p ON p.id = e.project_id
  LEFT JOIN clients c ON c.id = COALESCE(e.client_id, p.client_id)
  WHERE e.expense_type = 'spostamento_km'
),
duplicate_groups AS (
  SELECT
    project_id,
    project_name,
    client_id,
    client_name,
    expense_date,
    description,
    km_distance,
    km_rate,
    row_amount,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE source_service_id IS NOT NULL) AS linked_rows,
    COUNT(*) FILTER (WHERE source_service_id IS NULL) AS unlinked_rows,
    MIN(created_at) AS first_created_at,
    MAX(created_at) AS last_created_at
  FROM km_expenses
  GROUP BY
    project_id,
    project_name,
    client_id,
    client_name,
    expense_date,
    description,
    km_distance,
    km_rate,
    row_amount
  HAVING COUNT(*) FILTER (WHERE source_service_id IS NOT NULL) > 0
     AND COUNT(*) FILTER (WHERE source_service_id IS NULL) > 0
)
SELECT
  project_name,
  client_name,
  expense_date,
  description,
  km_distance,
  km_rate,
  row_amount,
  linked_rows,
  unlinked_rows,
  unlinked_rows * row_amount AS potential_overstatement,
  first_created_at,
  last_created_at
FROM duplicate_groups
ORDER BY expense_date, project_name, description;

\echo '=== DUPLICATE KM EXPENSE ROWS (delete candidates are unlinked only) ==='

WITH km_expenses AS (
  SELECT
    e.id,
    e.project_id,
    p.name AS project_name,
    e.client_id,
    c.name AS client_name,
    e.expense_date,
    e.description,
    e.km_distance,
    e.km_rate,
    ROUND(COALESCE(e.km_distance, 0) * COALESCE(e.km_rate, 0), 2) AS row_amount,
    e.source_service_id,
    e.created_at
  FROM expenses e
  LEFT JOIN projects p ON p.id = e.project_id
  LEFT JOIN clients c ON c.id = COALESCE(e.client_id, p.client_id)
  WHERE e.expense_type = 'spostamento_km'
),
duplicate_groups AS (
  SELECT
    project_id,
    client_id,
    expense_date,
    description,
    km_distance,
    km_rate
  FROM km_expenses
  GROUP BY
    project_id,
    client_id,
    expense_date,
    description,
    km_distance,
    km_rate
  HAVING COUNT(*) FILTER (WHERE source_service_id IS NOT NULL) > 0
     AND COUNT(*) FILTER (WHERE source_service_id IS NULL) > 0
)
SELECT
  e.id,
  e.project_name,
  e.client_name,
  e.expense_date,
  e.description,
  e.km_distance,
  e.km_rate,
  e.row_amount,
  e.source_service_id,
  CASE
    WHEN e.source_service_id IS NULL THEN 'DELETE_CANDIDATE'
    ELSE 'KEEP_LINKED'
  END AS cleanup_action,
  e.created_at
FROM km_expenses e
JOIN duplicate_groups g
  ON g.project_id IS NOT DISTINCT FROM e.project_id
 AND g.client_id IS NOT DISTINCT FROM e.client_id
 AND g.expense_date = e.expense_date
 AND g.description IS NOT DISTINCT FROM e.description
 AND g.km_distance IS NOT DISTINCT FROM e.km_distance
 AND g.km_rate IS NOT DISTINCT FROM e.km_rate
ORDER BY e.expense_date, e.project_name, cleanup_action, e.created_at;
