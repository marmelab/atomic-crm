-- ===========================================================================
-- Two questions, two task types
-- ===========================================================================
-- Production acceptance found the Dashboard offering:
--
--   SALES CALL NEEDS MATCHING
--   Megan Auron · The Living Example · call of Jul 7, 2026 — what happened?
--
-- and the page it opens answering "This booking is already attached to an
-- Opportunity." Both halves were right about their own concern, and the
-- pair was a contradiction: Megan's call does not need matching. What is
-- unknown is what HAPPENED on it.
--
-- One task type was serving two unrelated operational problems:
--
--   sales_call_needs_matching — not attached to any Opportunity. The open
--     question is WHICH sales relationship this booking belongs to.
--     Valid for exactly as long as sales_calls.opportunity_id IS NULL.
--
--   resolve_sales_call — attached to the right Opportunity already. The
--     open question is ATTENDANCE/OUTCOME, answered by the three canonical
--     actions (call happened / no-show / cancelled).
--
-- This migration splits the existing rows along that line and then makes
-- the matching task's own validity rule enforceable by the database rather
-- than by remembering to call something.

-- ---------------------------------------------------------------------------
-- 1. The rule, as a trigger.
-- ---------------------------------------------------------------------------
-- The app's resolution page has always completed the matching task itself
-- (resolveUnmatchedSalesCall.ts's finishAttaching). That covers the path a
-- human clicks and nothing else — which is how five of these went stale in
-- production: an Acuity reconciliation backfill attached the Opportunity
-- in SQL, the booking stopped needing matching, and the task carried on
-- claiming otherwise on the Dashboard.
--
-- A matching task is answered the moment opportunity_id stops being NULL,
-- no matter WHO attached it: the resolution page, Acuity reconciliation, a
-- backfill, a future canonical matching action, or a hand-written UPDATE.
-- That is a property of the data, so it is enforced here.
CREATE OR REPLACE FUNCTION "public"."complete_sales_call_matching_task"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  -- Only the NULL -> attached transition answers the question. An
  -- already-attached call being re-saved changes nothing, and a call that
  -- is still unmatched must keep its task.
  if old.opportunity_id is not null or new.opportunity_id is null then
    return new;
  end if;

  update tasks
     set done_date = coalesce(done_date, now()),
         status    = 'completed'
   where sales_call_id = new.id
     and type = 'sales_call_needs_matching'
     and done_date is null;

  return new;
end;
$$;

DROP TRIGGER IF EXISTS "complete_sales_call_matching_task_trigger" ON "public"."sales_calls";
CREATE TRIGGER "complete_sales_call_matching_task_trigger"
  AFTER UPDATE OF "opportunity_id" ON "public"."sales_calls"
  FOR EACH ROW EXECUTE FUNCTION "public"."complete_sales_call_matching_task"();

-- ---------------------------------------------------------------------------
-- 2. Split the existing rows.
-- ---------------------------------------------------------------------------
-- Every pending task of the old combined type is re-filed by what its call
-- ACTUALLY needs today. Nothing is invented and no attendance is recorded:
-- an unknown outcome stays unknown, it just stops being described as a
-- matching problem.
DO $$
DECLARE
  v_to_matching   bigint;
  v_answered      bigint;
  v_kept_outcome  bigint;
  v_orphaned      bigint;
BEGIN
  -- 2a. Still unmatched -> this genuinely IS a matching task.
  UPDATE tasks t
     SET type = 'sales_call_needs_matching'
    FROM sales_calls sc
   WHERE sc.id = t.sales_call_id
     AND t.type = 'resolve_sales_call'
     AND t.done_date IS NULL
     AND sc.opportunity_id IS NULL;
  GET DIAGNOSTICS v_to_matching = ROW_COUNT;

  -- 2b. Attached, and the call has not happened yet: the matching question
  --     is answered and there is no outcome to ask about. Nothing is
  --     outstanding, so the task is complete. These are the five stale rows
  --     the Acuity backfill left behind (calls of Oct 13-16, all attached).
  --     The call still shows on the Opportunity and in the normal
  --     "Sales Call: {Person}" task; this only retires the alert that said
  --     it needed matching.
  UPDATE tasks t
     SET done_date = coalesce(t.done_date, now()),
         status = 'completed'
    FROM sales_calls sc
   WHERE sc.id = t.sales_call_id
     AND t.type = 'resolve_sales_call'
     AND t.done_date IS NULL
     AND sc.opportunity_id IS NOT NULL
     AND (
       sc.dismissed_at IS NOT NULL
       OR sc.status = 'cancelled'
       OR sc.attendance IS NOT NULL
       OR coalesce(sc.scheduled_at, (sc.scheduled_on + time '23:59') AT TIME ZONE 'UTC') > now()
     );
  GET DIAGNOSTICS v_answered = ROW_COUNT;

  -- 2c. Attached, past, attendance never recorded: the ambiguity Leif
  --     actually has. Keeps type resolve_sales_call — which now means what
  --     its name says — and keeps its own "— what happened?" text.
  SELECT count(*) INTO v_kept_outcome
    FROM tasks t JOIN sales_calls sc ON sc.id = t.sales_call_id
   WHERE t.type = 'resolve_sales_call' AND t.done_date IS NULL;

  -- 2d. A task pointing at no sales call at all cannot be classified by
  --     either rule. Report rather than guess.
  SELECT count(*) INTO v_orphaned
    FROM tasks t
   WHERE t.type IN ('resolve_sales_call', 'sales_call_needs_matching')
     AND t.done_date IS NULL
     AND (t.sales_call_id IS NULL OR NOT EXISTS (
           SELECT 1 FROM sales_calls sc WHERE sc.id = t.sales_call_id));

  RAISE NOTICE 're-filed as needs-matching: %', v_to_matching;
  RAISE NOTICE 'completed (matching answered, nothing outstanding): %', v_answered;
  RAISE NOTICE 'kept as resolve_sales_call (outcome unknown): %', v_kept_outcome;
  RAISE NOTICE 'unclassifiable (no sales call): %', v_orphaned;

  -- The invariant this migration exists to establish: no pending matching
  -- task may describe a booking that is already attached.
  IF EXISTS (
    SELECT 1 FROM tasks t JOIN sales_calls sc ON sc.id = t.sales_call_id
     WHERE t.type = 'sales_call_needs_matching'
       AND t.done_date IS NULL
       AND sc.opportunity_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'a pending sales_call_needs_matching task still points at an attached booking';
  END IF;
END $$;

-- Both types resolve off this FK on every Dashboard render.
CREATE INDEX IF NOT EXISTS "tasks_sales_call_id_pending_idx"
  ON "public"."tasks" USING btree ("sales_call_id")
  WHERE "done_date" IS NULL;
