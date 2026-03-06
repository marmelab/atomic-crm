-- Fix: balance_due in project_financials was ignoring total_km_cost from services.
-- The km reimbursement (services.km_distance * km_rate) is a real project cost
-- that must be included in the financial totals, just as ClientFinancialSummary
-- already does correctly.

-- Must drop dependent views first
DROP VIEW IF EXISTS analytics_yearly_competence_revenue;
DROP VIEW IF EXISTS monthly_revenue;
DROP VIEW IF EXISTS project_financials;

-- Recreate monthly_revenue (unchanged)
CREATE OR REPLACE VIEW monthly_revenue AS
SELECT date_trunc('month', s.service_date) AS month,
    p.category,
    sum(s.fee_shooting + s.fee_editing + s.fee_other - s.discount) AS revenue,
    sum(s.km_distance) AS total_km,
    sum(s.km_distance * s.km_rate) AS km_cost
   FROM services s
     JOIN projects p ON s.project_id = p.id
  GROUP BY date_trunc('month', s.service_date), p.category
  ORDER BY date_trunc('month', s.service_date) DESC;

-- Recreate project_financials with km_cost included in balance_due
CREATE OR REPLACE VIEW project_financials AS
WITH service_view AS (
    SELECT services.project_id,
        count(*) AS total_services,
        sum(services.fee_shooting + services.fee_editing + services.fee_other - services.discount) AS total_fees,
        sum(services.km_distance) AS total_km,
        sum(services.km_distance * services.km_rate) AS total_km_cost
    FROM services
    GROUP BY services.project_id
), expense_view AS (
    SELECT expenses.project_id,
        sum(
            CASE
                WHEN expenses.expense_type = 'credito_ricevuto' THEN - COALESCE(expenses.amount, 0)
                WHEN expenses.expense_type = 'spostamento_km' THEN COALESCE(expenses.km_distance::numeric * expenses.km_rate, 0)
                ELSE COALESCE(expenses.amount, 0) * (1 + COALESCE(expenses.markup_percent, 0) / 100.0)
            END) AS total_expenses
    FROM expenses
    WHERE expenses.project_id IS NOT NULL
    GROUP BY expenses.project_id
), legacy_payment_view AS (
    SELECT payments.project_id,
        sum(
            CASE
                WHEN payments.payment_type = 'rimborso' THEN - payments.amount
                ELSE payments.amount
            END) FILTER (WHERE payments.status = 'ricevuto') AS total_paid_legacy
    FROM payments
    GROUP BY payments.project_id
), foundation_payment_view AS (
    SELECT fdca.project_id,
        round(sum(fdca.allocation_amount), 2) AS total_paid_foundation
    FROM financial_document_cash_allocations fdca
        JOIN financial_documents fd ON fd.id = fdca.document_id
        JOIN cash_movements cm ON cm.id = fdca.cash_movement_id
    WHERE fdca.project_id IS NOT NULL
        AND fd.direction = 'outbound'
        AND fd.document_type = 'customer_invoice'
        AND cm.direction = 'inbound'
    GROUP BY fdca.project_id
), foundation_document_view AS (
    SELECT fdpa.project_id,
        round(sum(
            CASE
                WHEN fd.direction = 'outbound' AND fd.document_type = 'customer_invoice' THEN fdpa.allocation_amount
                ELSE 0
            END), 2) AS documented_outbound_total,
        round(sum(
            CASE
                WHEN fd.direction = 'inbound' AND fd.document_type = 'supplier_invoice' THEN fdpa.allocation_amount
                ELSE 0
            END), 2) AS documented_inbound_total
    FROM financial_document_project_allocations fdpa
        JOIN financial_documents fd ON fd.id = fdpa.document_id
    WHERE fdpa.project_id IS NOT NULL
    GROUP BY fdpa.project_id
)
SELECT p.id AS project_id,
    p.name AS project_name,
    c.name AS client_name,
    p.category,
    COALESCE(sv.total_services, 0) AS total_services,
    COALESCE(sv.total_fees, 0) AS total_fees,
    COALESCE(sv.total_km, 0) AS total_km,
    COALESCE(sv.total_km_cost, 0) AS total_km_cost,
    COALESCE(ev.total_expenses, 0) AS total_expenses,
    CASE
        WHEN fdv.project_id IS NOT NULL THEN COALESCE(fp.total_paid_foundation, 0)
        ELSE COALESCE(lp.total_paid_legacy, 0)
    END AS total_paid,
    COALESCE(fdv.documented_outbound_total, 0) AS documented_outbound_total,
    COALESCE(fdv.documented_inbound_total, 0) AS documented_inbound_total,
    CASE
        WHEN fdv.project_id IS NOT NULL AND COALESCE(fp.total_paid_foundation, 0) > 0 THEN 'financial_foundation'
        WHEN fdv.project_id IS NOT NULL THEN 'financial_documents'
        WHEN COALESCE(lp.total_paid_legacy, 0) > 0 THEN 'legacy_payments'
        ELSE 'none'
    END AS payment_semantics_basis,
    COALESCE(sv.total_fees, 0) + COALESCE(sv.total_km_cost, 0) + COALESCE(ev.total_expenses, 0) -
    CASE
        WHEN fdv.project_id IS NOT NULL THEN COALESCE(fp.total_paid_foundation, 0)
        ELSE COALESCE(lp.total_paid_legacy, 0)
    END AS balance_due
