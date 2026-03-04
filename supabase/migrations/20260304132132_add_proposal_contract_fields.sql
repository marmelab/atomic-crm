-- Add proposal & contract fields to quotes table
-- These turn a simple "preventivo" into a full proposal/contract document

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS scope_of_work TEXT,
  ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT,
  ADD COLUMN IF NOT EXISTS deliverables TEXT,
  ADD COLUMN IF NOT EXISTS validity_days INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS contract_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.quotes.scope_of_work IS 'Detailed scope of work for the proposal';
COMMENT ON COLUMN public.quotes.terms_and_conditions IS 'Terms and conditions text';
COMMENT ON COLUMN public.quotes.deliverables IS 'Expected deliverables description';
COMMENT ON COLUMN public.quotes.validity_days IS 'Number of days the quote is valid from sent_date';
COMMENT ON COLUMN public.quotes.contract_accepted_at IS 'When the client accepted the contract (set on status change to accettato)';
