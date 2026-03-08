-- Allow notes to be linked to a supplier (same pattern as client_id)
ALTER TABLE public.client_notes
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE;

-- Make client_id nullable so a note can belong to a supplier without a client
ALTER TABLE public.client_notes
  ALTER COLUMN client_id DROP NOT NULL;

-- Add check: at least one of client_id or supplier_id must be set
ALTER TABLE public.client_notes
  ADD CONSTRAINT client_notes_owner_check CHECK (client_id IS NOT NULL OR supplier_id IS NOT NULL);

-- Allow financial documents to be linked to a supplier
ALTER TABLE public.financial_documents
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- Make client_id nullable so a supplier invoice can exist without a client link
ALTER TABLE public.financial_documents
  ALTER COLUMN client_id DROP NOT NULL;

-- Index for supplier lookups
CREATE INDEX IF NOT EXISTS client_notes_supplier_id_idx
  ON public.client_notes (supplier_id) WHERE supplier_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS financial_documents_supplier_id_idx
  ON public.financial_documents (supplier_id) WHERE supplier_id IS NOT NULL;
