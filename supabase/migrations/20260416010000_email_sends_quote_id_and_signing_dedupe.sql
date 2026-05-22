-- Phase 6B: email idempotence for quote signing flows.
--
-- We need a stable quote-level key on email_sends so signing invitations can
-- reserve a single outbound email per quote. The column is nullable to keep
-- the migration additive and avoid forcing a backfill of legacy rows.
--
-- The unique partial index only applies to docuseal_signing emails. Other
-- email_sends use cases keep their existing behavior until we decide to
-- tighten them explicitly.

alter table public.email_sends
  add column if not exists quote_id bigint references public.quotes(id) on delete set null;

create index if not exists idx_email_sends_quote_id
  on public.email_sends (quote_id);

create unique index if not exists idx_email_sends_quote_docuseal_signing_unique
  on public.email_sends (quote_id, ((metadata->>'signing_url')))
  where quote_id is not null
    and metadata->>'source' = 'docuseal_signing'
    and metadata->>'signing_url' is not null;
