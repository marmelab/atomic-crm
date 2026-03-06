-- Expand trigger_resource CHECK to include all 8 supported resources
-- (original migration only had projects, quotes, payments, client_tasks)

ALTER TABLE public.workflows
  DROP CONSTRAINT IF EXISTS workflows_trigger_resource_check;

ALTER TABLE public.workflows
  ADD CONSTRAINT workflows_trigger_resource_check
  CHECK (trigger_resource IN (
    'clients',
    'contacts',
    'projects',
    'quotes',
    'services',
    'payments',
    'expenses',
    'client_tasks'
  ));
