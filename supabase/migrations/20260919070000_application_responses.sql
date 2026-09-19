-- What this person was actually asked, and what they actually wrote.
--
-- Today an Application's answers live in a free-form `raw_answers` blob
-- keyed by short codes — `le_main_pattern` — and the QUESTION is
-- reconstructed at render time from answerLabels.ts. That works only while
-- that file still happens to contain the wording used on the day somebody
-- submitted. Edit the file and every historical Application silently
-- changes what it claims to have asked.
--
-- The recovered Notion history makes the problem concrete. Three source
-- forms are preserved, and two of them differ in exactly one question:
--
--   "What are you hoping with program with Leif helps you create?"
--   "What are you hoping with program with Leif helps you create in your
--    life and relationships?"
--
-- Same person-facing intent, different words, different answers. Folding
-- those onto one modern label would quietly rewrite what a real person was
-- asked. So the question travels WITH the answer, as text, at the position
-- it appeared, and nothing reconstructs it later.
--
-- This migration is deterministic: the table, its protections and the
-- function that reads a preserved snapshot. Running that function over
-- THIS database's real submissions is a production act and lives in
-- 20260919080000.

begin;

-- ---------------------------------------------------------------------
-- 1. Which form somebody filled in
-- ---------------------------------------------------------------------
-- The smallest provenance that answers "six months from now, what exactly
-- did this human answer": a stable key, and the label a person reads.
alter table public.applications
  add column if not exists form_key text;
alter table public.applications
  add column if not exists form_label text;

comment on column public.applications.form_key is
  'Stable identifier of the form version this Application was submitted through — a Notion source database id for recovered history, or a form key for a native submission. Never reused across differently-worded forms.';
comment on column public.applications.form_label is
  'What that form is called in words, for display. E.g. "Growing Yourself Up App — Jan 2027".';

