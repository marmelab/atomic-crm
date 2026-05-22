-- Fas 6A: immutable audit snapshots for the quote workflow.
--
-- A snapshot is a point-in-time copy of the full quote state + line items,
-- taken AFTER a critical mutation succeeds. Snapshots are write-once from
-- the application (service role only, no INSERT policy for authenticated
-- users) and provide:
--   - audit trail: who changed what, and when
--   - reproducibility: reconstruct the exact state a customer saw
--   - debugging: compare before/after states across status transitions
--
-- Fas 6A scope (per Codex review):
--   Events: content_edited, sent_for_signing, viewed, signed, declined,
--           expired, approval_confirmed
--   Excluded: html_content (too large, deferred to Fas 6B)
--             write_token, approval_token (security-sensitive, never stored)
--   No retention policy yet — deferred to post-launch review.

CREATE TABLE IF NOT EXISTS public.quote_snapshots (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id          bigint      NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,

  -- What triggered this snapshot
  trigger_event     text        NOT NULL CHECK (trigger_event IN (
    'content_edited',
    'sent_for_signing',
    'viewed',
    'signed',
    'declined',
    'expired',
    'approval_confirmed'
  )),

  -- Status before and after the transition (NULL for non-status events)
  old_status        text,
  new_status        text,

  -- Who triggered it
  initiator_source  text        NOT NULL CHECK (initiator_source IN (
    'crm_seller',
    'public_editor',
    'discord_approval',
    'docuseal_webhook',
    'system'
  )),
  -- NULL when the initiator is a webhook, automation, or system process
  initiator_user_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Full quote state at snapshot time (excludes write_token, approval_token,
  -- html_content — see module header for rationale)
  quote_state       jsonb       NOT NULL,

  -- All quote_line_items rows at snapshot time (ordered by sort_order)
  line_items        jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- Schema version — bump when quote_state shape changes across phases
  snapshot_version  integer     NOT NULL DEFAULT 1,

  -- Free-form context: source pipeline step, docuseal submission id, etc.
  metadata          jsonb       NOT NULL DEFAULT '{}'::jsonb,

  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup: all snapshots for a quote, newest first
CREATE INDEX IF NOT EXISTS idx_quote_snapshots_quote_id
  ON public.quote_snapshots(quote_id, created_at DESC);

-- Filter by event type within a quote (e.g. "all sent_for_signing events")
CREATE INDEX IF NOT EXISTS idx_quote_snapshots_trigger_event
  ON public.quote_snapshots(quote_id, trigger_event);

-- RLS: authenticated CRM users can read; only service role can write
-- (no INSERT/UPDATE/DELETE policy → application inserts via service role key)
ALTER TABLE public.quote_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view quote snapshots"
  ON public.quote_snapshots;

CREATE POLICY "Authenticated users can view quote snapshots"
  ON public.quote_snapshots
  FOR SELECT
  USING (auth.role() = 'authenticated');
