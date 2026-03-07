-- =============================================================================
-- Suppliers table + FK on expenses
-- =============================================================================

-- 1. Create suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  vat_number  text,
  fiscal_code text,
  phone       text,
  email       text,
  address     text,

  -- Billing profile (mirrors client billing fields)
  billing_address_street text,
  billing_address_number text,
  billing_postal_code    text,
  billing_city           text,
  billing_province       text,
  billing_country        text DEFAULT 'IT',
  billing_sdi_code       text,
  billing_pec            text,

  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Unique index on vat_number (when present) for dedup during invoice import
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_vat_number_unique
  ON public.suppliers (vat_number)
  WHERE vat_number IS NOT NULL AND vat_number <> '';

-- 2. RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read suppliers"
  ON public.suppliers FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert suppliers"
  ON public.suppliers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update suppliers"
  ON public.suppliers FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete suppliers"
  ON public.suppliers FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 3. updated_at trigger (reuse existing function from init)
CREATE TRIGGER set_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 4. Add supplier_id FK on expenses (nullable, zero impact on existing rows)
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id);

CREATE INDEX IF NOT EXISTS expenses_supplier_id_idx
  ON public.expenses (supplier_id)
  WHERE supplier_id IS NOT NULL;