-- ---------------------------------------------------------------------
-- 2. The responses themselves
-- ---------------------------------------------------------------------
create table if not exists public.application_responses (
  id bigint generated always as identity primary key,
  application_id bigint not null
    references public.applications(id) on update cascade on delete cascade,
  -- Order as the form presented it. The Notion export preserves column
  -- order in an array, which is why the snapshot keeps `columns` and
  -- `values` as parallel arrays rather than an object: jsonb reorders
  -- object keys and would have lost this.
  position smallint not null,
  -- Present for native submissions (the form's own key). NULL for
  -- recovered history, where no key ever existed — only wording.
  question_key text,
  -- The exact words, as asked. Never derived from a labels file.
  question_text text not null,
  -- The exact answer, byte for byte. NULL means the question was asked
  -- and left empty, which is different from the question not being there.
  answer_text text,
  answered boolean not null default false,
  -- Which preserved snapshot this row was read out of, so the provenance
  -- stays inspectable without exposing the sealed snapshot itself.
  source_snapshot_id bigint
    references public.historical_application_source_snapshots(id)
    on update cascade on delete set null,
  materialized_at timestamptz not null default now(),

  -- One Application can never receive another's answers at the same slot.
  constraint application_responses_one_per_slot unique (application_id, position),
  -- An unanswered row cannot carry text, and an answered one must.
  constraint application_responses_answered_agrees check (
    answered = (answer_text is not null and btrim(answer_text) <> '')
  )
);

create index if not exists application_responses_application_id_idx
  on public.application_responses (application_id, position);

comment on table public.application_responses is
  'The exact questions an applicant was asked and the exact answers they gave, in the order presented. An immutable submission snapshot: the question text travels with the answer so no later edit to a labels file can change what a historical Application claims to have asked.';

-- ---------------------------------------------------------------------
-- 3. Immutable, and readable only where Leif already reads Applications
-- ---------------------------------------------------------------------
-- These are a person's own words about what they are struggling with.
-- The CRM may read them; nothing may quietly rewrite them.
alter table public.application_responses enable row level security;

drop policy if exists "Application responses are readable" on public.application_responses;
create policy "Application responses are readable"
  on public.application_responses
  for select
  to authenticated
  using (true);

-- No insert/update/delete policy exists, deliberately. Writes go through
-- the security-definer materializer below, which is the only path.
revoke all on public.application_responses from anon;
grant select on public.application_responses to authenticated;

-- A policy governs the API role; it does not stop a privileged session.
-- This does, unless the caller explicitly declares a controlled rewrite —
-- the same narrow, transaction-local escape hatch the historical importer
-- already uses elsewhere.
create or replace function public.reject_application_response_mutation()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if current_setting('app.migration_mode', true) = 'true' then
    return coalesce(new, old);
  end if;
  raise exception 'application_responses is an immutable submission record; % is not allowed', tg_op
    using hint = 'Responses are written once by materialize_application_responses() or at submission time. Correcting one means re-materialising from its source snapshot.';
end;
$$;

drop trigger if exists reject_application_response_mutation on public.application_responses;
create trigger reject_application_response_mutation
  before update or delete on public.application_responses
  for each row execute function public.reject_application_response_mutation();

-- ---------------------------------------------------------------------
-- 4. Reading a preserved snapshot
-- ---------------------------------------------------------------------
-- The snapshot keeps `columns` and `values` as parallel ordered arrays,
-- so position comes from the source rather than from anything inferred.
--
-- Which columns are QUESTIONS is decided by naming the metadata instead:
-- an applicant's name, their email, Leif's own notes, the Notion status
-- and the submission time are record-keeping, not things anybody was
-- asked. Listing the metadata rather than the questions is deliberate —
-- a new question in a future form is then included automatically, whereas
-- a new metadata column would have to be added here on purpose.
--
-- Today's answerLabels.ts is not consulted. It describes the current
-- native form and has nothing to say about what was asked in 2026.
create or replace function public.materialize_application_responses(
  p_snapshot_id bigint
) returns int
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_snapshot historical_application_source_snapshots%rowtype;
  v_written int := 0;
  v_metadata constant text[] := array[
    'Full Name', 'Your name:', 'Email', 'Status', 'Submission time',
    'Call Booked', 'Notes', 'My notes', 'Respondent'
  ];
begin
  select * into v_snapshot
    from historical_application_source_snapshots where id = p_snapshot_id;
  if not found then
    raise exception 'snapshot % does not exist', p_snapshot_id;
  end if;

  if v_snapshot.application_id is null then
    raise exception 'snapshot % is not attached to an Application; copy artifacts and evidence-only rows must never produce responses', p_snapshot_id;
  end if;
  if v_snapshot.is_copy_artifact then
    raise exception 'snapshot % is a copy artifact', p_snapshot_id;
  end if;

  insert into application_responses
    (application_id, position, question_key, question_text,
     answer_text, answered, source_snapshot_id)
  select
    v_snapshot.application_id,
    row_number() over (order by c.ordinality)::smallint,
    null,
    c.value #>> '{}',
    nullif(btrim(coalesce(v.value #>> '{}', '')), ''),
    nullif(btrim(coalesce(v.value #>> '{}', '')), '') is not null,
    v_snapshot.id
  from jsonb_array_elements(v_snapshot.raw_snapshot->'columns')
         with ordinality c(value, ordinality)
  join jsonb_array_elements(v_snapshot.raw_snapshot->'values')
         with ordinality v(value, ordinality)
    on v.ordinality = c.ordinality
  where not ((c.value #>> '{}') = any (v_metadata))
  on conflict (application_id, position) do nothing;

  get diagnostics v_written = row_count;
  return v_written;
end;
$$;

comment on function public.materialize_application_responses(bigint) is
  'Reads one preserved Notion snapshot into application_responses, preserving exact question wording, exact answer text and source order. Refuses copy artifacts and snapshots with no Application. Never consults answerLabels.ts.';

revoke all on function public.materialize_application_responses(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. An Application cannot point at somebody else's sales attempt
-- ---------------------------------------------------------------------
-- A cross-table rule, so it is a trigger rather than a CHECK pretending
-- it can see another table. Fourteen Applications currently point at an
-- Opportunity for the WRONG Offer — a Living Example submission attached
-- to a Growing Yourself Up attempt — which makes the drawer show one
-- programme's answers under another's heading.
create or replace function public.enforce_application_opportunity_agreement()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_deal deals%rowtype;
begin
  if new.opportunity_id is null then
    return new;
  end if;

  select * into v_deal from deals where id = new.opportunity_id;
  if not found then
    raise exception 'Application % points at Opportunity %, which does not exist',
      coalesce(new.id::text, 'new'), new.opportunity_id;
  end if;

  if v_deal.contact_id is distinct from new.contact_id then
    raise exception 'Application % belongs to Contact % but Opportunity % belongs to Contact %',
      coalesce(new.id::text, 'new'), new.contact_id, v_deal.id, v_deal.contact_id;
  end if;

  if v_deal.offer_id is distinct from new.offer_id then
    raise exception 'Application % is for Offer % but Opportunity % is for Offer %; an application cannot belong to a sales attempt for a different programme',
      coalesce(new.id::text, 'new'), new.offer_id, v_deal.id, v_deal.offer_id;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_application_opportunity_agreement on public.applications;
create trigger enforce_application_opportunity_agreement
  before insert or update of opportunity_id, contact_id, offer_id
  on public.applications
  for each row execute function public.enforce_application_opportunity_agreement();

-- ---------------------------------------------------------------------
-- 6. Deleting a sales attempt must not delete the submission
-- ---------------------------------------------------------------------
-- applications.opportunity_id was ON DELETE CASCADE, so removing an
-- Opportunity destroyed the Application that produced it. A submission is
-- evidence that somebody applied; it stays true whether or not the sales
-- attempt it led to still exists.
alter table public.applications
  drop constraint if exists applications_opportunity_id_fkey;
alter table public.applications
  add constraint applications_opportunity_id_fkey
  foreign key (opportunity_id) references public.deals(id)
  on update cascade on delete set null;

-- ---------------------------------------------------------------------
-- 7. Prove it landed
-- ---------------------------------------------------------------------
do $$
declare
  v_missing text := '';
  v_delete_rule text;
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema='public' and table_name='application_responses') then
    v_missing := v_missing || 'application_responses '; end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                  where n.nspname='public' and p.proname='materialize_application_responses') then
    v_missing := v_missing || 'materialize_application_responses() '; end if;
  if not exists (select 1 from pg_trigger where tgname='enforce_application_opportunity_agreement') then
    v_missing := v_missing || 'enforce_application_opportunity_agreement '; end if;
  if not exists (select 1 from pg_trigger where tgname='reject_application_response_mutation') then
    v_missing := v_missing || 'reject_application_response_mutation '; end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
                  where n.nspname='public' and c.relname='application_responses'
                    and c.relrowsecurity) then
    v_missing := v_missing || 'RLS on application_responses '; end if;

  select rc.delete_rule into v_delete_rule
    from information_schema.referential_constraints rc
   where rc.constraint_name = 'applications_opportunity_id_fkey';
  if v_delete_rule is distinct from 'SET NULL' then
    v_missing := v_missing || format('opportunity FK delete rule is %s, expected SET NULL ',
      coalesce(v_delete_rule, 'absent'));
  end if;

  if v_missing <> '' then
    raise exception 'application response structure did not land: %', v_missing;
  end if;
end $$;

commit;
