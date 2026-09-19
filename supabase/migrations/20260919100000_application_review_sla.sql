-- An application to review is normal work. Only a late one is an exception.
--
-- A review Task was created the moment an Application arrived, and its due
-- date was the submission time — so the Dashboard said an application was
-- overdue the instant somebody sent it, and every new applicant landed in
-- Needs Attention next to a booking nobody can attribute. Needs Attention
-- is for things that have gone wrong. An application that arrived
-- yesterday has not gone wrong.
--
-- So the two are separated. The Applications for Review queue holds
-- current review work and is derived live from the Applications
-- themselves — no Task, nothing to reconcile, nothing to leak. A Task is
-- created only when the three-day promise has actually been broken, and
-- it is an escalation, not the work item.
--
-- THREE CALENDAR DAYS, in the CRM's timezone, because that is what the
-- promise means. An application submitted at 11pm has not used a day of
-- anyone's attention. Counting 72 hours would say otherwise, and would
-- move the deadline by an hour twice a year when the clocks change; a
-- calendar date has no offset to shift.
--
--   day 0    submitted, however late in the day
--   day 1-3  three full days to review
--   day 4+   overdue, and only now an exception

begin;

-- ---------------------------------------------------------------------
-- 1. Which Applications are actually current review work
-- ---------------------------------------------------------------------
-- Deliberately not "status = pending". Ninety-nine Applications in this
-- database are pending, nearly all recovered history whose sales attempt
-- finished long ago. Pending on a dead attempt is stale information, not
-- a job. Current work needs a LIVE attempt still at Application Received.
create or replace view public.applications_awaiting_review as
select a.id as application_id,
       a.contact_id,
       a.opportunity_id,
       a.offer_id,
       a.submitted_at,
       (a.submitted_at at time zone 'America/Denver')::date as submitted_on,
       ((now() at time zone 'America/Denver')::date
         - (a.submitted_at at time zone 'America/Denver')::date) as days_elapsed,
       ((a.submitted_at at time zone 'America/Denver')::date + 3) as review_due_on,
       ((now() at time zone 'America/Denver')::date
         - (a.submitted_at at time zone 'America/Denver')::date) > 3 as is_overdue
  from public.applications a
  join public.deals d on d.id = a.opportunity_id
 where a.status = 'pending'
   and public.deal_is_active(d.archived_at, d.stage, d.outcome)
   and d.stage = 'application_received';

comment on view public.applications_awaiting_review is
  'Applications that are current review work: pending, on a live sales attempt still at Application Received. Never merely status = pending — most pending Applications here are recovered history whose attempt ended long ago. days_elapsed counts CALENDAR days in America/Denver; overdue begins on day 4.';

grant select on public.applications_awaiting_review to authenticated;

-- ---------------------------------------------------------------------
-- 2. The escalation, created only once the promise is broken
-- ---------------------------------------------------------------------
-- A projection, exactly as Slice 3 defines one: the Application is the
-- truth, the Task only says it has been waiting too long. Deleting the
-- Task does not make the application reviewed; the next reconcile brings
-- it back while it is still late.
create or replace function public.reconcile_application_review_tasks()
returns int
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_created int := 0;
  v_closed int;
  v_sales_id bigint;
begin
  select id into v_sales_id from sales where administrator = true limit 1;

  -- Close escalations whose Application is no longer overdue review work:
  -- reviewed, its attempt moved on, or its attempt ended.
  update tasks t
     set done_date = now(), status = 'completed'
   where t.type = 'review_application'
     and t.done_date is null
     and not exists (
       select 1 from applications_awaiting_review r
        where r.application_id = t.application_id and r.is_overdue
     );
  get diagnostics v_closed = row_count;

  -- One escalation per overdue Application that has none. The partial
  -- unique index on (application_id) where done_date is null is what makes
  -- this safe to run as often as we like.
  insert into tasks (contact_id, type, text, due_date, status,
                     application_id, opportunity_id, sales_id)
  select r.contact_id,
         'review_application',
         format('Review %s''s application',
                nullif(btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '')),
         -- The day it SHOULD have been reviewed by, not the day it
         -- arrived. A due date in the past is now a true statement.
         (r.review_due_on::timestamp at time zone 'America/Denver'),
         'pending',
         r.application_id,
         r.opportunity_id,
         v_sales_id
    from applications_awaiting_review r
    join contacts c on c.id = r.contact_id
   where r.is_overdue
     and not exists (
       select 1 from tasks t
        where t.type = 'review_application'
          and t.done_date is null
          and t.application_id = r.application_id
     );
  get diagnostics v_created = row_count;

  return v_created + v_closed;
