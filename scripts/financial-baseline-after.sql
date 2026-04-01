-- scripts/financial-baseline-after.sql
-- Run AFTER migration. Uses new schema columns. Manual inspection only.

\echo '=== PROJECT BASELINE (after) ==='
SELECT
  project_id, project_name, client_name,
  total_fees, total_expenses, total_owed, total_paid, balance_due
FROM project_financials
ORDER BY project_name;

\echo '=== CLIENT BASELINE (after) ==='
SELECT * FROM client_commercial_position
ORDER BY client_name;
