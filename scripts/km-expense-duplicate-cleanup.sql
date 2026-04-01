-- scripts/km-expense-duplicate-cleanup.sql
-- Cleanup helper for duplicate km expenses created during the transition from
-- manual expense creation to DB-trigger auto creation.
--
-- Safety rules:
-- 1. Only deletes `spostamento_km` rows with `source_service_id IS NULL`
-- 2. Only when an equivalent linked row exists on the same natural key
-- 3. Runs in a transaction; default ending is ROLLBACK

BEGIN;

\echo '=== PREVIEW KM DUPLICATE DELETE CANDIDATES ==='

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
),
delete_candidates AS (
  SELECT e.*
  FROM km_expenses e
  JOIN duplicate_groups g
    ON g.project_id IS NOT DISTINCT FROM e.project_id
   AND g.client_id IS NOT DISTINCT FROM e.client_id
   AND g.expense_date = e.expense_date
   AND g.description IS NOT DISTINCT FROM e.description
   AND g.km_distance IS NOT DISTINCT FROM e.km_distance
   AND g.km_rate IS NOT DISTINCT FROM e.km_rate
  WHERE e.source_service_id IS NULL
)
SELECT
  id,
  project_name,
  client_name,
  expense_date,
  description,
  km_distance,
  km_rate,
  row_amount,
  created_at
FROM delete_candidates
ORDER BY expense_date, project_name, created_at;

-- After reviewing the preview above, replace ROLLBACK with this DELETE block
-- (or run it separately):
--
-- WITH km_expenses AS (
--   SELECT
--     e.id,
--     e.project_id,
--     e.client_id,
--     e.expense_date,
--     e.description,
--     e.km_distance,
--     e.km_rate,
--     e.source_service_id
--   FROM expenses e
--   WHERE e.expense_type = 'spostamento_km'
-- ),
-- duplicate_groups AS (
--   SELECT
--     project_id,
--     client_id,
--     expense_date,
--     description,
--     km_distance,
--     km_rate
--   FROM km_expenses
--   GROUP BY
--     project_id,
--     client_id,
--     expense_date,
--     description,
--     km_distance,
--     km_rate
--   HAVING COUNT(*) FILTER (WHERE source_service_id IS NOT NULL) > 0
--      AND COUNT(*) FILTER (WHERE source_service_id IS NULL) > 0
-- ),
-- delete_candidates AS (
--   SELECT e.id
--   FROM km_expenses e
--   JOIN duplicate_groups g
--     ON g.project_id IS NOT DISTINCT FROM e.project_id
--    AND g.client_id IS NOT DISTINCT FROM e.client_id
--    AND g.expense_date = e.expense_date
--    AND g.description IS NOT DISTINCT FROM e.description
--    AND g.km_distance IS NOT DISTINCT FROM e.km_distance
--    AND g.km_rate IS NOT DISTINCT FROM e.km_rate
--   WHERE e.source_service_id IS NULL
-- )
-- DELETE FROM expenses e
-- USING delete_candidates dc
-- WHERE e.id = dc.id
-- RETURNING
--   e.id,
--   e.project_id,
--   e.client_id,
--   e.expense_date,
--   e.description,
--   e.km_distance,
--   e.km_rate,
--   e.source_service_id,
--   e.created_at;

ROLLBACK;
