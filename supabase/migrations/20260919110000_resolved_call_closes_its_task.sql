-- A call that has been resolved must stop asking to be resolved.
--
-- Leif recorded Megan Auron's call as a no-show. The call took it: status
-- completed, attendance no_show, and opening the resolution route again
-- correctly said "This call is already resolved." The Dashboard went on
-- offering Resolve anyway, because its resolve_sales_call Task was never
-- closed. Task truth outlived Sales Call truth, which is the one thing a
-- projection may never do.
--
-- THREE DEFECTS, not one.
--
--   1. record_sales_call_no_show() closed tasks by contact_id and
--      type in ('sales_call', 'sales_call_no_show'). resolve_sales_call
--      is not in that list, so Megan's was never touched. Closing by
--      CONTACT is wrong on its own terms too: a returning applicant can
--      have an open question about a different call entirely.
--
--   2. close_tasks_for_sales_call() — the durable helper that does this
--      correctly, by sales_call_id, for every type — had no callers at
--      all. The right mechanism existed and nothing used it.
--
--   3. record_sales_call_cancelled() set status = 'cancelled' while
--      deliberately leaving done_date NULL. Slice 3 then added the
--      invariant that done_date and status must agree, so that route now
--      RAISES instead of cancelling. Nobody had cancelled a call since,
--      so nothing surfaced it. Verified against production, rolled back:
--      status-only cancel refused, cancel with done_date accepted.
--
-- And a fourth thing, which is why the tests did not catch any of it:
-- recordSalesCallNoShow.ts returns immediately when the data provider
-- offers the RPC, so in production the task-closing code further down that
-- file never runs. The tests exercise the FakeRest fallback — the branch
-- production never takes. The fix therefore belongs in the database, where
-- the work actually happens.

begin;

-- ---------------------------------------------------------------------
-- 1. "This call is an open question" becomes a fact about the CALL
-- ---------------------------------------------------------------------
-- It was only ever recorded by the existence of a Task, so deleting the
-- Task erased the question — exactly the shape Slice 3 forbids. It cannot
-- be derived from "attendance is null" either: 166 calls have no
-- attendance because the import recorded their result as pipeline stage
-- instead, and turning those into alerts would bury the handful of real
-- ones. So whatever notices the ambiguity records it here, once.
alter table public.sales_calls
  add column if not exists resolution_requested_at timestamptz;

comment on column public.sales_calls.resolution_requested_at is
  'When somebody established that nobody knows what happened on this call. NULL on the 166 attendance-less historical calls, which are not open questions. Set deliberately, never derived — and it is what allows a deleted resolve_sales_call Task to come back while the question is still open.';

-- Every call that has ever carried a resolve task was, by definition,
-- established as an open question. A rule, not a row list: it moves
-- nothing in an empty database.
update public.sales_calls sc
   set resolution_requested_at = coalesce(
         sc.resolution_requested_at,
         (select min(coalesce(t.created_at, t.due_date))
            from public.tasks t
           where t.sales_call_id = sc.id and t.type = 'resolve_sales_call'))
 where sc.resolution_requested_at is null
   and exists (select 1 from public.tasks t
                where t.sales_call_id = sc.id and t.type = 'resolve_sales_call');

-- ---------------------------------------------------------------------
-- 2. What "resolved" means, in one place
-- ---------------------------------------------------------------------
create or replace function public.sales_call_is_resolved(
  p_attendance text,
  p_status text,
  p_dismissed_at timestamptz
) returns boolean
language sql
immutable
set search_path to 'public'
as $$
  -- Any of the three canonical answers, or an explicit dismissal.
  -- Attendance covers attended and no_show; a cancelled call has no
  -- attendance to record and needs none.
  select p_attendance is not null
      or p_dismissed_at is not null
      or p_status = 'cancelled';
$$;

-- ---------------------------------------------------------------------
-- 3. The no-show route uses the durable helper
-- ---------------------------------------------------------------------
do $$
declare
  v_src text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'record_sales_call_no_show';
  if v_src is null then
    raise exception 'record_sales_call_no_show() not found';
  end if;

  v_new := replace(
    v_src,
$old$  update tasks
     set done_date = v_now, status = 'completed'
   where contact_id = v_call.contact_id
     and type in ('sales_call', 'sales_call_no_show')
     and done_date is null;$old$,
$new$  -- Every open task about THIS call, whatever its type — including the
  -- resolve_sales_call question this no-show has just answered. Scoped by
  -- the call, never by the Contact: a returning applicant can have an
  -- open question about a different call that this one says nothing about.
  perform public.close_tasks_for_sales_call(v_call.id, v_now);

  -- Legacy rows from before tasks carried sales_call_id. Still scoped to
  -- the superseded types only, so nothing else of this Contact's is swept up.
  update tasks
     set done_date = v_now, status = 'completed'
   where contact_id = v_call.contact_id
     and sales_call_id is null
     and type in ('sales_call', 'sales_call_no_show')
     and done_date is null;$new$
  );

  if v_new = v_src then
    raise exception 'could not find the task-closing block in record_sales_call_no_show()';
  end if;
  execute v_new;
end $$;

