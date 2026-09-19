-- A Task says something needs attention. It is not what makes it true.
--
-- Nothing in the schema said so, and the gaps all pointed the same way:
-- type was nullable with no vocabulary, completion was stored twice
-- (done_date AND status) with nothing keeping them honest, an Opportunity
-- had to be guessed from the Contact, and nothing stopped two open Tasks
-- pointing at one checklist item. Every one of those lets a projection
-- quietly become the only record of a condition.
--
-- This is the smallest schema that makes a Task a projection:
--
--   it names what it is about      opportunity_id, application_id, beside
--                                  the existing call/item/cadence links
--   it cannot be about nothing     a type vocabulary
--   it has one idea of "done"      done_date and status agree, enforced
--   it cannot be about the same    partial unique indexes, per target and
--   thing twice                    only while open
--
-- What it deliberately does NOT do: decide that every pending Application
-- needs a review Task. Ninety-nine Applications are pending in this
-- database, nearly all of them recovered history. A dedupe rule says "at
-- most one open Task per Application" — it does not say "at least one".
-- Manufacturing ninety-nine pieces of work would be inventing a backlog,
-- not surfacing one.

begin;

-- ---------------------------------------------------------------------
-- 1. When a Task came into existence
-- ---------------------------------------------------------------------
-- Nullable on purpose. New rows get a real timestamp; historical rows keep
-- NULL, because now() would be a manufactured creation date and a Task
-- that claims to have appeared today when it appeared in June is worse
-- than one that admits it does not know.
--
-- The two statements are deliberately separate. ADD COLUMN with a DEFAULT
-- writes that default into every EXISTING row, which would have stamped
-- today onto all twenty-three of them — the exact fabrication this is
-- avoiding. Adding it empty and setting the default afterwards leaves the
-- past alone and still gives every future row a real timestamp.
alter table public.tasks
  add column if not exists created_at timestamptz;

alter table public.tasks
  alter column created_at set default now();

comment on column public.tasks.created_at is
  'When the Task was created. NULL for rows that predate this column: their real creation time is unknown and defaulting them to now() would manufacture history.';

-- ---------------------------------------------------------------------
-- 2. What a Task is about
-- ---------------------------------------------------------------------
-- Routing used to guess the Opportunity from the Contact, which works
-- until somebody has two. Dax Kara has two Applications and two
-- Opportunities, and no rule can say which of them his review Task means.
-- An explicit column can at least be honestly empty.
alter table public.tasks
  add column if not exists opportunity_id bigint;
alter table public.tasks
  add column if not exists application_id bigint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_opportunity_id_fkey') then
    alter table public.tasks
      add constraint tasks_opportunity_id_fkey foreign key (opportunity_id)
      references public.deals(id) on update cascade on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_application_id_fkey') then
    alter table public.tasks
      add constraint tasks_application_id_fkey foreign key (application_id)
      references public.applications(id) on update cascade on delete set null;
  end if;
end $$;

create index if not exists tasks_opportunity_id_idx on public.tasks (opportunity_id);
create index if not exists tasks_application_id_idx on public.tasks (application_id);

comment on column public.tasks.opportunity_id is
  'The sales attempt this Task belongs to, where it belongs to one. NULL means no Opportunity could be identified deterministically — an honest gap, not a default.';
comment on column public.tasks.application_id is
  'The Application a review Task is about. Also the dedupe target: at most one open review Task per Application.';

-- ---------------------------------------------------------------------
-- 3. A Task is about something
-- ---------------------------------------------------------------------
-- The vocabulary, including the retired members. Retired types stay
-- permitted so their historical rows remain readable and editable — the
-- constraint exists to stop an invented type, not to relitigate the past.
-- Which types may be CREATED, and by whom, is a question the application
-- answers (see needsAttentionInventory.ts); a CHECK cannot tell a new row
-- from an old one.
alter table public.tasks
  alter column type set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_type_check') then
    alter table public.tasks
      add constraint tasks_type_check check (type in (
        -- live system projections
        'sales_call_needs_matching',
        'resolve_sales_call',
        'sales_call',
        'follow_up',
        'resolve_client_session_cadence',
        'onboarding_item',
        'offboarding_item',
        'review_application',
        -- manual
        'other',
        -- retired: readable, not newly generated
        'nurture_follow_up',
        'sales_call_cancelled',
        'sales_call_no_show',
        'check_payment'
      ));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. One idea of "done"
-- ---------------------------------------------------------------------
-- Completion was recorded in two places that nothing reconciled, so a row
-- could be done by one reading and open by the other. done_date is the
-- canonical fact — it is what every query already filters on — and status
-- must agree with it.
--
-- Every one of this database's twenty-three Tasks already satisfies this;
-- nothing is reinterpreted to make it fit.
do $$
declare
  v_bad int;
