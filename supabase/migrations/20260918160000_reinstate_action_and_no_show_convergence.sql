-- ===========================================================================
-- A booking that is still live upstream must be able to come back
-- ===========================================================================
-- Mihaela Petrova's Opportunity read "Approved / Sales Call · Completed /
-- No-show" while Acuity held a live, uncancelled appointment for her at
-- noon tomorrow — the SAME appointment id the CRM had marked cancelled,
-- created 2 August. The CRM was describing a relationship that had moved
-- on without it.
--
-- The cause was a precedence rule that was too blunt. "Owner-confirmed
-- cancellation outranks stale upstream state" was written for Aurelie
-- Boleor, whose only appointment was two days ago and whom Leif cancelled
-- by agreement without touching Acuity. For a PAST appointment that rule
-- is right: the CRM owns what happened. Applied to a FUTURE appointment it
-- is wrong, because Acuity is what the client is actually holding — she
-- has a calendar invite and she will show up.
--
-- So the rule splits on time rather than on who wrote last:
--
--   FUTURE appointment, live in Acuity  -> a booking exists. Acuity is
--     authoritative for whether a call is booked, so the CRM follows.
--   PAST appointment                    -> the CRM owns the outcome.
--     Cancelled / attended / no-show is business truth Acuity cannot see,
--     and a stale `canceled: false` upstream must never resurrect it.
--
-- Attendance is never touched by either direction. Acuity has no reliable
-- attended signal, so that stays a human action in the CRM.

-- ---------------------------------------------------------------------------
-- 1. The canonical reinstatement.
-- ---------------------------------------------------------------------------
-- One transaction, mirroring record_sales_call_cancelled's shape, so
-- reconciliation has a real action to call instead of writing columns by
-- hand. Refuses anything that is not genuinely a live future booking.
CREATE OR REPLACE FUNCTION "public"."record_sales_call_reinstated"(
  "p_sales_call_id" bigint
) RETURNS jsonb
    LANGUAGE "plpgsql"
    SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_call sales_calls%ROWTYPE;
  v_now timestamptz := now();
  v_deal_advanced boolean := false;
begin
  select * into v_call from sales_calls where id = p_sales_call_id for update;
  if not found then
    return jsonb_build_object('status', 'not-found');
  end if;

  -- Never re-open something that actually concluded. If a human recorded
  -- attendance, that is the truth about this call and a live upstream
  -- booking cannot overwrite it.
  if v_call.attendance is not null then
    return jsonb_build_object('status', 'already-concluded');
  end if;

  -- Only a future call can be "still booked". A past cancelled call is
  -- history, and this is exactly where Aurelie must be left alone.
  if coalesce(v_call.scheduled_at, (v_call.scheduled_on + time '23:59') at time zone 'UTC') <= v_now then
    return jsonb_build_object('status', 'in-the-past');
  end if;

  if v_call.status = 'booked' then
    return jsonb_build_object('status', 'already-booked');
  end if;

  update sales_calls
     set status = 'booked',
         cancelled_at = null,
         updated_at = v_now
   where id = v_call.id;

  insert into sales_call_events (sales_call_id, kind, occurred_at, new_scheduled_at)
  values (v_call.id, 'booked', v_now, v_call.scheduled_at);

  -- The Opportunity returns to Call Booked, but only from Approved and
  -- only while still active — the exact inverse of the cancellation path,
  -- and never dragging a Deal backwards from Decision or further on.
  if v_call.opportunity_id is not null then
    update deals
       set stage = 'call_booked',
           stage_entered_at = v_now,
           updated_at = v_now
     where id = v_call.opportunity_id
       and stage = 'approved'
       and outcome is null
       and archived_at is null;
    v_deal_advanced := found;
  end if;

  return jsonb_build_object(
    'status', 'reinstated',
    'sales_call_id', v_call.id,
    'opportunity_id', v_call.opportunity_id,
    'deal_advanced_to_call_booked', v_deal_advanced
  );
end;
$$;

GRANT EXECUTE ON FUNCTION "public"."record_sales_call_reinstated"(bigint) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. No-show closes its own question.
-- ---------------------------------------------------------------------------
-- record_sales_call_cancelled() cancels the tasks for its call; the no-show
-- function never did, so answering "what happened?" with No-show left the
-- question sitting on the Dashboard. Same convergence defect the webhook
-- had, in the other action.
CREATE OR REPLACE FUNCTION "public"."close_tasks_for_sales_call"(
  "p_sales_call_id" bigint,
  "p_completed_at" timestamptz
) RETURNS bigint
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  with closed as (
    update tasks
       set done_date = p_completed_at, status = 'completed'
     where sales_call_id = p_sales_call_id
       and done_date is null
       and status in ('pending', 'waiting')
    returning 1
  )
  select count(*) from closed;
$$;

-- ---------------------------------------------------------------------------
-- 3. Christina Noel Estopinal and Mila Frattini — canonical no-show.
-- ---------------------------------------------------------------------------
-- Leif has now answered the open question on both calls. They were sitting
-- in Approved reading "Sales Call · Completed" with no attendance, which
-- said nothing true about either relationship.
DO $$
DECLARE
  v_call record;
  v_result jsonb;
  v_closed bigint;
BEGIN
  FOR v_call IN
    SELECT sc.id, c.first_name || ' ' || c.last_name AS who
      FROM sales_calls sc JOIN contacts c ON c.id = sc.contact_id
     WHERE sc.id IN (136, 89)
  LOOP
    v_result := record_sales_call_no_show(v_call.id);
    IF v_result->>'status' NOT IN ('completed', 'already-no-show') THEN
      RAISE EXCEPTION 'no-show for % (call %) returned %', v_call.who, v_call.id, v_result->>'status';
    END IF;
    v_closed := close_tasks_for_sales_call(v_call.id, now());
    RAISE NOTICE '% recorded as no-show; % task(s) closed', v_call.who, v_closed;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Prove it.
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_n bigint;
BEGIN
  -- Both calls carry the no-show, both Opportunities have left the active
  -- pipeline, and the historical call is still there.
  SELECT count(*) INTO v_n FROM sales_calls WHERE id IN (136, 89) AND attendance = 'no_show';
  IF v_n <> 2 THEN RAISE EXCEPTION 'expected 2 no-show calls, found %', v_n; END IF;

  SELECT count(*) INTO v_n FROM deals d
    JOIN sales_calls sc ON sc.opportunity_id = d.id
   WHERE sc.id IN (136, 89) AND d.outcome IS NULL AND d.archived_at IS NULL AND d.stage <> 'won';
  IF v_n <> 0 THEN
    RAISE EXCEPTION '% Opportunity(ies) stayed in the active pipeline after a no-show', v_n;
  END IF;

  -- The No-show tag exactly once per Contact.
  SELECT count(*) INTO v_n FROM (
    SELECT c.id FROM contacts c, tags t
     WHERE t.name = 'No-show' AND c.id IN (
       SELECT contact_id FROM sales_calls WHERE id IN (136, 89))
     GROUP BY c.id
    HAVING count(*) FILTER (WHERE t.id = ANY (c.tags)) > 1) z;
  IF v_n <> 0 THEN RAISE EXCEPTION 'No-show tag applied more than once'; END IF;

  -- And the question they were asking is closed.
  SELECT count(*) INTO v_n FROM tasks
   WHERE sales_call_id IN (136, 89) AND done_date IS NULL;
  IF v_n <> 0 THEN RAISE EXCEPTION '% task(s) still ask what happened', v_n; END IF;

  RAISE NOTICE 'Christina and Mila recorded as no-shows, tasks closed';
END $$;
