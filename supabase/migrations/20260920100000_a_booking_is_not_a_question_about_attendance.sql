-- A booking is not a question about attendance, and an appointment is not
-- a task.
--
-- Four real Acuity bookings arrived on 20 September for calls on 29
-- October, 30 October, 3 November and 10 November. All four reached the
-- Dashboard as:
--
--   NEEDS ATTENTION
--   Anna Howard · The Living Example · Oct 29, 2026, 6:00 PM
--   What happened on this call?                            [Resolve]
--
-- Nothing had happened on any of them. They are weeks away.
--
-- WHY. Migration 20260918030000 split one overloaded task type into the
-- two questions it had been confusing:
--
--   sales_call_needs_matching  which Opportunity does this booking belong
--                              to? Valid while opportunity_id IS NULL.
--   resolve_sales_call         what happened on this call? Valid only for
--                              a call already attached, whose time has
--                              passed, that somebody established as an
--                              open question.
--
-- The app was updated. The Acuity webhook was not: it kept the literal
-- 'resolve_sales_call' from before the split, so every booking it could
-- not attribute was filed as an attendance question about a future call.
-- The Edge Function is fixed in the same change as this migration; what
-- follows is the half that must not depend on remembering.
--
-- THE LOOP. Mihaela Petrova's row is the same defect one step further on.
-- Her task routed to the outcome page, which correctly refused to ask
-- about an unattached call and offered the matching page instead. She had
-- no Living Example Opportunity — her only prior one is a lost Growing
-- Yourself Up attempt — so Leif created one and attached the booking. That
-- worked completely: Opportunity 266 at Call Booked, sales call 331
-- attached, an opportunity_attached event recorded.
--
-- The task stayed open. Both mechanisms that close a matching task —
-- complete_sales_call_matching_task_trigger, and the app's own
-- completeSalesCallNeedsMatchingTask — look for type
-- 'sales_call_needs_matching'. The row said 'resolve_sales_call'. And
-- reconcile_resolve_sales_call_tasks() only ever closed a resolve task for
-- a call that was RESOLVED; a future booked call is not resolved, so it
-- left it alone too. Clicking Resolve again reached the outcome page,
-- which now saw an attached future call with nothing outstanding and said
-- "This call is already resolved."
--
-- An open task whose own destination says there is nothing to do is the
-- invariant this migration exists to make impossible. The reconciler was
-- one-directional: it could create the right task and close an answered
-- one, but it had no opinion about a task asking the WRONG question. It
-- gets that opinion here.
--
-- AND: the appointment stops being projected into the Task system at all.
-- "Sales Call: Sarah Henke — Oct 15, 2026" and "Sales Call: Mihaela
-- Petrova — Nov 10, 2026" sat under Later with nothing to do about them.
-- A Task means Leif has something to do; a booked call is a calendar fact,
-- already carried by the Call Booked stage, the Opportunity's own Sales
-- Call section and the calendar. The Sales Calls themselves are untouched.

begin;

-- ---------------------------------------------------------------------
-- 1. Which question a booking actually poses
-- ---------------------------------------------------------------------
-- One rule, in the place the rule belongs. Mirrors
-- src/components/atomic-crm/sales-calls/salesCallTaskTypes.ts's
-- classifySalesCallAmbiguity in the same order, and adds the one thing
-- that classification deliberately leaves out: a call whose outcome is
-- unknown is only a TASK when somebody established it as an open question.
-- Without that gate, 109 historical calls whose result was recorded as
-- pipeline stage rather than attendance would each become an alert.
create or replace function public.sales_call_open_question(
  p_opportunity_id bigint,
  p_dismissed_at timestamptz,
  p_status text,
  p_attendance text,
  p_scheduled_at timestamptz,
  p_scheduled_on date,
  p_resolution_requested_at timestamptz,
  p_now timestamptz
) returns text
language sql
immutable
set search_path to 'public'
as $$
  select case
    -- Explicitly not a sales situation: nothing to ask about it ever again.
    when p_dismissed_at is not null then 'none'
    -- Nobody knows whose booking this is. That outranks every other
    -- question, because the others are about a sales relationship this
    -- call has not yet been attributed to.
    when p_opportunity_id is null then 'matching'
    -- Cancelled is itself an answer to "what happened".
    when p_status = 'cancelled' then 'none'
    when p_attendance is not null then 'none'
    -- Never derived from "attendance is null" alone.
    when p_resolution_requested_at is null then 'none'
    -- A call that has not happened has no outcome to record. A date-only
    -- call counts as past once the whole DAY is over, never earlier — its
    -- clock time is genuinely unknown.
    when coalesce(p_scheduled_at,
                  (p_scheduled_on + time '23:59') at time zone 'America/Denver')
         >= p_now then 'none'
    else 'attendance'
  end;
