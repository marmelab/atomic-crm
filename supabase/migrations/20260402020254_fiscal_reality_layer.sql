-- fiscal_declarations: annual summary from commercialista
CREATE TABLE IF NOT EXISTS fiscal_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_year integer NOT NULL,
  total_substitute_tax numeric(10,2) NOT NULL DEFAULT 0,
  total_inps numeric(10,2) NOT NULL DEFAULT 0,
  prior_advances_substitute_tax numeric(10,2) NOT NULL DEFAULT 0,
  prior_advances_inps numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  UNIQUE (user_id, tax_year),
  CHECK (tax_year >= 2023)
);

ALTER TABLE fiscal_declarations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fiscal_declarations_user" ON fiscal_declarations
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- fiscal_obligations: individual items to pay
CREATE TABLE IF NOT EXISTS fiscal_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id uuid REFERENCES fiscal_declarations(id),
  source text NOT NULL DEFAULT 'manual',
  component text NOT NULL,
  competence_year integer NOT NULL,
  payment_year integer NOT NULL,
  due_date date NOT NULL,
  amount numeric(10,2) NOT NULL,
  installment_number smallint,
  installment_total smallint,
  is_overridden boolean NOT NULL DEFAULT false,
  overridden_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  CHECK (source IN ('auto_generated', 'manual')),
  CHECK (component IN (
    'imposta_saldo', 'imposta_acconto_1', 'imposta_acconto_2',
    'imposta_acconto_unico', 'inps_saldo', 'inps_acconto_1',
    'inps_acconto_2', 'bollo'
  )),
  CHECK (amount >= 0)
);

ALTER TABLE fiscal_obligations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fiscal_obligations_user" ON fiscal_obligations
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_fiscal_obligations_payment_year
  ON fiscal_obligations(user_id, payment_year, due_date);
CREATE INDEX idx_fiscal_obligations_declaration
  ON fiscal_obligations(declaration_id);

-- fiscal_f24_submissions: one F24 event
CREATE TABLE IF NOT EXISTS fiscal_f24_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id)
);

ALTER TABLE fiscal_f24_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fiscal_f24_submissions_user" ON fiscal_f24_submissions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- fiscal_f24_payment_lines: allocated to obligations
CREATE TABLE IF NOT EXISTS fiscal_f24_payment_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES fiscal_f24_submissions(id) ON DELETE CASCADE,
  obligation_id uuid NOT NULL REFERENCES fiscal_obligations(id),
  amount numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  CHECK (amount > 0)
);

ALTER TABLE fiscal_f24_payment_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fiscal_f24_payment_lines_user" ON fiscal_f24_payment_lines
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_fiscal_f24_lines_obligation
  ON fiscal_f24_payment_lines(obligation_id);
CREATE INDEX idx_fiscal_f24_lines_submission
  ON fiscal_f24_payment_lines(submission_id);

-- Enriched view: payment lines with submission_date (avoids broad fetch + in-memory join)
CREATE OR REPLACE VIEW fiscal_f24_payment_lines_enriched AS
SELECT
  l.id,
  l.submission_id,
  l.obligation_id,
  l.amount,
  l.created_at,
  l.user_id,
  s.submission_date
FROM fiscal_f24_payment_lines l
JOIN fiscal_f24_submissions s ON s.id = l.submission_id;

ALTER VIEW fiscal_f24_payment_lines_enriched SET (security_invoker = on);

-- Trigger: copy user_id from submission to payment lines and validate cross-user
CREATE OR REPLACE FUNCTION sync_f24_payment_line_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id := (SELECT user_id FROM fiscal_f24_submissions WHERE id = NEW.submission_id);
  IF NEW.user_id IS DISTINCT FROM (SELECT user_id FROM fiscal_obligations WHERE id = NEW.obligation_id) THEN
    RAISE EXCEPTION 'obligation user_id mismatch with submission user_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_f24_payment_line_user_id
  BEFORE INSERT ON fiscal_f24_payment_lines
  FOR EACH ROW EXECUTE FUNCTION sync_f24_payment_line_user_id();

-- Trigger: block-only — prevent deleting declarations that have obligations with payment lines
CREATE OR REPLACE FUNCTION prevent_declaration_delete_with_paid_obligations()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM fiscal_obligations o
    JOIN fiscal_f24_payment_lines pl ON pl.obligation_id = o.id
    WHERE o.declaration_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot delete declaration with obligations that have allocated payments. Remove payments first.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_declaration_delete_with_paid_obligations
  BEFORE DELETE ON fiscal_declarations
  FOR EACH ROW EXECUTE FUNCTION prevent_declaration_delete_with_paid_obligations();

-- Trigger: prevent deleting obligations that have payment lines
CREATE OR REPLACE FUNCTION prevent_obligation_delete_with_payments()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM fiscal_f24_payment_lines WHERE obligation_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete obligation with allocated payments. Remove payments first.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_obligation_delete_with_payments
  BEFORE DELETE ON fiscal_obligations
  FOR EACH ROW EXECUTE FUNCTION prevent_obligation_delete_with_payments();

-- updated_at triggers
CREATE TRIGGER set_updated_at_fiscal_declarations
  BEFORE UPDATE ON fiscal_declarations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_fiscal_obligations
  BEFORE UPDATE ON fiscal_obligations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