-- ---------------------------------------------------------------------
-- 4. The cancel route stops violating the completion invariant
-- ---------------------------------------------------------------------
-- A cancelled task IS closed — nobody is going to do it. The status
-- vocabulary still says it was cancelled rather than completed, which is
-- the distinction that was worth keeping; done_date only records that it
-- left the open set.
do $$
declare
  v_src text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'record_sales_call_cancelled';
  if v_src is null then
    raise exception 'record_sales_call_cancelled() not found';
  end if;

  v_new := replace(
    v_src,
$old$  update tasks
     set status = 'cancelled'
   where sales_call_id = v_call.id
     and status in ('pending', 'waiting');$old$,
$new$  update tasks
     set status = 'cancelled', done_date = v_now
   where sales_call_id = v_call.id
     and status in ('pending', 'waiting');$new$
  );

  if v_new = v_src then
    raise exception 'could not find the task-cancelling block in record_sales_call_cancelled()';
  end if;
  execute v_new;
end $$;

-- ---------------------------------------------------------------------
-- 5. One reconciliation, both directions
-- ---------------------------------------------------------------------
-- The invariant, stated once, in the place the invariant actually lives:
--
--   resolved call   -> zero open resolve_sales_call Tasks
--   open question still unanswered -> exactly one
--
-- Deliberately NOT "every call with no attendance": that would create 138
-- alerts for historical calls whose result was recorded as pipeline stage.
-- Only a call somebody established as a question comes back.
create or replace function public.reconcile_resolve_sales_call_tasks()
returns int
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_closed int;
  v_created int;
  v_sales_id bigint;
begin
  -- Resolved: close whatever is still open about it.
  update tasks t
     set done_date = now(), status = 'completed'
    from sales_calls sc
   where sc.id = t.sales_call_id
     and t.type = 'resolve_sales_call'
     and t.done_date is null
     and public.sales_call_is_resolved(sc.attendance, sc.status, sc.dismissed_at);
  get diagnostics v_closed = row_count;

  -- Still an open question, and nothing currently asking it.
  select id into v_sales_id from sales where administrator = true limit 1;

  insert into tasks (contact_id, type, text, due_date, status,
                     sales_call_id, opportunity_id, sales_id)
  select sc.contact_id,
         'resolve_sales_call',
         format('%s · what happened on this call?',
                nullif(btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '')),
         now(),
         'pending',
         sc.id,
         sc.opportunity_id,
         v_sales_id
    from sales_calls sc
    join contacts c on c.id = sc.contact_id
   where sc.resolution_requested_at is not null
     and not public.sales_call_is_resolved(sc.attendance, sc.status, sc.dismissed_at)
     -- A call that has not happened yet is not an open question.
     --
     -- Six calls here were established as questions once, answered, and
     -- are now booked for mid-October. Without this they would each come
     -- back asking "what happened on this call?" about something three
     -- weeks away. The question only exists once the time has passed.
     and coalesce(sc.scheduled_at, (sc.scheduled_on + time '23:59')
                    at time zone 'America/Denver') < now()
     and not exists (
       select 1 from tasks t
        where t.sales_call_id = sc.id
          and t.type = 'resolve_sales_call'
          and t.done_date is null
     );
  get diagnostics v_created = row_count;

  return v_closed + v_created;
end;
$$;

comment on function public.reconcile_resolve_sales_call_tasks() is
  'Enforces: a resolved Sales Call has zero open resolve_sales_call Tasks, and a call established as an open question has exactly one. Idempotent. Never derives a question from "attendance is null" — only from resolution_requested_at.';

revoke all on function public.reconcile_resolve_sales_call_tasks() from public, anon;

-- ---------------------------------------------------------------------
-- 6. Keep it reconciled, and bring the current state into line
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'reconcile-resolve-sales-call') then
    perform cron.schedule(
      'reconcile-resolve-sales-call',
      '41 * * * *',
      $job$select public.reconcile_resolve_sales_call_tasks();$job$
    );
  end if;
end $$;

select public.reconcile_resolve_sales_call_tasks();

-- ---------------------------------------------------------------------
-- 7. Prove the invariant holds
-- ---------------------------------------------------------------------
do $$
declare
  v_stale int;
  v_missing int;
begin
  select count(*) into v_stale
    from tasks t join sales_calls sc on sc.id = t.sales_call_id
   where t.type = 'resolve_sales_call' and t.done_date is null
     and public.sales_call_is_resolved(sc.attendance, sc.status, sc.dismissed_at);
  if v_stale <> 0 then
    raise exception '% resolved call(s) still have an open resolve Task', v_stale;
  end if;

  select count(*) into v_missing
    from sales_calls sc
   where sc.resolution_requested_at is not null
     and not public.sales_call_is_resolved(sc.attendance, sc.status, sc.dismissed_at)
     and coalesce(sc.scheduled_at, (sc.scheduled_on + time '23:59')
                    at time zone 'America/Denver') < now()
     and not exists (select 1 from tasks t where t.sales_call_id = sc.id
                      and t.type = 'resolve_sales_call' and t.done_date is null);
  if v_missing <> 0 then
    raise exception '% open question(s) have no resolve Task', v_missing;
  end if;

  -- And never more than one.
  if exists (select 1 from tasks where type = 'resolve_sales_call' and done_date is null
              group by sales_call_id having count(*) > 1) then
    raise exception 'a Sales Call has more than one open resolve Task';
  end if;
end $$;

commit;
