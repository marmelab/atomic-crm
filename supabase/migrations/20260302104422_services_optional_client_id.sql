-- Allow services to be linked directly to a client without requiring a project.
-- Mirrors the pattern already used by the expenses table.

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Back-fill client_id from the project for all existing rows.
UPDATE public.services s
SET client_id = p.client_id
FROM public.projects p
WHERE s.project_id = p.id
  AND s.client_id IS NULL;

-- Index for filtering / joining by client.
CREATE INDEX IF NOT EXISTS idx_services_client_id ON public.services(client_id);
