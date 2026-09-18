-- Source evidence stops depending on a CRM Application existing.
--
-- The export turned up 218 source rows against 159 Applications. Three are
-- genuine submissions the import never saw. Fifty-six are something else
-- entirely: the "Growing Yourself Up App — Jan 2027" database was created
-- as a whole-table copy of the original GYU database, and all 56 copied
-- rows carry the same creation instant, 2026-08-27 16:24:15Z or :16Z. They
-- are construction artifacts, not applications, and must never become CRM
-- records.
--
-- All of it is still evidence. A snapshot now stands on its own and links
-- to an Application only when one exists — because making a CRM row the
-- precondition for preserving source truth gets the dependency backwards,
-- and the alternative (inventing Applications to hang evidence on) would
-- be inventing business records.
--
-- Two more things the export forced:
--
--   The January copy gave 56 rows one shared instant, so a row cannot be
--   told from its neighbours by any evidence we hold. Those are recorded
--   as unbound rather than guessed — page_id_binding says exactly how each
--   page id was established, or that it was not.
--
--   Identity moves from (application_id, content_hash) to
--   (source_database_id, content_hash): a row with no Application still
--   needs to be deduplicated, and the database it came from is the thing
--   that is always known.

begin;

alter table public.historical_application_source_snapshots
  alter column application_id drop not null,
  alter column notion_page_id drop not null,
  alter column source_url drop not null;

alter table public.historical_application_source_snapshots
  add column if not exists source_database_id text,
  add column if not exists source_data_source_id text,
  add column if not exists source_database_title text,
  add column if not exists page_id_binding text,
  add column if not exists is_copy_artifact boolean not null default false,
  add column if not exists notion_status text,
  add column if not exists submitted_at timestamptz,
  add column if not exists source_file_sha256 text;

-- The table is empty, so these can be NOT NULL immediately rather than
-- being left permanently optional "for the existing rows".
alter table public.historical_application_source_snapshots
  alter column source_database_id set not null,
  alter column page_id_binding set not null;

alter table public.historical_application_source_snapshots
  drop constraint if exists historical_application_source_snapshots_binding_check;
alter table public.historical_application_source_snapshots
  add constraint historical_application_source_snapshots_binding_check check (
    page_id_binding in (
      -- The row's submission instant identifies exactly one Notion page.
      'submission_time_unique',
      'submission_time_unique_copy_artifact',
      -- Several pages share the instant; no evidence separates them.
      'unbound_ambiguous_instant'
    )
  );

-- A bound row must actually carry the page id its binding claims, and an
-- unbound one must not pretend to have one.
alter table public.historical_application_source_snapshots
  drop constraint if exists historical_application_source_snapshots_page_id_check;
alter table public.historical_application_source_snapshots
  add constraint historical_application_source_snapshots_page_id_check check (
    (page_id_binding = 'unbound_ambiguous_instant' and notion_page_id is null)
    or (page_id_binding <> 'unbound_ambiguous_instant' and notion_page_id is not null)
  );

drop index if exists
  public.historical_application_source_snapshots_application_content_key;

-- Same rule as before, on a key every row has: identical bytes from one
-- database are one snapshot; changed bytes are a second state beside it.
create unique index if not exists
  historical_application_source_snapshots_database_content_key
  on public.historical_application_source_snapshots
     (source_database_id, content_hash);

create index if not exists
  historical_application_source_snapshots_artifact_idx
  on public.historical_application_source_snapshots (is_copy_artifact);

comment on column public.historical_application_source_snapshots.application_id is
  'The CRM Application this source row produced, when one exists. Null means the source predates or postdates any import of it — never that the evidence is less real.';
comment on column public.historical_application_source_snapshots.is_copy_artifact is
  'True for rows created by the 2026-08-27 whole-table copy that built the January database. Evidence of the copy, not of an application. Must never generate a CRM Application.';
comment on column public.historical_application_source_snapshots.page_id_binding is
  'How notion_page_id was established, or that it could not be. Never a guess.';

-- The lock is unchanged, and re-proved rather than assumed.
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
