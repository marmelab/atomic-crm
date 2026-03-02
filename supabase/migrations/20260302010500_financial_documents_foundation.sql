-- Financial semantics foundation:
-- separate fiscal documents, cash movements, and explicit allocations
-- without breaking the current payments/expenses compatibility layer.

CREATE TABLE IF NOT EXISTS public.financial_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  xml_document_code TEXT,
  document_type TEXT NOT NULL CHECK (
    document_type IN (
      'customer_invoice',
      'supplier_invoice',
      'customer_credit_note',
      'supplier_credit_note'
    )
  ),
  related_document_number TEXT,
  document_number TEXT NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE,
  total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount >= 0),
  taxable_amount DECIMAL(12,2),
  tax_amount DECIMAL(12,2),
  stamp_amount DECIMAL(12,2),
  currency_code TEXT NOT NULL DEFAULT 'EUR',
  source_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT financial_documents_identity_unique UNIQUE (client_id, direction, document_number, issue_date)
);

CREATE TABLE IF NOT EXISTS public.financial_document_project_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.financial_documents(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  allocation_amount DECIMAL(12,2) NOT NULL CHECK (allocation_amount >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  movement_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  method TEXT CHECK (method IN ('bonifico', 'contanti', 'paypal', 'altro')),
  reference TEXT,
  source_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.financial_document_cash_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.financial_documents(id) ON DELETE CASCADE,
  cash_movement_id UUID NOT NULL REFERENCES public.cash_movements(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  allocation_amount DECIMAL(12,2) NOT NULL CHECK (allocation_amount >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT financial_document_cash_allocations_unique
    UNIQUE (document_id, cash_movement_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_documents_client_issue_date
  ON public.financial_documents (client_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_documents_direction_issue_date
  ON public.financial_documents (direction, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_documents_document_number
  ON public.financial_documents (document_number);

CREATE INDEX IF NOT EXISTS idx_financial_document_project_allocations_document
  ON public.financial_document_project_allocations (document_id);
CREATE INDEX IF NOT EXISTS idx_financial_document_project_allocations_project
  ON public.financial_document_project_allocations (project_id);

CREATE INDEX IF NOT EXISTS idx_cash_movements_client_date
  ON public.cash_movements (client_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_movements_direction_date
  ON public.cash_movements (direction, movement_date DESC);

CREATE INDEX IF NOT EXISTS idx_financial_document_cash_allocations_document
  ON public.financial_document_cash_allocations (document_id);
CREATE INDEX IF NOT EXISTS idx_financial_document_cash_allocations_cash
  ON public.financial_document_cash_allocations (cash_movement_id);

ALTER TABLE public.financial_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_document_project_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_document_cash_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated full access" ON public.financial_documents;
CREATE POLICY "Authenticated full access" ON public.financial_documents
  FOR ALL USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated full access" ON public.financial_document_project_allocations;
CREATE POLICY "Authenticated full access" ON public.financial_document_project_allocations
  FOR ALL USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated full access" ON public.cash_movements;
CREATE POLICY "Authenticated full access" ON public.cash_movements
  FOR ALL USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated full access" ON public.financial_document_cash_allocations;
CREATE POLICY "Authenticated full access" ON public.financial_document_cash_allocations
  FOR ALL USING ((select auth.uid()) IS NOT NULL);

DROP TRIGGER IF EXISTS trg_financial_documents_updated_at ON public.financial_documents;
CREATE TRIGGER trg_financial_documents_updated_at
  BEFORE UPDATE ON public.financial_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_financial_document_project_allocations_updated_at
  ON public.financial_document_project_allocations;
CREATE TRIGGER trg_financial_document_project_allocations_updated_at
  BEFORE UPDATE ON public.financial_document_project_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_cash_movements_updated_at ON public.cash_movements;
CREATE TRIGGER trg_cash_movements_updated_at
  BEFORE UPDATE ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_financial_document_cash_allocations_updated_at
  ON public.financial_document_cash_allocations;
CREATE TRIGGER trg_financial_document_cash_allocations_updated_at
  BEFORE UPDATE ON public.financial_document_cash_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE VIEW public.financial_documents_summary AS
WITH cash_totals AS (
  SELECT
    document_id,
    ROUND(SUM(allocation_amount)::numeric, 2) AS settled_amount
  FROM public.financial_document_cash_allocations
  GROUP BY document_id
),
project_totals AS (
  SELECT
    fdpa.document_id,
    COUNT(*) AS project_allocations_count,
    STRING_AGG(COALESCE(p.name, '(non allocato)'), ' · ' ORDER BY p.name NULLS LAST) AS project_names
  FROM public.financial_document_project_allocations fdpa
  LEFT JOIN public.projects p ON p.id = fdpa.project_id
  GROUP BY fdpa.document_id
)
SELECT
  fd.id,
  fd.client_id,
  c.name AS client_name,
  fd.direction,
  fd.xml_document_code,
  fd.document_type,
  fd.related_document_number,
  fd.document_number,
  fd.issue_date,
  fd.due_date,
  fd.total_amount,
  fd.taxable_amount,
  fd.tax_amount,
  fd.stamp_amount,
  LEAST(fd.total_amount, COALESCE(ct.settled_amount, 0)) AS settled_amount,
  GREATEST(
    fd.total_amount - LEAST(fd.total_amount, COALESCE(ct.settled_amount, 0)),
    0
  ) AS open_amount,
  CASE
    WHEN GREATEST(
      fd.total_amount - LEAST(fd.total_amount, COALESCE(ct.settled_amount, 0)),
      0
    ) <= 0.009 THEN 'settled'
    WHEN LEAST(fd.total_amount, COALESCE(ct.settled_amount, 0)) > 0 THEN 'partial'
    WHEN fd.due_date IS NOT NULL AND fd.due_date < CURRENT_DATE THEN 'overdue'
    ELSE 'open'
  END AS settlement_status,
  COALESCE(pt.project_allocations_count, 0) AS project_allocations_count,
  pt.project_names,
  fd.currency_code,
  fd.source_path,
  fd.notes,
  fd.created_at,
  fd.updated_at
FROM public.financial_documents fd
JOIN public.clients c ON c.id = fd.client_id
LEFT JOIN cash_totals ct ON ct.document_id = fd.id
LEFT JOIN project_totals pt ON pt.document_id = fd.id;

DROP VIEW IF EXISTS public.project_financials;
CREATE VIEW public.project_financials AS
WITH service_view AS (
  SELECT
    project_id,
    COUNT(*) AS total_services,
    SUM(fee_shooting + fee_editing + fee_other - discount) AS total_fees,
    SUM(km_distance) AS total_km,
    SUM(km_distance * km_rate) AS total_km_cost
  FROM public.services
  GROUP BY project_id
),
expense_view AS (
  SELECT
    project_id,
    SUM(
      CASE
        WHEN expense_type = 'credito_ricevuto' THEN -COALESCE(amount, 0)
        WHEN expense_type = 'spostamento_km' THEN COALESCE(km_distance * km_rate, 0)
        ELSE COALESCE(amount, 0) * (1 + COALESCE(markup_percent, 0) / 100.0)
      END
    ) AS total_expenses
  FROM public.expenses
  WHERE project_id IS NOT NULL
  GROUP BY project_id
),
legacy_payment_view AS (
  SELECT
    project_id,
    SUM(
      CASE
        WHEN payment_type = 'rimborso' THEN -amount
        ELSE amount
      END
    ) FILTER (WHERE status = 'ricevuto') AS total_paid_legacy
  FROM public.payments
  GROUP BY project_id
),
foundation_payment_view AS (
  SELECT
    fdca.project_id,
    ROUND(SUM(fdca.allocation_amount)::numeric, 2) AS total_paid_foundation
  FROM public.financial_document_cash_allocations fdca
  JOIN public.financial_documents fd ON fd.id = fdca.document_id
  JOIN public.cash_movements cm ON cm.id = fdca.cash_movement_id
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
          WHEN fd.direction = 'outbound'
            AND fd.document_type = 'customer_invoice'
            THEN fdpa.allocation_amount
          ELSE 0
        END
      )::numeric,
      2
    ) AS documented_outbound_total,
    ROUND(
      SUM(
        CASE
          WHEN fd.direction = 'inbound'
            AND fd.document_type = 'supplier_invoice'
            THEN fdpa.allocation_amount
          ELSE 0
        END
      )::numeric,
      2
    ) AS documented_inbound_total
  FROM public.financial_document_project_allocations fdpa
  JOIN public.financial_documents fd ON fd.id = fdpa.document_id
  WHERE fdpa.project_id IS NOT NULL
  GROUP BY fdpa.project_id
)
SELECT
  p.id AS project_id,
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
    WHEN fdv.project_id IS NOT NULL AND COALESCE(fp.total_paid_foundation, 0) > 0
      THEN 'financial_foundation'
    WHEN fdv.project_id IS NOT NULL THEN 'financial_documents'
    WHEN COALESCE(lp.total_paid_legacy, 0) > 0 THEN 'legacy_payments'
    ELSE 'none'
  END AS payment_semantics_basis,
  COALESCE(sv.total_fees, 0) + COALESCE(ev.total_expenses, 0) -
    CASE
      WHEN fdv.project_id IS NOT NULL THEN COALESCE(fp.total_paid_foundation, 0)
      ELSE COALESCE(lp.total_paid_legacy, 0)
    END AS balance_due
FROM public.projects p
JOIN public.clients c ON p.client_id = c.id
LEFT JOIN service_view sv ON sv.project_id = p.id
LEFT JOIN expense_view ev ON ev.project_id = p.id
LEFT JOIN legacy_payment_view lp ON lp.project_id = p.id
LEFT JOIN foundation_payment_view fp ON fp.project_id = p.id
LEFT JOIN foundation_document_view fdv ON fdv.project_id = p.id;
