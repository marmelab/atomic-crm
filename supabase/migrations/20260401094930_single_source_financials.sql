-- Single Source of Truth: Financial Position
-- Spec: docs/superpowers/specs/2026-04-01-single-source-of-truth-financials-design.md
--
-- Changes:
-- 1. Rewrite project_financials: remove dual-path, always use payments table
-- 2. Add client_id and total_owed columns to project_financials
-- 3. Create client_commercial_position view

-- =============================================================================
-- 1. Rewrite project_financials
-- =============================================================================
CREATE OR REPLACE VIEW public.project_financials AS
WITH service_view AS (
    SELECT
        s.project_id,
        COUNT(*)::int AS total_services,
        SUM(
            COALESCE(s.fee_shooting, 0)
            + COALESCE(s.fee_editing, 0)
            + COALESCE(s.fee_other, 0)
            - COALESCE(s.discount, 0)
        ) AS total_fees,
        SUM(COALESCE(s.km_distance, 0)) AS total_km,
        SUM(COALESCE(s.km_distance, 0) * COALESCE(s.km_rate, 0)) AS total_km_cost
    FROM services s
    WHERE s.project_id IS NOT NULL
    GROUP BY s.project_id
),
expense_view AS (
    SELECT
        e.project_id,
        SUM(
            CASE
                WHEN e.expense_type = 'credito_ricevuto'
                    THEN -COALESCE(e.amount, 0)
                WHEN e.expense_type = 'spostamento_km'
                    THEN COALESCE(e.km_distance * e.km_rate, 0)
                ELSE
                    COALESCE(e.amount, 0) * (1 + COALESCE(e.markup_percent, 0) / 100.0)
            END
        ) AS total_expenses
    FROM expenses e
    WHERE e.project_id IS NOT NULL
    GROUP BY e.project_id
),
payment_view AS (
    SELECT
        p.project_id,
        SUM(
            CASE
                WHEN p.payment_type = 'rimborso' THEN -p.amount
                ELSE p.amount
            END
        ) AS total_paid
    FROM payments p
    WHERE p.project_id IS NOT NULL
      AND p.status = 'ricevuto'
    GROUP BY p.project_id
)
SELECT
    pr.id AS project_id,
    pr.name AS project_name,
    pr.client_id,
    c.name AS client_name,
    pr.category,
    COALESCE(sv.total_services, 0) AS total_services,
    ROUND(COALESCE(sv.total_fees, 0), 2) AS total_fees,
    ROUND(COALESCE(sv.total_km, 0), 2) AS total_km,
    ROUND(COALESCE(sv.total_km_cost, 0), 2) AS total_km_cost,
    ROUND(COALESCE(ev.total_expenses, 0), 2) AS total_expenses,
    ROUND(COALESCE(sv.total_fees, 0) + COALESCE(ev.total_expenses, 0), 2) AS total_owed,
    ROUND(COALESCE(pv.total_paid, 0), 2) AS total_paid,
    ROUND(
        COALESCE(sv.total_fees, 0)
        + COALESCE(ev.total_expenses, 0)
        - COALESCE(pv.total_paid, 0)
    , 2) AS balance_due
FROM projects pr
JOIN clients c ON c.id = pr.client_id
LEFT JOIN service_view sv ON sv.project_id = pr.id
LEFT JOIN expense_view ev ON ev.project_id = pr.id
LEFT JOIN payment_view pv ON pv.project_id = pr.id;

-- =============================================================================
-- 2. Create client_commercial_position
-- =============================================================================
DROP VIEW IF EXISTS public.client_commercial_position;

