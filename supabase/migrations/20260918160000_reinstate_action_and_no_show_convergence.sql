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

-- record_sales_call_reinstated(), close_tasks_for_sales_call() and the grant moved to 20260918155000_structure_owned_by_historical_repairs.sql.
-- This migration repairs historical production data and is not replayed
-- into an empty database, so it must not be the only thing that creates
-- structure the finished CRM needs. Its assertions below are unchanged.

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