begin
  select count(*) into v_bad from public.tasks
   where (done_date is null) <> (status in ('pending', 'waiting'));
  if v_bad > 0 then
    raise exception '% Task(s) disagree with themselves about completion; refusing to add an invariant that would reinterpret them', v_bad;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tasks_completion_agreement_check') then
    alter table public.tasks
      add constraint tasks_completion_agreement_check check (
        (done_date is null) = (status in ('pending', 'waiting'))
      );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5. One open Task per thing that needs attention
-- ---------------------------------------------------------------------
-- Partial and per-target, never a blanket (contact_id, type): one person
-- may legitimately have two Opportunities, each with its own outstanding
-- call. The rule is "not twice about the SAME thing, while it is still
-- open" — a closed Task never blocks a new one, which is what makes
-- recreate-on-condition possible.
create unique index if not exists tasks_one_open_per_onboarding_item
  on public.tasks (onboarding_item_id)
  where done_date is null and onboarding_item_id is not null;

create unique index if not exists tasks_one_open_per_offboarding_item
  on public.tasks (offboarding_item_id)
  where done_date is null and offboarding_item_id is not null;

create unique index if not exists tasks_one_open_per_cadence_issue
  on public.tasks (cadence_issue_id)
  where done_date is null and cadence_issue_id is not null;

create unique index if not exists tasks_one_open_per_sales_call_type
  on public.tasks (sales_call_id, type)
  where done_date is null and sales_call_id is not null;

create unique index if not exists tasks_one_open_review_per_application
  on public.tasks (application_id)
  where done_date is null and application_id is not null;

-- ---------------------------------------------------------------------
-- 6. Deterministic linkage, by rule rather than by row
-- ---------------------------------------------------------------------
-- Backfilled only where the answer follows from data already recorded:
-- a call names its Opportunity, and a Contact with exactly one Opportunity
-- leaves nothing to choose between. A Contact with two is left NULL. This
-- is a rule, so it holds in an empty database too (where it moves nothing)
-- and on any future row that arrives unlinked.
update public.tasks t
   set opportunity_id = sc.opportunity_id
  from public.sales_calls sc
 where t.sales_call_id = sc.id
   and t.opportunity_id is null
   and sc.opportunity_id is not null;

update public.tasks t
   set opportunity_id = d.id
  from public.deals d
 where t.opportunity_id is null
   and t.sales_call_id is null
   and t.type in ('follow_up', 'sales_call', 'nurture_follow_up',
                  'sales_call_cancelled', 'sales_call_no_show')
   and d.contact_id = t.contact_id
   and (select count(*) from public.deals d2 where d2.contact_id = t.contact_id) = 1;

-- A review Task's Application, where the Contact has exactly one.
update public.tasks t
   set application_id = a.id,
       opportunity_id = coalesce(t.opportunity_id, a.opportunity_id)
  from public.applications a
 where t.type = 'review_application'
   and t.application_id is null
   and a.contact_id = t.contact_id
   and (select count(*) from public.applications a2 where a2.contact_id = t.contact_id) = 1;

-- ---------------------------------------------------------------------
-- 7. A completed projection cannot outlive its condition
-- ---------------------------------------------------------------------
-- The architectural rule: deleting or ticking off a system Task must not
-- erase a condition that is still true. Onboarding is where it matters
-- most — Lara Spagnola has five genuinely outstanding items, and if
-- clearing their Tasks could make the work disappear operationally, the
-- Task would have become the truth.
--
-- So the checklist item is the truth, and its Task follows it: reopening
-- an item reopens its Task, and if the Task was deleted outright a fresh
-- one is created. The partial unique index above is what makes this safe
-- to run repeatedly.
create or replace function public.sync_task_from_onboarding_item()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_enrollment enrollments%rowtype;
  v_deal deals%rowtype;
  v_contact_name text;
