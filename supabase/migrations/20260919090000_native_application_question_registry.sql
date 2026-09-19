-- What the live form asked, frozen at the moment somebody answered it.
--
-- A native submission stores its answers in raw_answers keyed by short
-- codes, and the QUESTION is reconstructed at render time from
-- answerLabels.ts. Reword a question there — which has already happened
-- twice, deliberately, without changing the keys — and every Application
-- ever submitted silently starts claiming it asked the new words.
--
-- The recovered Notion history is protected from that because the question
-- text travels with each answer. Native submissions need the same
-- guarantee, and a TypeScript file cannot give it: it has one value, the
-- current one.
--
-- So the wording lives in the database, versioned and immutable. A form
-- version is written once; changing a question means inserting a NEW
-- version, and every Application already submitted keeps pointing at the
-- one it was actually shown. Responses are materialised by a trigger in
-- the same transaction as the Application insert, so a submission can
-- never exist without the questions it answered.

begin;

-- ---------------------------------------------------------------------
-- 1. Form versions, and the questions they asked
-- ---------------------------------------------------------------------
create table if not exists public.application_form_versions (
  id bigint generated always as identity primary key,
  -- Stable across versions: "le_application", "gyu_application".
  form_key text not null,
  -- What a person reads. Carries the version, because that is the part
  -- that tells two wordings apart.
  form_label text not null,
  offer_id bigint references public.offers(id) on update cascade,
  -- Exactly one version per Offer may receive new submissions.
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  constraint application_form_versions_key_label_key unique (form_key, form_label)
);

create unique index if not exists application_form_versions_one_current_per_offer
  on public.application_form_versions (offer_id)
  where is_current;

create table if not exists public.application_form_questions (
  id bigint generated always as identity primary key,
  form_version_id bigint not null
    references public.application_form_versions(id) on update cascade on delete cascade,
  position smallint not null,
  -- The key the form submits its answer under, which is how an answer
  -- finds its question.
  question_key text not null,
  -- The exact words shown. Visual treatment (an italicised word) is not
  -- content and is not represented here.
  question_text text not null,
  constraint application_form_questions_one_per_slot unique (form_version_id, position),
  constraint application_form_questions_one_per_key unique (form_version_id, question_key)
);

comment on table public.application_form_versions is
  'Immutable record of a native application form as it was worded. Changing a question means a NEW version, never an edit: Applications already submitted must keep pointing at the wording they were actually shown.';

alter table public.application_form_versions enable row level security;
alter table public.application_form_questions enable row level security;

drop policy if exists "Form versions are readable" on public.application_form_versions;
create policy "Form versions are readable" on public.application_form_versions
  for select to authenticated using (true);
drop policy if exists "Form questions are readable" on public.application_form_questions;
create policy "Form questions are readable" on public.application_form_questions
  for select to authenticated using (true);

grant select on public.application_form_versions to authenticated;
grant select on public.application_form_questions to authenticated;
revoke all on public.application_form_versions from anon;
revoke all on public.application_form_questions from anon;

-- ---------------------------------------------------------------------
-- 2. A submission materialises its own responses
-- ---------------------------------------------------------------------
-- A trigger rather than an extra call from the client, so the responses
-- and the Application are written in one transaction and a submission can
-- never land without them.
create or replace function public.materialize_native_application_responses()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_version application_form_versions%rowtype;
begin
  -- Recovered history is materialised from its preserved snapshot
  -- instead, and carries no raw_answers at all.
  if new.raw_answers is null or new.raw_answers = '{}'::jsonb then
    return new;
  end if;

  select * into v_version from application_form_versions
   where offer_id = new.offer_id and is_current;
  if not found then
    -- No registered wording for this Offer. The Application still stands;
    -- it simply has no question text to store, which is honest and
    -- visible rather than a guess from a labels file.
    return new;
  end if;

  update applications
     set form_key = v_version.form_key, form_label = v_version.form_label
   where id = new.id;

  insert into application_responses
    (application_id, position, question_key, question_text, answer_text, answered)
  select new.id,
         q.position,
         q.question_key,
         q.question_text,
         nullif(btrim(coalesce(new.raw_answers ->> q.question_key, '')), ''),
         nullif(btrim(coalesce(new.raw_answers ->> q.question_key, '')), '') is not null
    from application_form_questions q
   where q.form_version_id = v_version.id
  on conflict (application_id, position) do nothing;

  return new;
