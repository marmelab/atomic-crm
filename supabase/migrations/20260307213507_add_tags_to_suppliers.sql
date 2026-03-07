-- Add tags column to suppliers (same pattern as clients)
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS tags bigint[] NOT NULL DEFAULT '{}';
