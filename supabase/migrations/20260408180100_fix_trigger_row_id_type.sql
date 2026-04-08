--
-- Fix: n8n_workflow_runs.trigger_row_id should be TEXT, not UUID.
-- CRM tables use bigint IDs, so UUID can't reference them.
-- TEXT accommodates any ID type.
--

ALTER TABLE public.n8n_workflow_runs
  ALTER COLUMN trigger_row_id TYPE TEXT USING trigger_row_id::TEXT;
