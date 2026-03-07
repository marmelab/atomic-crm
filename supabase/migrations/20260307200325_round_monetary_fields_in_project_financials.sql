-- Round all monetary fields in project_financials to 2 decimal places.
-- Previously only the foundation payment fields used ROUND(); the legacy
-- service/expense/payment aggregations could produce values with >2 decimals
-- (e.g. km_distance * km_rate or markup_percent / 100.0).

CREATE OR REPLACE VIEW project_financials AS
WITH service_view AS (
    SELECT services.project_id,
        count(*) AS total_services,
        round(sum(services.fee_shooting + services.fee_editing + services.fee_other - services.discount), 2) AS total_fees,
        round(sum(services.km_distance), 2) AS total_km,
        round(sum(services.km_distance * services.km_rate), 2) AS total_km_cost
    FROM services
    GROUP BY services.project_id
), expense_view AS (
    SELECT expenses.project_id,
        round(sum(
            CASE
                WHEN expenses.expense_type = 'credito_ricevuto' THEN - COALESCE(expenses.amount, 0)
                WHEN expenses.expense_type = 'spostamento_km' THEN COALESCE(expenses.km_distance * expenses.km_rate, 0)
                ELSE COALESCE(expenses.amount, 0) * (1 + COALESCE(expenses.markup_percent, 0) / 100.0)
            END), 2) AS total_expenses
    FROM expenses
    WHERE expenses.project_id IS NOT NULL
    GROUP BY expenses.project_id
), legacy_payment_view AS (
    SELECT payments.project_id,
        round(sum(
            CASE
                WHEN payments.payment_type = 'rimborso' THEN - payments.amount
                ELSE payments.amount
            END) FILTER (WHERE payments.status = 'ricevuto'), 2) AS total_paid_legacy
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
    round(
        COALESCE(sv.total_fees, 0) + COALESCE(ev.total_expenses, 0) -
        CASE
            WHEN fdv.project_id IS NOT NULL THEN COALESCE(fp.total_paid_foundation, 0)
            ELSE COALESCE(lp.total_paid_legacy, 0)
        END
    , 2) AS balance_due
FROM projects p
    JOIN clients c ON p.client_id = c.id
    LEFT JOIN service_view sv ON sv.project_id = p.id
    LEFT JOIN expense_view ev ON ev.project_id = p.id
    LEFT JOIN legacy_payment_view lp ON lp.project_id = p.id
    LEFT JOIN foundation_payment_view fp ON fp.project_id = p.id
    LEFT JOIN foundation_document_view fdv ON fdv.project_id = p.id;

ALTER VIEW public.project_financials SET (security_invoker = on);