end;
$$;

comment on function public.reconcile_application_review_tasks() is
  'Creates exactly one review escalation per OVERDUE Application awaiting review, and closes escalations whose Application is no longer overdue work. Idempotent: safe to run repeatedly. An Application inside its three-day window has no Task at all — it lives in the Applications for Review queue instead.';

revoke all on function public.reconcile_application_review_tasks() from public, anon;

-- ---------------------------------------------------------------------
-- 3. A new submission no longer creates a Task
-- ---------------------------------------------------------------------
-- submit_public_application() created a review Task inline, which is what
-- put day-zero applications into Needs Attention. The queue shows them
-- now; the reconcile creates a Task only if one is still unreviewed on
-- day four. The rest of that function is untouched.
do $$
declare
  v_src text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'submit_public_application';

  if v_src is null then
    raise exception 'submit_public_application() not found';
  end if;

  -- Neutralise the task-creation guard rather than re-stating a 200-line
  -- function: setting the "already has one" flag to true makes the
  -- existing block a no-op, and leaves every other branch exactly as it
  -- was.
  v_new := replace(
    v_src,
    'IF NOT v_has_pending_task THEN',
    -- Kept as a guarded no-op so the surrounding structure, variables and
    -- comments stay intact and reviewable.
    'IF FALSE THEN  -- review Tasks are now created only on SLA breach, by reconcile_application_review_tasks()'
  );

  if v_new = v_src then
    raise exception 'could not find the review-Task creation guard in submit_public_application()';
  end if;

  execute v_new;
end $$;

-- ---------------------------------------------------------------------
-- 4. Keep it reconciled
-- ---------------------------------------------------------------------
-- Hourly is well inside a day-granularity promise, and the function is
-- plain SQL, so this needs no secret and no HTTP.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'reconcile-application-review') then
    perform cron.schedule(
      'reconcile-application-review',
      '23 * * * *',
      $job$select public.reconcile_application_review_tasks();$job$
    );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5. Bring the current state into line
-- ---------------------------------------------------------------------
-- Condition-driven, not row-specific: in an empty database this moves
-- nothing, and here it closes any escalation for an Application still
-- inside its window and opens one for any that is genuinely late.
select public.reconcile_application_review_tasks();

-- ---------------------------------------------------------------------
-- 6. Prove it landed
-- ---------------------------------------------------------------------
do $$
declare
  v_bad int;
begin
  if not exists (select 1 from information_schema.views
                  where table_schema='public' and table_name='applications_awaiting_review') then
    raise exception 'applications_awaiting_review did not land';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                  where n.nspname='public' and p.proname='reconcile_application_review_tasks') then
    raise exception 'reconcile_application_review_tasks() did not land';
  end if;

  -- No escalation may exist for an Application inside its window.
  select count(*) into v_bad
    from tasks t
    join applications_awaiting_review r on r.application_id = t.application_id
   where t.type = 'review_application' and t.done_date is null and not r.is_overdue;
  if v_bad <> 0 then
    raise exception '% escalation Task(s) exist for Applications still inside the review window', v_bad;
  end if;

  -- And every overdue one must have exactly one.
  select count(*) into v_bad
    from applications_awaiting_review r
   where r.is_overdue
     and not exists (select 1 from tasks t
                      where t.type='review_application' and t.done_date is null
                        and t.application_id = r.application_id);
  if v_bad <> 0 then
    raise exception '% overdue Application(s) have no escalation Task', v_bad;
  end if;
end $$;

commit;
