-- ===========================================================================
-- A future booking is not activity, and it is not today either
-- ===========================================================================
-- The previous migration stopped Last Activity showing dates months ahead,
-- but it did it the wrong way: a future value was CLAMPED to now(). That
-- replaces one falsehood with a quieter one.
--
--   actual last occurred activity   2026-07-15
--   future appointment              2026-12-16
--   what the clamp produced         2026-09-17  (the day it happened to run)
--   the truth                       2026-07-15
--
-- Somebody last heard from in July reads as last heard from today, purely
-- because a December booking passed through the system. The person most
-- overdue for contact is pushed to the top of the recently-active list —
-- the same defect as before, with a less obvious symptom.
--
-- A future event is not a late-arriving Last Activity to be trimmed. It is
-- not a candidate at all. So the rule moves out of the write path and into
-- a derivation: Last Activity is the latest qualifying event that has
-- ACTUALLY OCCURRED, and anything scheduled ahead of now is simply not
-- consulted.

-- ---------------------------------------------------------------------------
-- 1. The canonical derivation, in one place.
-- ---------------------------------------------------------------------------
-- Every source is a thing that HAPPENED, and each is filtered to at-or-
-- before now regardless, so a single bad timestamp cannot leak a future
-- value back in. Deliberately not consulted: a sales call or client
-- session still ahead of us, and the expected-session windows, which are
-- projections rather than events.
CREATE OR REPLACE FUNCTION "public"."contact_last_occurred_activity"(
  "p_contact_id" bigint
) RETURNS timestamptz
    LANGUAGE "sql"
    STABLE
    SET "search_path" TO 'public'
    AS $$
  select max(at) from (
    select a.submitted_at as at from applications a where a.contact_id = p_contact_id and a.submitted_at <= now()
    union all
    select a.reviewed_at from applications a where a.contact_id = p_contact_id and a.reviewed_at <= now()
    union all
    -- A sales call counts once its own time has passed. A date-only
    -- historical call is read at the end of its day: the earliest moment
    -- the whole day is certainly behind us, inventing no clock time.
    select coalesce(sc.scheduled_at, (sc.scheduled_on + time '23:59') at time zone 'UTC')
      from sales_calls sc
     where sc.contact_id = p_contact_id
       and coalesce(sc.scheduled_at, (sc.scheduled_on + time '23:59') at time zone 'UTC') <= now()
    union all
    select sc.cancelled_at from sales_calls sc where sc.contact_id = p_contact_id and sc.cancelled_at <= now()
    union all
    select sc.attendance_recorded_at from sales_calls sc where sc.contact_id = p_contact_id and sc.attendance_recorded_at <= now()
    union all
    select e.occurred_at from sales_call_events e join sales_calls sc on sc.id = e.sales_call_id
     where sc.contact_id = p_contact_id and e.occurred_at <= now()
    union all
    select cs.scheduled_at from client_sessions cs where cs.contact_id = p_contact_id and cs.scheduled_at <= now()
    union all
    select cs.cancelled_at from client_sessions cs where cs.contact_id = p_contact_id and cs.cancelled_at <= now()
    union all
    select cs.no_show_at from client_sessions cs where cs.contact_id = p_contact_id and cs.no_show_at <= now()
    union all
    select d.created_at from deals d where d.contact_id = p_contact_id and d.created_at <= now()
    union all
    select se.entered_at from deal_stage_events se join deals d on d.id = se.opportunity_id
     where d.contact_id = p_contact_id and se.entered_at <= now()
    union all
    select w.joined_at from waitlist_entries w where w.contact_id = p_contact_id and w.joined_at <= now()
    union all
    select n.date from contact_notes n where n.contact_id = p_contact_id and n.date <= now()
    union all
    select n.date from deal_notes n join deals d on d.id = n.deal_id
     where d.contact_id = p_contact_id and n.date <= now()
  ) occurred;
$$;

-- ---------------------------------------------------------------------------
-- 2. A future write is discarded, never rewritten to "now".
-- ---------------------------------------------------------------------------
-- Replaces the clamp. When something offers a Last Activity that has not
-- happened yet, the answer is the latest thing that HAS — recomputed from
-- the derivation above, not substituted with the current timestamp. If
-- nothing has occurred, the previous value stands rather than being
-- invented.
CREATE OR REPLACE FUNCTION "public"."clamp_contact_last_seen"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_occurred timestamptz;
begin
  if new.last_seen is not null and new.last_seen > now() then
    -- On INSERT there is no prior row; TG_OP tells us which fallback is
    -- honest. Either way, now() is never the answer.
    v_occurred := contact_last_occurred_activity(new.id);
    if v_occurred is not null then
      new.last_seen := v_occurred;
    elsif tg_op = 'UPDATE' then
      new.last_seen := old.last_seen;
    else
      new.last_seen := null;
    end if;
  end if;

  if new.first_seen is not null and new.last_seen is not null
     and new.last_seen < new.first_seen then
    new.last_seen := new.first_seen;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2b. Date Added must not postdate the evidence either.