CREATE VIEW public.client_commercial_position AS
WITH canonicalized_fees AS (
    SELECT pr.client_id, s.project_id,
        COALESCE(s.fee_shooting, 0) + COALESCE(s.fee_editing, 0)
        + COALESCE(s.fee_other, 0) - COALESCE(s.discount, 0) AS fee
    FROM services s
    JOIN projects pr ON pr.id = s.project_id
    WHERE s.project_id IS NOT NULL
    UNION ALL
    SELECT s.client_id, s.project_id,
        COALESCE(s.fee_shooting, 0) + COALESCE(s.fee_editing, 0)
        + COALESCE(s.fee_other, 0) - COALESCE(s.discount, 0) AS fee
    FROM services s
    WHERE s.project_id IS NULL AND s.client_id IS NOT NULL
),
canonicalized_expenses AS (
    SELECT pr.client_id, e.project_id,
        CASE
            WHEN e.expense_type = 'credito_ricevuto' THEN -COALESCE(e.amount, 0)
            WHEN e.expense_type = 'spostamento_km' THEN COALESCE(e.km_distance * e.km_rate, 0)
            ELSE COALESCE(e.amount, 0) * (1 + COALESCE(e.markup_percent, 0) / 100.0)
        END AS expense
    FROM expenses e
    JOIN projects pr ON pr.id = e.project_id
    WHERE e.project_id IS NOT NULL
    UNION ALL
    SELECT e.client_id, e.project_id,
        CASE
            WHEN e.expense_type = 'credito_ricevuto' THEN -COALESCE(e.amount, 0)
            WHEN e.expense_type = 'spostamento_km' THEN COALESCE(e.km_distance * e.km_rate, 0)
            ELSE COALESCE(e.amount, 0) * (1 + COALESCE(e.markup_percent, 0) / 100.0)
        END AS expense
    FROM expenses e
    WHERE e.project_id IS NULL AND e.client_id IS NOT NULL
),
canonicalized_payments AS (
    SELECT pr.client_id, p.project_id,
        CASE WHEN p.payment_type = 'rimborso' THEN -p.amount ELSE p.amount END AS paid
    FROM payments p
    JOIN projects pr ON pr.id = p.project_id
    WHERE p.project_id IS NOT NULL AND p.status = 'ricevuto'
    UNION ALL
    SELECT p.client_id, p.project_id,
        CASE WHEN p.payment_type = 'rimborso' THEN -p.amount ELSE p.amount END AS paid
    FROM payments p
    WHERE p.project_id IS NULL AND p.client_id IS NOT NULL AND p.status = 'ricevuto'
),
fee_agg AS (
    SELECT client_id, COALESCE(SUM(fee), 0) AS total_fees
    FROM canonicalized_fees GROUP BY client_id
),
expense_agg AS (
    SELECT client_id, COALESCE(SUM(expense), 0) AS total_expenses
    FROM canonicalized_expenses GROUP BY client_id
),
payment_agg AS (
    SELECT client_id, COALESCE(SUM(paid), 0) AS total_paid
    FROM canonicalized_payments GROUP BY client_id
),
project_count AS (
    SELECT client_id, project_id FROM canonicalized_fees WHERE project_id IS NOT NULL
    UNION
    SELECT client_id, project_id FROM canonicalized_expenses WHERE project_id IS NOT NULL
    UNION
    SELECT client_id, project_id FROM canonicalized_payments WHERE project_id IS NOT NULL
),
project_count_agg AS (
    SELECT client_id, COUNT(*) AS projects_count
    FROM project_count GROUP BY client_id
)
SELECT
    c.id AS client_id,
    c.name AS client_name,
    ROUND(COALESCE(fa.total_fees, 0), 2) AS total_fees,
    ROUND(COALESCE(ea.total_expenses, 0), 2) AS total_expenses,
    ROUND(COALESCE(fa.total_fees, 0) + COALESCE(ea.total_expenses, 0), 2) AS total_owed,
    ROUND(COALESCE(pa.total_paid, 0), 2) AS total_paid,
    ROUND(
        COALESCE(fa.total_fees, 0)
        + COALESCE(ea.total_expenses, 0)
        - COALESCE(pa.total_paid, 0)
    , 2) AS balance_due,
    COALESCE(pc.projects_count, 0)::int AS projects_count
FROM clients c
LEFT JOIN fee_agg fa ON fa.client_id = c.id
LEFT JOIN expense_agg ea ON ea.client_id = c.id
LEFT JOIN payment_agg pa ON pa.client_id = c.id
LEFT JOIN project_count_agg pc ON pc.client_id = c.id;

-- =============================================================================
-- 3. RLS — verify access
-- =============================================================================
-- Views inherit RLS from underlying tables (same as project_financials today).
-- VERIFY after migration: run a SELECT on client_commercial_position as
-- an authenticated user to confirm it returns data.

-- =============================================================================
-- 4. Performance indexes (if not already present)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_payments_project_status_type
    ON payments (project_id, status, payment_type);
CREATE INDEX IF NOT EXISTS idx_payments_client_status_type
    ON payments (client_id, status, payment_type);
CREATE INDEX IF NOT EXISTS idx_expenses_project
    ON expenses (project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_client
    ON expenses (client_id);
CREATE INDEX IF NOT EXISTS idx_services_project
    ON services (project_id);
CREATE INDEX IF NOT EXISTS idx_services_client
    ON services (client_id);
