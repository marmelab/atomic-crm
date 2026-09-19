-- A missed call does not un-book the meeting that was booked.
--
-- Both call-resolution functions moved the Opportunity from `call_booked`
-- back to `approved`, on the reasoning that Call Booked asserts a call in
-- the calendar and a cancelled or missed call is no longer in it. That
-- reasoning is retired by owner decision after acceptance testing.
--
-- The trouble with it is that `approved` does not mean "had a call that
-- fell through". It means "qualified, waiting to book" — the state someone
-- is in BEFORE they have ever agreed to meet. Writing it moves a person
-- backwards through the sales process on the strength of a fact that says
-- nothing about where the sale is: a cancellation answers "is this meeting
-- happening", not "how far has this got". Leif then found four people
-- sitting in Approved who had all plainly got further than that, and no
-- trace on the board of what had actually happened.
--
-- So the stage stays where the sale genuinely reached. It moves again when
-- something moves it: a rebooking, a recorded decision, an explicit exit.
--
-- Nothing else changes. The cancellation and the no-show are still
-- recorded exactly as before, on the Sales Call, which is where a fact
-- about a call belongs. The open question — what happens next with this
-- person — was never stored in the stage anyway: it is derived from
-- active + latest call cancelled/no-show + nothing booked since
-- (deals/needsNextSalesStep.ts), so it survives this unchanged and still
-- cannot be deleted, only resolved.
--
-- The two return keys that reported the backward move are removed rather
-- than left permanently false. Nothing in the application read them.

begin;