end;
$$;

drop trigger if exists on_application_materialize_responses on public.applications;
create trigger on_application_materialize_responses
  after insert on public.applications
  for each row execute function public.materialize_native_application_responses();

-- ---------------------------------------------------------------------
-- 3. The wording the live forms ask today
-- ---------------------------------------------------------------------
-- Deterministic configuration, seeded by Offer NAME so it reconstructs in
-- any database rather than depending on this one's serial ids. Kept
-- byte-identical to LivingExampleApplicationPage.tsx and
-- GrowingYourselfUpApplicationPage.tsx, typographic apostrophes and en
-- dashes included.
do $$
declare
  v_le bigint;
  v_gyu bigint;
  v_version bigint;
begin
  select id into v_le from public.offers where name = 'The Living Example';
  select id into v_gyu from public.offers where name = 'Growing Yourself Up';

  if v_le is not null and not exists (
    select 1 from public.application_form_versions where offer_id = v_le
  ) then
    insert into public.application_form_versions (form_key, form_label, offer_id, is_current)
    values ('le_application', 'The Living Example application', v_le, true)
    returning id into v_version;

    insert into public.application_form_questions (form_version_id, position, question_key, question_text)
    values
      (v_version, 1, 'le_main_pattern', 'What’s the main pattern, emotion, or relationship dynamic you’re struggling with right now?'),
      (v_version, 2, 'le_prior_attempts', 'What have you already tried to change or shift this?'),
      (v_version, 3, 'le_hoped_change', 'How are you hoping to change through working together?'),
      (v_version, 4, 'le_hoped_support', 'How are you hoping I will support you?'),
      (v_version, 5, 'le_commitment_scale', 'On a scale of 1–10, how committed are you to changing this pattern/way-of-being?');
  end if;

  if v_gyu is not null and not exists (
    select 1 from public.application_form_versions where offer_id = v_gyu
  ) then
    insert into public.application_form_versions (form_key, form_label, offer_id, is_current)
    values ('gyu_application', 'Growing Yourself Up application', v_gyu, true)
    returning id into v_version;

    insert into public.application_form_questions (form_version_id, position, question_key, question_text)
    values
      (v_version, 1, 'gyu_biggest_challenge', 'What’s the biggest challenge you’re facing in your personal growth and healing?'),
      -- Rendered with "now" italicised on the page. Emphasis is visual,
      -- not something the applicant answered differently because of.
      (v_version, 2, 'gyu_why_now', 'Why are you ready for support and change now?'),
      (v_version, 3, 'gyu_hoped_outcome', 'What are you hoping this program with Leif helps you create in your life and relationships?'),
      (v_version, 4, 'gyu_commitment_scale', 'On a scale from 1–10, how ready are you to make a time, financial, and personal commitment to the change you want?');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Prove it landed
-- ---------------------------------------------------------------------
do $$
declare
  v_missing text := '';
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema='public' and table_name='application_form_versions') then
    v_missing := v_missing || 'application_form_versions '; end if;
  if not exists (select 1 from information_schema.tables
                  where table_schema='public' and table_name='application_form_questions') then
    v_missing := v_missing || 'application_form_questions '; end if;
  if not exists (select 1 from pg_trigger where tgname='on_application_materialize_responses') then
    v_missing := v_missing || 'on_application_materialize_responses '; end if;
  if v_missing <> '' then
    raise exception 'native question registry did not land: %', v_missing;
  end if;

  -- Seeded only where the Offer exists, so an empty database is fine; a
  -- database WITH the Offers must have its wording.
  if exists (select 1 from public.offers where name = 'The Living Example')
     and not exists (select 1 from public.application_form_versions v
                      join public.offers o on o.id = v.offer_id
                     where o.name = 'The Living Example') then
    raise exception 'The Living Example has no registered application form wording';
  end if;
end $$;

commit;
