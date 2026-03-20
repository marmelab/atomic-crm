ALTER TABLE public.contact_notes ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.deal_notes ADD COLUMN IF NOT EXISTS type text;
