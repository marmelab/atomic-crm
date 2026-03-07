-- Allow tasks/reminders to be linked to a supplier
ALTER TABLE public.client_tasks
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;
