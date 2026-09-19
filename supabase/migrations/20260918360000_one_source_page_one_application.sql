-- One external source page produces at most one Application.
--
-- Two Applications were about to be created from Notion source rows, and
-- nothing in the schema could have stopped a repeat run creating them
-- twice: applications carries only its primary key, and no record of where
-- a row came from. A WHERE NOT EXISTS check is not that guard — two runs
-- can both read "not there" and both insert.
--
-- The invariant goes on applications, because applications is the table
-- that must not gain a duplicate row. A concurrent second attempt then
-- collides on the index instead of succeeding.
--
-- Deliberately NOT the mirror invariant. Making
-- historical_application_source_snapshots.application_id unique would say
-- "one Application has at most one snapshot", which contradicts the
-- versioning model: a Notion page edited upstream is captured as a second
-- snapshot beside the first, and both legitimately describe the same
-- Application. The direction that needs enforcing is source -> Application,
-- and only that one.
--
-- source_page_id stays nullable and the 159 imported Applications are left
-- alone. Backfilling them belongs to the Application integrity repair,
-- where the linkage can be proved row by row rather than assumed here.

begin;

alter table public.applications
  add column if not exists source_page_id text;

comment on column public.applications.source_page_id is
  'The external source page this Application was created from, where one is known. Unique among non-null values: one source submission can never become two Applications.';

create unique index if not exists applications_source_page_id_key
  on public.applications (source_page_id)
  where source_page_id is not null;

-- ---------------------------------------------------------------------
-- What we concluded about a source row, kept apart from the row itself
-- ---------------------------------------------------------------------
-- capture_note is prose about the capture. This is a decision about the
-- evidence, and a decision that other code may act on has to be machine
-- readable. Raw evidence and our interpretation of it stay separate.
alter table public.historical_application_source_snapshots
  add column if not exists reconciliation_state text;

alter table public.historical_application_source_snapshots
  drop constraint if exists historical_application_source_snapshots_reconciliation_check;
alter table public.historical_application_source_snapshots
  add constraint historical_application_source_snapshots_reconciliation_check check (
    reconciliation_state is null
    -- The only state anybody has decided so far. A source row with a name
    -- and no email address cannot be matched the way every other identity
    -- in this system is, so it stays evidence rather than becoming a
    -- Contact that looks certain and is not. More states get added when
    -- they are actually decided, not in advance.
    or reconciliation_state = 'evidence_only_identity_insufficient'
  );

comment on column public.historical_application_source_snapshots.reconciliation_state is
  'What was decided about this source row, where a decision exists. Null means undecided — never "nothing to decide". Separate from is_copy_artifact, which is a fact about the source rather than a conclusion about it.';

-- ---------------------------------------------------------------------
-- Assert, without writing probe rows into a migration
-- ---------------------------------------------------------------------
-- The guard itself is exercised separately, against a transaction that is
-- deliberately rolled back. A migration that inserts test rows to prove
-- itself is a migration that can leave them behind.
do $$
begin
  if exists (select 1 from public.applications
             where source_page_id is not null
             group by source_page_id having count(*) > 1) then
    raise exception 'source_page_id already contains duplicate values';
  end if;

  if not exists (select 1 from pg_indexes
                 where schemaname = 'public'
                   and indexname = 'applications_source_page_id_key') then
    raise exception 'the source_page_id guard index was not created';
  end if;

  -- The versioning model must still be keyed on content, not on the
  -- Application, or a re-captured page could no longer be kept beside its
  -- earlier state.
  if not exists (select 1 from pg_indexes
                 where schemaname = 'public'
                   and indexname = 'historical_application_source_snapshots_database_content_key') then
    raise exception 'the snapshot versioning index is missing';
  end if;
  if exists (select 1 from pg_indexes
             where schemaname = 'public'
               and tablename = 'historical_application_source_snapshots'
               and indexdef ilike '%unique%'
               and indexdef ilike '%(application_id)%') then
    raise exception 'application_id was made unique; that breaks snapshot versioning';
  end if;
end $$;

commit;