create or replace function public.record_sales_call_cancelled(p_sales_call_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_call sales_calls%ROWTYPE;
  v_now timestamptz := now();
  v_tasks_closed int := 0;
begin
  select * into v_call from sales_calls where id = p_sales_call_id for update;
  if not found then
    return jsonb_build_object('status', 'not-found');
  end if;

  -- Never overwrite a call that genuinely happened. Someone attended it;
  -- cancelling it afterwards would erase that.
  if v_call.attendance = 'attended' then
    return jsonb_build_object('status', 'already-attended');
  end if;

  -- 1. The Sales Call is the canonical record of the cancellation.
  --    original_scheduled_at is untouched — when it WAS going to happen is
  --    part of the history. attendance stays exactly as it is: null for a
  --    call that was cancelled before it was due, and a previously recorded
  --    no_show is never rewritten by a later cancellation of a DIFFERENT
  --    call (each call is its own record).
  --    status leaves 'booked', which also frees
  --    sales_calls_one_booked_per_opportunity_idx for a genuine rebooking.
  if v_call.status <> 'cancelled' then
    update sales_calls
       set status = 'cancelled',
           cancelled_at = coalesce(v_call.cancelled_at, v_now),
           updated_at = v_now
     where id = v_call.id;

    insert into sales_call_events (sales_call_id, kind, occurred_at)
    values (v_call.id, 'cancelled', v_now);
  end if;

  -- 2. A task telling Leif to deal with this specific call is no longer
  --    real work. Cancelled rather than completed — nobody did it — using
  --    the status vocabulary tasks already has.
  update tasks
     set status = 'cancelled', done_date = v_now
   where sales_call_id = v_call.id
     and status in ('pending', 'waiting');
  get diagnostics v_tasks_closed = row_count;

  -- 3. The Opportunity is NOT touched. The sale reached wherever it
  --    reached; a cancelled meeting is not a reason to say it reached less.
  --    Leif decides what happens next, and until he does the Opportunity
  --    stays exactly where it is with the cancellation visible on it.

  return jsonb_build_object(
    'status', case when v_call.status = 'cancelled' then 'already-cancelled' else 'cancelled' end,
    'sales_call_id', v_call.id,
    'opportunity_id', v_call.opportunity_id,
    'opportunity_stage_unchanged', true,
    'tasks_closed', v_tasks_closed,
    -- Reported so a caller can be explicit that nothing was decided about
    -- pursuing this person.
    'outcome_left_undecided', true
  );
end;
$function$;

comment on function public.record_sales_call_cancelled(bigint) is
  'Records that a booked call was called off. Touches the Sales Call and its tasks only: the Opportunity keeps the stage the sale actually reached, because a cancelled meeting says nothing about how far the sale has got.';

create or replace function public.record_sales_call_no_show(p_sales_call_id bigint)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_call sales_calls%rowtype;
  v_now timestamptz := now();
  v_already_no_show boolean;
  v_tag_id bigint;
begin
  select * into v_call from sales_calls where id = p_sales_call_id for update;
  if not found then
    return jsonb_build_object('status', 'not-found');
  end if;
  if v_call.opportunity_id is null then
    return jsonb_build_object('status', 'no-opportunity');
  end if;
  if v_call.attendance = 'attended' then
    -- Never silently overwrite a recorded attended outcome.
    return jsonb_build_object('status', 'already-completed');
  end if;

  v_already_no_show := v_call.attendance is not distinct from 'no_show';

  -- 1. The Sales Call is the CANONICAL historical record of the no-show.
  if not v_already_no_show then
    update sales_calls
       set attendance = 'no_show',
           attendance_recorded_at = v_now,
           status = 'completed',
           updated_at = v_now
     where id = v_call.id;

    insert into sales_call_events (sales_call_id, kind, occurred_at, attendance)
    values (v_call.id, 'attendance_recorded', v_now, 'no_show');
  elsif v_call.status is distinct from 'completed' then
    -- Recorded as a no-show before concluded calls had to leave 'booked'.
    -- Converge the status without inventing a second attendance timestamp
    -- or a duplicate history event.
    update sales_calls set status = 'completed', updated_at = v_now
     where id = v_call.id;
  end if;

  -- 2. The Opportunity is NOT touched — see record_sales_call_cancelled().
  --    They did not turn up. That is a fact about the meeting, not a
  --    demotion of the sale.

  -- 3. The Contact carries a durable, visible No-show tag — a SUMMARY for
  --    at-a-glance history, never the source of truth, attached once.
  select id into v_tag_id from tags where lower(name) = 'no-show' limit 1;
  if v_tag_id is null then
    insert into tags (name, color) values ('No-show', '#fde2e4')
    returning id into v_tag_id;
  end if;

  update contacts
     set tags = coalesce(tags, '{}'::bigint[]) || v_tag_id
   where id = v_call.contact_id
     and not (coalesce(tags, '{}'::bigint[]) @> array[v_tag_id]);

  -- 4. The call concluded, so every open task about THIS call is answered,
  --    including the resolve_sales_call question. Scoped by the call, never
  --    by the Contact: a returning applicant can have an open question
  --    about a different call that this one says nothing about.
  perform public.close_tasks_for_sales_call(v_call.id, v_now);

  -- Legacy rows from before tasks carried sales_call_id. Still scoped to
  -- the superseded types only, so nothing else of this Contact's is swept up.
  update tasks
     set done_date = v_now, status = 'completed'
   where contact_id = v_call.contact_id
     and sales_call_id is null
     and type in ('sales_call', 'sales_call_no_show')
     and done_date is null;

  return jsonb_build_object(
    'status', case when v_already_no_show then 'already-no-show' else 'completed' end,
    'opportunity_stage_unchanged', true
  );
end;
$function$;

comment on function public.record_sales_call_no_show(bigint) is
  'Records that nobody turned up to a booked call. Touches the Sales Call, the Contact tag and the call''s own tasks only: the Opportunity keeps the stage the sale actually reached. What happens next is a human decision, surfaced by deals/needsNextSalesStep.ts rather than by moving the card.';

-- ---------------------------------------------------------------------
-- Prove the backward transition is gone from both, and from everywhere
-- ---------------------------------------------------------------------
do $$
declare
  v_offending text;
begin
  -- No function in the schema may WRITE stage = 'approved' while reading a
  -- cancellation or a no-show. This is the assertion that stops the rule
  -- coming back through a third path nobody remembered to look at.
  --
  -- Deliberately matched on the SET form. record_sales_call_reinstated()
  -- reads `and stage = 'approved'` in a WHERE clause to move a Deal
  -- FORWARD to call_booked when a cancelled future call comes back, which
  -- is the opposite of what is banned here.
  select string_agg(p.proname, ', ')
    into v_offending
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind = 'f'
     and pg_get_functiondef(p.oid) ~* $re$set\s+stage\s*=\s*'approved'$re$
     and pg_get_functiondef(p.oid) ~* $re$(no_show|cancelled)$re$;

  if v_offending is not null then
    raise exception 'a call-resolution path still moves the stage back to approved: %', v_offending;
  end if;
end $$;

commit;