-- ---------------------------------------------------------------------------
-- Two Contacts were created in the app AFTER things had already happened
-- with them: Pete Bassett was added 2026-09-13 with a client session that
-- took place 2026-09-10, Heidi Elias added 2026-09-12 with a sales call on
-- 2026-09-02. Their Date Added was the CRM row's birthday rather than the
-- earliest truthful business history, which is the opposite of what Leif
-- asked Date Added to mean — and it made their Last Activity appear to
-- precede their existence.
--
-- Only ever pulled EARLIER, never later: a Contact whose earliest evidence
-- is already recorded keeps it.
CREATE OR REPLACE FUNCTION "public"."contact_first_occurred_evidence"(
  "p_contact_id" bigint
) RETURNS timestamptz
    LANGUAGE "sql"
    STABLE
    SET "search_path" TO 'public'
    AS $f$
  select min(at) from (
    select a.submitted_at as at from applications a where a.contact_id = p_contact_id and a.submitted_at <= now()
    union all
    select coalesce(sc.scheduled_at, (sc.scheduled_on + time '12:00') at time zone 'UTC')
      from sales_calls sc where sc.contact_id = p_contact_id
    union all
    select cs.scheduled_at from client_sessions cs where cs.contact_id = p_contact_id
    union all
    select d.created_at from deals d where d.contact_id = p_contact_id
    union all
    select w.joined_at from waitlist_entries w where w.contact_id = p_contact_id
  ) evidence;
$f$;

UPDATE contacts c
   SET first_seen = contact_first_occurred_evidence(c.id)
 WHERE contact_first_occurred_evidence(c.id) IS NOT NULL
   AND (c.first_seen IS NULL OR contact_first_occurred_evidence(c.id) < c.first_seen);

-- ---------------------------------------------------------------------------
-- 3. Recompute everybody from the derivation.
-- ---------------------------------------------------------------------------
-- Repairs the fifteen Contacts the clamp had parked on the day it ran, and
-- makes every other Contact agree with the one definition.
UPDATE contacts c
   SET last_seen = contact_last_occurred_activity(c.id)
 WHERE contact_last_occurred_activity(c.id) IS NOT NULL
   AND c.last_seen IS DISTINCT FROM contact_last_occurred_activity(c.id);

-- ---------------------------------------------------------------------------
-- 4. Prove it, including that nothing sits on today by accident.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_future bigint;
  v_backwards bigint;
  v_disagree bigint;
BEGIN
  SELECT count(*) INTO v_future FROM contacts WHERE last_seen > now();
  IF v_future > 0 THEN
    RAISE EXCEPTION 'Last Activity still in the future for % contact(s)', v_future;
  END IF;

  SELECT count(*) INTO v_backwards FROM contacts
   WHERE first_seen IS NOT NULL AND last_seen IS NOT NULL AND last_seen < first_seen;
  IF v_backwards > 0 THEN
    RAISE EXCEPTION '% contact(s) last seen before first seen', v_backwards;
  END IF;

  -- Every Contact with occurred evidence must equal the derivation
  -- exactly: the value is derived, not merely bounded.
  -- Every Contact with occurred evidence equals the derivation, except
  -- where the never-before-Date-Added floor legitimately raises it.
  SELECT count(*) INTO v_disagree FROM contacts c
   WHERE contact_last_occurred_activity(c.id) IS NOT NULL
     AND c.last_seen IS DISTINCT FROM
         greatest(contact_last_occurred_activity(c.id), c.first_seen);
  IF v_disagree > 0 THEN
    RAISE EXCEPTION '% contact(s) disagree with the canonical derivation', v_disagree;
  END IF;

  -- And the floor must now be unnecessary: Date Added is derived too.
  IF EXISTS (
    SELECT 1 FROM contacts c
     WHERE contact_last_occurred_activity(c.id) IS NOT NULL
       AND c.first_seen IS NOT NULL
       AND contact_last_occurred_activity(c.id) < c.first_seen
  ) THEN
    RAISE EXCEPTION 'a Contact still has occurred activity earlier than its Date Added';
  END IF;

  RAISE NOTICE 'Last Activity derived from occurred events only';
END $$;

CREATE INDEX IF NOT EXISTS "sales_calls_contact_schedule_idx"
  ON "public"."sales_calls" USING btree ("contact_id", "scheduled_on");