$$;

comment on function public.sales_call_open_question(bigint, timestamptz, text, text, timestamptz, date, timestamptz, timestamptz) is
  'The one question a Sales Call currently poses, if any: matching (whose booking is this?), attendance (what happened on it?), or none. The projection rule for both sales-call task types — a task of either type is warranted exactly while this returns its own name.';

-- ---------------------------------------------------------------------
-- 2. One reconciliation, both types, both directions
-- ---------------------------------------------------------------------
-- Replaces reconcile_resolve_sales_call_tasks(), which knew about one
-- type and one direction. The invariant, stated whole:
--
--   a booking poses a question -> exactly one open task, of that question's
--                                 own type
--   a booking poses none       -> zero open sales-call tasks
--
-- Nothing here derives a NEW matching question. Thirty-one calls in this
-- database have no Opportunity — nearly all completed history from before
-- the CRM existed — and manufacturing thirty-one alerts would be inventing
-- a backlog, the same trap migration 20260919050000 avoided with
-- Applications. A matching task stays created by the flow that noticed the
-- ambiguity: a live booking arriving unattributable. What this DOES do is
-- refile one that was filed under the wrong question, and close one whose
-- question has been answered.
create or replace function public.reconcile_sales_call_tasks()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_refiled    int;
  v_closed     int;
  v_created    int;
  v_appointments int;
  v_sales_id   bigint;
begin
  -- 2a. Ask the question the booking actually poses.
  --
  -- An unmatched booking is a matching question whatever type it was filed
  -- under. Only where nothing is already asking it — the partial unique
  -- index tasks_one_open_per_sales_call_type permits exactly one open task
  -- per (call, type), and a duplicate is closed by 2b below rather than
  -- colliding here.
  update tasks t
     set type = 'sales_call_needs_matching'
    from sales_calls sc
   where sc.id = t.sales_call_id
     and t.type = 'resolve_sales_call'
     and t.done_date is null
     and public.sales_call_open_question(
           sc.opportunity_id, sc.dismissed_at, sc.status, sc.attendance,
           sc.scheduled_at, sc.scheduled_on, sc.resolution_requested_at,
           now()) = 'matching'
     and not exists (
       select 1 from tasks other
        where other.sales_call_id = sc.id
          and other.type = 'sales_call_needs_matching'
          and other.done_date is null);
  get diagnostics v_refiled = row_count;

  -- 2b. A task whose question is no longer the one its booking poses is
  --     finished. This is the direction that was missing: it closes an
  --     answered matching task (any route, including a SQL backfill), and
  --     it closes an attendance question about a call that was never one —
  --     a future booking, a cancellation, a call whose outcome is already
  --     recorded.
  update tasks t
     set done_date = coalesce(t.done_date, now()),
         status = 'completed'
    from sales_calls sc
   where sc.id = t.sales_call_id
     and t.type in ('sales_call_needs_matching', 'resolve_sales_call')
     and t.done_date is null
     and public.sales_call_open_question(
           sc.opportunity_id, sc.dismissed_at, sc.status, sc.attendance,
           sc.scheduled_at, sc.scheduled_on, sc.resolution_requested_at,
           now())
         <> case t.type when 'sales_call_needs_matching' then 'matching'
                        else 'attendance' end;
  get diagnostics v_closed = row_count;

  -- 2c. An open attendance question with nothing asking it.
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
   where public.sales_call_open_question(
           sc.opportunity_id, sc.dismissed_at, sc.status, sc.attendance,
           sc.scheduled_at, sc.scheduled_on, sc.resolution_requested_at,
           now()) = 'attendance'
     and not exists (
       select 1 from tasks t
        where t.sales_call_id = sc.id
          and t.type = 'resolve_sales_call'
          and t.done_date is null);
  get diagnostics v_created = row_count;

  -- 2d. The appointment is not a task.
  --
  -- A retired projection (needsAttentionInventory.ts), closed rather than
  -- deleted: the row stays readable, and the Sales Call it described is
  -- untouched and still visible on the Opportunity, in the Call Booked
  -- stage and on the calendar. Repeating it costs nothing once none exist,
  -- and it is what makes the retirement true rather than merely intended.
  update tasks
     set done_date = coalesce(done_date, now()),
         status = 'completed'
   where type = 'sales_call'
     and done_date is null;
  get diagnostics v_appointments = row_count;

  return jsonb_build_object(
    'refiled_as_matching', v_refiled,
    'closed_question_answered', v_closed,
    'created_attendance_question', v_created,
    'closed_appointment_tasks', v_appointments);
