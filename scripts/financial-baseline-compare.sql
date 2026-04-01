-- scripts/financial-baseline-compare.sql
-- Run AFTER migration. Uses persistent _migration_baseline tables (cross-session safe).
-- Highlights ONLY rows where numbers differ.

\echo '=== PROJECT PARITY CHECK (differences only) ==='
SELECT
  b.project_id,
  b.project_name,
  b.total_fees AS before_fees,   n.total_fees AS after_fees,
  b.total_expenses AS before_exp, n.total_expenses AS after_exp,
  b.total_paid AS before_paid,   n.total_paid AS after_paid,
  b.balance_due AS before_bal,   n.balance_due AS after_bal,
  b.payment_semantics_basis AS was_basis
FROM _migration_baseline.project_before b
JOIN project_financials n ON n.project_id = b.project_id
WHERE ROUND(b.total_fees::numeric, 2) IS DISTINCT FROM n.total_fees
   OR ROUND(b.total_expenses::numeric, 2) IS DISTINCT FROM n.total_expenses
   OR ROUND(b.total_paid::numeric, 2) IS DISTINCT FROM n.total_paid
   OR ROUND(b.balance_due::numeric, 2) IS DISTINCT FROM n.balance_due;

\echo '=== CLIENT PARITY CHECK (differences only) ==='
SELECT
  b.client_id,
  b.client_name,
  b.total_fees AS before_fees,   n.total_fees AS after_fees,
  b.total_expenses AS before_exp, n.total_expenses AS after_exp,
  b.total_paid AS before_paid,   n.total_paid AS after_paid,
  b.balance_due AS before_bal,   n.balance_due AS after_bal
FROM _migration_baseline.client_before b
JOIN client_commercial_position n ON n.client_id = b.client_id
WHERE ROUND(b.total_fees::numeric, 2) IS DISTINCT FROM n.total_fees
   OR ROUND(b.total_expenses::numeric, 2) IS DISTINCT FROM n.total_expenses
   OR ROUND(b.total_paid::numeric, 2) IS DISTINCT FROM n.total_paid
   OR ROUND(b.balance_due::numeric, 2) IS DISTINCT FROM n.balance_due;
