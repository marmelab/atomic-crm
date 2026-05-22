-- Phase 7: allow CRM frontend to read quote_pipeline_steps
--
-- quote_pipeline_steps was created in phase 1 with RLS enabled and zero
-- policies, which is correct for write-side observability (only service
-- role writes rows from edge functions via the pipelineLogger helper).
-- Phase 7 introduces a read-side consumer: the QuotePipelineView UI in
-- QuoteShow, which fetches pipeline rows per quote and renders a simple
-- stepper so sellers can see where each quote is in the workflow.
--
-- This migration adds the minimum SELECT policy needed for that UI to
-- work: any authenticated user can read any pipeline_steps row. That
-- matches the existing SELECT policy on the quotes table, which also
-- allows every authenticated CRM user to view every quote. Tightening
-- this to per-sales ownership would require a join to quotes; we defer
-- that until the quotes SELECT policy itself is tightened so the two
-- tables stay consistent.
--
-- Writes and updates remain service-role only by default (no INSERT /
-- UPDATE / DELETE policy is added here), so edge functions stay the
-- only writers and no client can mutate pipeline history.

drop policy if exists "Authenticated users can read quote pipeline steps"
  on public.quote_pipeline_steps;

create policy "Authenticated users can read quote pipeline steps"
  on public.quote_pipeline_steps
  for select
  to authenticated
  using (true);