end;
$$;

comment on function public.reconcile_sales_call_tasks() is
  'Enforces, in both directions: a Sales Call posing a question has exactly one open Task of that question own type, and one posing none has zero. Idempotent. Never derives a matching question for the 31 historical unattributed calls, and never derives an attendance question from "attendance is null" — only from resolution_requested_at.';

revoke all on function public.reconcile_sales_call_tasks() from public, anon;

-- ---------------------------------------------------------------------
-- 3. Keep it reconciled under the name that says what it does
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'reconcile-resolve-sales-call') then
    perform cron.unschedule('reconcile-resolve-sales-call');
  end if;
  if not exists (select 1 from cron.job where jobname = 'reconcile-sales-call-tasks') then
    perform cron.schedule(
      'reconcile-sales-call-tasks',
      '41 * * * *',
      $job$select public.reconcile_sales_call_tasks();$job$
    );
  end if;
end $$;

drop function if exists public.reconcile_resolve_sales_call_tasks();

-- ---------------------------------------------------------------------
-- 4. Retiring the appointment Task must not retire the appointment
-- ---------------------------------------------------------------------
-- Closing 2d's rows is only safe while the Task is a DUPLICATE of the
-- booking rather than the sole record of it. Both live rows are: Sarah
-- Henke's 15 October call is sales_call 4 (attached to Opportunity 23,
-- which also carries sales_call_at) and Mihaela Petrova's 10 November call
-- is sales_call 331. Proven rather than assumed, and vacuous in an empty
-- database.
do $$
declare
  v_orphaned int;
begin
  select count(*) into v_orphaned
    from tasks t
   where t.type = 'sales_call'
     and t.done_date is null
     and not exists (
       select 1 from sales_calls sc
        where sc.contact_id = t.contact_id
          and sc.dismissed_at is null
          and sc.status <> 'cancelled'
          and coalesce(sc.scheduled_at, sc.scheduled_on::timestamptz)::date
              = t.due_date::date);
  if v_orphaned <> 0 then
    raise exception
      '% appointment Task(s) are the only record of their appointment; refusing to close them',
      v_orphaned;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5. Bring the current state into line
-- ---------------------------------------------------------------------
-- A rule, not a row list: it moves nothing in an empty database.
select public.reconcile_sales_call_tasks();

-- ---------------------------------------------------------------------
-- 6. Prove the invariant holds
-- ---------------------------------------------------------------------
do $$
declare
  v_wrong_question int;
  v_missing        int;
  v_appointments   int;
begin
  -- No open sales-call task asks a question its own booking does not pose.
  -- This is the one that would have caught all five rows: four future
  -- bookings asked about attendance, and Mihaela's asked about a booking
  -- that had already been matched.
  select count(*) into v_wrong_question
    from tasks t join sales_calls sc on sc.id = t.sales_call_id
   where t.type in ('sales_call_needs_matching', 'resolve_sales_call')
     and t.done_date is null
     and public.sales_call_open_question(
           sc.opportunity_id, sc.dismissed_at, sc.status, sc.attendance,
           sc.scheduled_at, sc.scheduled_on, sc.resolution_requested_at,
           now())
         <> case t.type when 'sales_call_needs_matching' then 'matching'
                        else 'attendance' end;
  if v_wrong_question <> 0 then
    raise exception '% open Task(s) ask a question their booking does not pose', v_wrong_question;
  end if;

  -- An established open attendance question always has one asking it.
  select count(*) into v_missing
    from sales_calls sc
   where public.sales_call_open_question(
           sc.opportunity_id, sc.dismissed_at, sc.status, sc.attendance,
           sc.scheduled_at, sc.scheduled_on, sc.resolution_requested_at,
           now()) = 'attendance'
     and not exists (select 1 from tasks t
                      where t.sales_call_id = sc.id
                        and t.type = 'resolve_sales_call'
                        and t.done_date is null);
  if v_missing <> 0 then
    raise exception '% open attendance question(s) have no Task', v_missing;
  end if;

  select count(*) into v_appointments
    from tasks where type = 'sales_call' and done_date is null;
  if v_appointments <> 0 then
    raise exception '% appointment Task(s) still open', v_appointments;
  end if;

  -- And never more than one open task of a kind about one call.
  if exists (select 1 from tasks
              where type in ('sales_call_needs_matching', 'resolve_sales_call')
                and done_date is null
              group by sales_call_id, type having count(*) > 1) then
    raise exception 'a Sales Call has more than one open Task of the same kind';
  end if;
end $$;

commit;