FROM projects p
    JOIN clients c ON p.client_id = c.id
    LEFT JOIN service_view sv ON sv.project_id = p.id
    LEFT JOIN expense_view ev ON ev.project_id = p.id
    LEFT JOIN legacy_payment_view lp ON lp.project_id = p.id
    LEFT JOIN foundation_payment_view fp ON fp.project_id = p.id
    LEFT JOIN foundation_document_view fdv ON fdv.project_id = p.id;

ALTER VIEW public.project_financials SET (security_invoker = on);

-- Recreate analytics_yearly_competence_revenue (unchanged)
CREATE OR REPLACE VIEW analytics_yearly_competence_revenue AS
WITH clock AS (
    SELECT * FROM analytics_business_clock
), meta AS (
    SELECT * FROM analytics_history_meta
), years AS (
    SELECT generate_series(meta.first_year_with_data, clock.current_year, 1) AS year
    FROM meta CROSS JOIN clock
    WHERE meta.first_year_with_data IS NOT NULL
), aggregated AS (
    SELECT EXTRACT(year FROM timezone(clock.business_timezone, s.service_date))::integer AS year,
        sum(s.fee_shooting + s.fee_editing + s.fee_other - s.discount) AS revenue,
        sum(s.km_distance) AS total_km,
        sum(s.km_distance * s.km_rate) AS km_cost,
        count(*) AS services_count,
        count(DISTINCT s.project_id) AS projects_count,
        count(DISTINCT p.client_id) AS clients_count
    FROM services s
        JOIN projects p ON p.id = s.project_id
        CROSS JOIN clock
    WHERE timezone(clock.business_timezone, s.service_date)::date <= clock.as_of_date
    GROUP BY EXTRACT(year FROM timezone(clock.business_timezone, s.service_date))::integer
)
SELECT years.year,
    years.year < clock.current_year AS is_closed_year,
    years.year = clock.current_year AS is_ytd,
    clock.as_of_date,
    COALESCE(aggregated.revenue, 0) AS revenue,
    COALESCE(aggregated.total_km, 0) AS total_km,
    COALESCE(aggregated.km_cost, 0) AS km_cost,
    COALESCE(aggregated.services_count, 0) AS services_count,
    COALESCE(aggregated.projects_count, 0) AS projects_count,
    COALESCE(aggregated.clients_count, 0) AS clients_count
FROM years
    CROSS JOIN clock
    LEFT JOIN aggregated ON aggregated.year = years.year
ORDER BY years.year;
