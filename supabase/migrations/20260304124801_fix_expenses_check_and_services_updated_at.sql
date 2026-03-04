-- Fix CHECK constraint on expenses.expense_type to include 'credito_ricevuto'
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_expense_type_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_expense_type_check
  CHECK (expense_type IN ('spostamento_km', 'acquisto_materiale', 'noleggio', 'altro', 'credito_ricevuto'));

-- Add updated_at column to services table
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create trigger for services updated_at if not exists
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_services_updated_at ON public.services;
CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Add index on payments.quote_id for better query performance
CREATE INDEX IF NOT EXISTS idx_payments_quote_id ON public.payments(quote_id);