begin
  -- Item finished: close its open Task, if it still has one.
  if new.status = 'done' then
    update tasks
       set done_date = coalesce(done_date, coalesce(new.completed_at, now())),
           status = 'completed'
     where onboarding_item_id = new.id and done_date is null;
    return new;
  end if;

  -- Item is outstanding again (or still). One open Task, no more.
  if exists (select 1 from tasks where onboarding_item_id = new.id and done_date is null) then
    return new;
  end if;

  select * into v_enrollment from enrollments where id = new.enrollment_id;
  if not found then
    return new;
  end if;
  -- A finished client has no outstanding setup work.
  if v_enrollment.status in ('completed', 'withdrawn', 'ended') then
    return new;
  end if;

  select * into v_deal from deals where id = v_enrollment.opportunity_id;

  -- Prefer reopening the Task that already exists over creating a second
  -- record of the same request.
  update tasks
     set done_date = null, status = 'pending'
   where id = (
     select id from tasks
      where onboarding_item_id = new.id
      order by done_date desc nulls first, id desc
      limit 1);
  if found then
    return new;
  end if;

  select nullif(trim(both ' ' from coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '')
    into v_contact_name from contacts where id = v_deal.contact_id;

  insert into tasks (contact_id, type, text, due_date, status, enrollment_id, onboarding_item_id)
  values (
    v_deal.contact_id,
    'onboarding_item',
    replace(new.task_text_template, '{name}', coalesce(v_contact_name, v_deal.name)),
    now() + interval '3 days',
    'pending',
    new.enrollment_id,
    new.id
  );

  return new;
end;
$$;

drop trigger if exists on_onboarding_item_task_sync on public.enrollment_onboarding_items;
create trigger on_onboarding_item_task_sync
  after insert or update of status on public.enrollment_onboarding_items
  for each row execute function public.sync_task_from_onboarding_item();

-- ---------------------------------------------------------------------
-- 8. A projection whose premise has gone
-- ---------------------------------------------------------------------
-- Tasks could survive the thing that justified them. A sales attempt that
-- ends should take its own sales-process Tasks with it — and only those:
-- a manual note, an onboarding step, or a Task belonging to a DIFFERENT
-- Opportunity for the same person must be left alone. opportunity_id is
-- what makes that distinction possible rather than approximate.
create or replace function public.close_tasks_for_terminal_opportunity()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if public.deal_is_active(new.archived_at, new.stage, new.outcome)
     or (tg_op = 'UPDATE'
         and not public.deal_is_active(old.archived_at, old.stage, old.outcome)) then
    return new;
  end if;

  update tasks
     set done_date = now(), status = 'cancelled'
   where opportunity_id = new.id
     and done_date is null
     -- Only the families whose premise was an ACTIVE sales attempt.
     -- 'other' is Leif's own note and is never closed by machinery.
     and type in ('sales_call', 'follow_up', 'nurture_follow_up',
                  'sales_call_cancelled', 'sales_call_no_show',
                  'review_application');

  return new;
end;
$$;

drop trigger if exists on_deal_terminal_task_cleanup on public.deals;
create trigger on_deal_terminal_task_cleanup
  after update of stage, outcome, archived_at on public.deals
  for each row execute function public.close_tasks_for_terminal_opportunity();

-- The Enrollment mirror: setup and wind-down work stops meaning anything
-- once the client is finished. Historical rows are closed, never deleted,
-- and payment is not touched.
create or replace function public.close_tasks_for_terminal_enrollment()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.status not in ('completed', 'withdrawn', 'ended')
     or old.status in ('completed', 'withdrawn', 'ended') then
    return new;
  end if;

  update tasks
     set done_date = now(), status = 'cancelled'
   where enrollment_id = new.id
     and done_date is null
     and type in ('onboarding_item', 'offboarding_item',
                  'resolve_client_session_cadence');

  return new;
end;
$$;

drop trigger if exists on_enrollment_terminal_task_cleanup on public.enrollments;
create trigger on_enrollment_terminal_task_cleanup
  after update of status on public.enrollments
  for each row execute function public.close_tasks_for_terminal_enrollment();

-- ---------------------------------------------------------------------
-- 9. Prove it landed
-- ---------------------------------------------------------------------
do $$
declare
  v_missing text := '';
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='tasks' and column_name='created_at') then
    v_missing := v_missing || 'tasks.created_at '; end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='tasks' and column_name='opportunity_id') then
    v_missing := v_missing || 'tasks.opportunity_id '; end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='tasks' and column_name='application_id') then
    v_missing := v_missing || 'tasks.application_id '; end if;
  if not exists (select 1 from pg_constraint where conname='tasks_type_check') then
    v_missing := v_missing || 'tasks_type_check '; end if;
  if not exists (select 1 from pg_constraint where conname='tasks_completion_agreement_check') then
    v_missing := v_missing || 'tasks_completion_agreement_check '; end if;
  if (select count(*) from pg_indexes where schemaname='public'
       and indexname in ('tasks_one_open_per_onboarding_item',
                         'tasks_one_open_per_offboarding_item',
                         'tasks_one_open_per_cadence_issue',
                         'tasks_one_open_per_sales_call_type',
                         'tasks_one_open_review_per_application')) <> 5 then
    v_missing := v_missing || 'dedupe indexes '; end if;
  if not exists (select 1 from pg_trigger where tgname='on_onboarding_item_task_sync') then
    v_missing := v_missing || 'on_onboarding_item_task_sync '; end if;
  if not exists (select 1 from pg_trigger where tgname='on_deal_terminal_task_cleanup') then
    v_missing := v_missing || 'on_deal_terminal_task_cleanup '; end if;
  if not exists (select 1 from pg_trigger where tgname='on_enrollment_terminal_task_cleanup') then
    v_missing := v_missing || 'on_enrollment_terminal_task_cleanup '; end if;

  if v_missing <> '' then
    raise exception 'task projection structure did not land: %', v_missing;
  end if;
end $$;

commit;
