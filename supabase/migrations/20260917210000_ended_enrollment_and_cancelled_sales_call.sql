-- ===========================================================================
-- Two canonical facts the model could not state
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. enrollments.status gains 'ended'
-- ---------------------------------------------------------------------------
-- A container that ran its course without the client finishing the work and
-- without a formal withdrawal. 'completed' claims they finished it;
-- 'withdrawn' claims they told us they were leaving. For someone who simply
-- stopped attending and whose contract then expired, both are false, and the
-- only reason to pick one would be that nothing else existed.
--
-- Neutral on purpose: 'ended' describes the container, not the person, and
-- carries no fault. The engagement story (last attended date vs container end
-- date) is already derivable from client_sessions and end_date, so no
-- loaded lifecycle value like "ghosted" is introduced.
ALTER TABLE "public"."enrollments"
  DROP CONSTRAINT IF EXISTS "enrollments_status_check";
ALTER TABLE "public"."enrollments"
  ADD CONSTRAINT "enrollments_status_check"
  CHECK (status IN ('onboarding', 'active', 'offboarding', 'completed', 'withdrawn', 'ended'));

-- The forward-skip guard ranks the four FULFILLMENT statuses. 'withdrawn'
-- and now 'ended' are terminal EXITS rather than points in that sequence:
-- reaching one from any live status is legitimate, and "skipping" has no
-- meaning for them. They already passed by accident — an unranked status
-- yields NULL and `NULL > n` is never true — which is too fragile to leave
-- as the mechanism. Stated explicitly instead, so a future edit to the
-- ranking cannot silently start rejecting a real exit.
CREATE OR REPLACE FUNCTION "public"."enforce_enrollment_lifecycle_sequence"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_old_rank int;
  v_new_rank int;
begin
  -- Terminal exits are reachable from anywhere; only the fulfillment
  -- sequence itself can be skipped.
  if new.status in ('withdrawn', 'ended') then
    return new;
  end if;

  v_old_rank := case old.status
    when 'onboarding' then 0
    when 'active' then 1
    when 'offboarding' then 2
    when 'completed' then 3
  end;
  v_new_rank := case new.status
    when 'onboarding' then 0
    when 'active' then 1
    when 'offboarding' then 2
    when 'completed' then 3
  end;
  if v_new_rank > v_old_rank + 1 then
    raise exception 'Cannot transition enrollment % directly from % to % — the fulfillment lifecycle (onboarding -> active -> offboarding -> completed) cannot skip a stage', new.id, old.status, new.status;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. record_sales_call_cancelled()
-- ---------------------------------------------------------------------------
-- Cancelling a booked call is ONE human action, so it is one transaction —
-- the same reasoning as record_sales_call_no_show(), and deliberately the
-- same shape.
--
-- A cancellation is NOT a no-show, and conflating them was the gap: a
-- no-show says the person did not turn up, which is a fact about them and
-- earns a durable Contact tag. A cancellation says the meeting is not
-- happening, which says nothing about whether they are still interested. So
-- this function never touches `attendance`, never attaches the No-show tag,
-- and never sets an exit outcome on the Opportunity.
--
-- The Opportunity leaves Call Booked because the stage asserts something
-- that is no longer true: no call is currently booked. It returns to
-- 'approved' — approved to have a sales call, with none scheduled — which
-- is the existing stage immediately before Call Booked, so rebooking later
-- follows the ordinary approved -> call_booked path with no new stage and no
-- special case. It is NOT marked lost or nurture: whether to pursue somebody
-- who cancelled is Leif's judgement, not a mechanical consequence.
CREATE OR REPLACE FUNCTION "public"."record_sales_call_cancelled"("p_sales_call_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_call sales_calls%ROWTYPE;
  v_now timestamptz := now();
  v_deal_returned boolean := false;
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
  --    the status vocabulary tasks already has. done_date is deliberately
  --    left alone: a cancelled task was never done.
  update tasks
     set status = 'cancelled'
   where sales_call_id = v_call.id
     and status in ('pending', 'waiting');
  get diagnostics v_tasks_closed = row_count;

  -- 3. The Opportunity leaves Call Booked. Only from 'call_booked', and
  --    only while it is still active — a Deal that has since progressed or
  --    exited is not dragged backwards by cancelling an old call.
  --    stage_entered_at is set so record_deal_stage_event() timestamps the
  --    transition as happening now rather than reusing the old value.
  if v_call.opportunity_id is not null then
    update deals
       set stage = 'approved',
           stage_entered_at = v_now,
           updated_at = v_now
     where id = v_call.opportunity_id
       and stage = 'call_booked'
       and outcome is null
       and archived_at is null;
    v_deal_returned := found;
  end if;

  return jsonb_build_object(
    'status', case when v_call.status = 'cancelled' then 'already-cancelled' else 'cancelled' end,
    'sales_call_id', v_call.id,
    'opportunity_id', v_call.opportunity_id,
    'deal_returned_to_approved', v_deal_returned,
    'tasks_closed', v_tasks_closed,
    -- Reported so a caller can be explicit that nothing was decided about
    -- pursuing this person.
    'outcome_left_undecided', true
  );
end;
$$;

REVOKE ALL ON FUNCTION public.record_sales_call_cancelled(bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.record_sales_call_cancelled(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_sales_call_cancelled(bigint) TO service_role;
