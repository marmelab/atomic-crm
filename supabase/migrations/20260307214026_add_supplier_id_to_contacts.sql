-- Allow contacts to be linked to a supplier (same pattern as client_id)
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;
