-- Somewhere to put the source before it can disappear.
--
-- All 159 Applications carry raw_answers = {}. The Notion pull that
-- created them only ever retrieved url, email, name, status and
-- submitted_at, so the answers people actually wrote were never imported.
-- The pages themselves still exist, and their URLs survive in
-- historical_import_records — which makes the content recoverable and
-- makes Notion the one upstream source in this whole repair that can
-- still change or be deleted underneath us.
--
-- This table is evidence, captured before any parsing. Slice 4 turns it
-- into application_responses; nothing here interprets it. In particular:
--
--   raw_response_text is the verbatim bytes the source returned. jsonb
--   reorders object keys and drops duplicates, and the property ORDER is
--   part of what has to be preserved — the property name is the question
--   wording and its position is the question number. So the parsed jsonb
--   is kept for querying and the original text is kept for truth.
--
-- It holds real applicant PII, so it is reachable by nobody the browser
-- can become. See section 3.

begin;

create table if not exists public.historical_application_source_snapshots (
  id bigint generated always as identity primary key,

  -- restrict, not cascade: deleting an Application must never destroy the
  -- evidence of what that person submitted.
  application_id bigint not null
    references public.applications (id) on delete restrict,

  source_system text not null default 'notion'
    check (source_system in ('notion')),
  source_url text not null,
  notion_page_id text not null,

  -- What the source says about itself, where it says anything at all.
  -- Null means the source did not expose it — never a guess.
  source_created_at timestamptz,
  source_last_edited_at timestamptz,

  captured_at timestamptz not null default now(),

  raw_snapshot jsonb not null,
  raw_response_text text not null,
  -- sha256 of raw_response_text, computed at capture time over the bytes
  -- received, not over the normalised jsonb.
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),

  capture_note text
);

-- Idempotency, and the reason it is (application_id, content_hash) rather
-- than application_id alone: re-capturing identical content does nothing,
-- but if the page CHANGED upstream the new bytes hash differently and land
-- as a second row beside the first. Two evidentiary states, both kept —
-- silently overwriting the earlier one would destroy the very thing this
-- table exists to hold.
create unique index if not exists
  historical_application_source_snapshots_application_content_key
  on public.historical_application_source_snapshots (application_id, content_hash);

create index if not exists
  historical_application_source_snapshots_application_idx
  on public.historical_application_source_snapshots (application_id);

create index if not exists
  historical_application_source_snapshots_page_idx
  on public.historical_application_source_snapshots (notion_page_id);

comment on table public.historical_application_source_snapshots is
  'Raw, unparsed source evidence for historical Applications. Contains real applicant PII: no browser-reachable role may read it. One row per (application, distinct source content); a changed source adds a row rather than replacing one.';
comment on column public.historical_application_source_snapshots.raw_response_text is
  'The verbatim response bytes. Authoritative for property order and exact wording, because jsonb does not preserve key order.';
comment on column public.historical_application_source_snapshots.content_hash is
  'sha256 of raw_response_text, computed at capture time.';

-- ---------------------------------------------------------------------
-- 3. Not a frontend surface
-- ---------------------------------------------------------------------
-- RLS on with no policies at all: even if a grant were ever added by
-- accident, every row stays invisible to a policy-bound role. The grants
-- are revoked as well, so the failure is "permission denied" long before
-- RLS is consulted. Two independent locks, deliberately.
alter table public.historical_application_source_snapshots
  enable row level security;

revoke all on table public.historical_application_source_snapshots from public;
revoke all on table public.historical_application_source_snapshots from anon;
revoke all on table public.historical_application_source_snapshots from authenticated;
-- service_role bypasses RLS, so granting it here would undo the lock. The
-- capture and the Slice 4 parse both run as the owner, in SQL.
revoke all on table public.historical_application_source_snapshots from service_role;

-- ---------------------------------------------------------------------
-- 4. Prove the lock rather than assume it
-- ---------------------------------------------------------------------
do $$
declare
  v_role text;
  v_priv text;
begin
  foreach v_role in array array['anon', 'authenticated', 'service_role', 'public']
  loop
    foreach v_priv in array array['select', 'insert', 'update', 'delete']
    loop
      if has_table_privilege(
           v_role, 'public.historical_application_source_snapshots', v_priv) then
        raise exception '% still has % on the snapshot table', v_role, v_priv;
      end if;
    end loop;
  end loop;

  if not (select relrowsecurity from pg_class
          where oid = 'public.historical_application_source_snapshots'::regclass) then
    raise exception 'row level security is not enabled on the snapshot table';
  end if;

  if (select count(*) from pg_policy
      where polrelid = 'public.historical_application_source_snapshots'::regclass) <> 0 then
    raise exception 'the snapshot table has policies; it should have none';
  end if;
end $$;

commit;
