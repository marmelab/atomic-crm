-- ===========================================================================
-- Last Activity is the latest thing that HAS happened
-- ===========================================================================
-- Production showed Contacts whose "Last activity" read 2026-12-16 while
-- today was 2026-09-17. Fifteen of them, up to three months ahead. The
-- cause was in the backfill that filled these columns: it took the latest
-- DATED evidence of any kind, and a scheduled client session or sales call
-- is dated evidence of something that has not occurred yet. So a client
-- with sessions booked through December looked like their last contact was
-- in December.
--
-- "Last activity" answers "when did I last actually hear from / meet this
-- person". A future booking is the opposite of that — it is precisely the
-- thing that has NOT happened. Sorting by it put people who are furthest
-- from contact at the top of the most-recently-active list.
--
-- Two halves, because fixing only the stored values would let the same
-- defect return on the next write:
--
--   1. recompute every Contact's last_seen from OCCURRED evidence only
--   2. a trigger, so no write from any source can ever park last_seen in
--      the future again
--
-- first_seen is deliberately left alone. It is the EARLIEST evidence a
-- person exists, and the earliest evidence is never in the future; Leif's
-- own definition of Date Added ("earliest known truthful business-history
-- evidence") is what the existing backfill already produces.

-- ---------------------------------------------------------------------------
-- 1. The ceiling, enforced on every write.
-- ---------------------------------------------------------------------------
-- Clamps rather than rejects. A future last_seen is not a disagreement to
-- resolve — it is definitionally wrong, and "now" is the latest value that
-- could possibly be true. Rejecting would break ordinary app writes for a
-- value the database can correct exactly.
CREATE OR REPLACE FUNCTION "public"."clamp_contact_last_seen"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.last_seen is not null and new.last_seen > now() then
    new.last_seen := now();
  end if;
  -- A person cannot have been last seen before they were first seen.
  if new.first_seen is not null and new.last_seen is not null
     and new.last_seen < new.first_seen then
    new.last_seen := new.first_seen;
  end if;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS "clamp_contact_last_seen_trigger" ON "public"."contacts";
CREATE TRIGGER "clamp_contact_last_seen_trigger"
  BEFORE INSERT OR UPDATE OF "last_seen", "first_seen" ON "public"."contacts"
  FOR EACH ROW EXECUTE FUNCTION "public"."clamp_contact_last_seen"();

-- ---------------------------------------------------------------------------
-- 2. Recompute from occurred evidence only.
-- ---------------------------------------------------------------------------
-- Every source below is a thing that HAPPENED, and each is filtered to
-- at-or-before now regardless, so a row with a bad timestamp cannot leak a
-- future value back in. Deliberately excluded: a sales call or client
-- session whose scheduled time is still ahead of us, and the expected
-- session windows, which are projections rather than events.
WITH occurred AS (
  -- An application really was submitted / reviewed.
  SELECT a.contact_id, a.submitted_at AS at FROM applications a WHERE a.submitted_at <= now()
  UNION ALL
  SELECT a.contact_id, a.reviewed_at FROM applications a WHERE a.reviewed_at <= now()
  UNION ALL
  -- A sales call counts once its own time has passed, or once something
  -- terminal was recorded about it. A date-only historical call is read at
  -- the end of its day: that is the earliest moment the whole day is
  -- certainly behind us, and it never invents a clock time.
  SELECT sc.contact_id,
         coalesce(sc.scheduled_at, (sc.scheduled_on + time '23:59') AT TIME ZONE 'UTC')
    FROM sales_calls sc
   WHERE coalesce(sc.scheduled_at, (sc.scheduled_on + time '23:59') AT TIME ZONE 'UTC') <= now()
  UNION ALL
  SELECT sc.contact_id, sc.cancelled_at FROM sales_calls sc WHERE sc.cancelled_at <= now()
  UNION ALL
  SELECT sc.contact_id, sc.attendance_recorded_at FROM sales_calls sc WHERE sc.attendance_recorded_at <= now()
  UNION ALL
  -- Sales call history events are by definition things that occurred.
  SELECT sc.contact_id, e.occurred_at
    FROM sales_call_events e JOIN sales_calls sc ON sc.id = e.sales_call_id
   WHERE e.occurred_at <= now()
  UNION ALL
  -- A client session that has already taken place, been cancelled, or been
  -- missed. A session booked for December is NOT activity today.
  SELECT cs.contact_id, cs.scheduled_at FROM client_sessions cs WHERE cs.scheduled_at <= now()
  UNION ALL
  SELECT cs.contact_id, cs.cancelled_at FROM client_sessions cs WHERE cs.cancelled_at <= now()
  UNION ALL
  SELECT cs.contact_id, cs.no_show_at FROM client_sessions cs WHERE cs.no_show_at <= now()
  UNION ALL
  SELECT d.contact_id, d.created_at FROM deals d WHERE d.created_at <= now()
  UNION ALL
  SELECT d.contact_id, se.entered_at
    FROM deal_stage_events se JOIN deals d ON d.id = se.opportunity_id
   WHERE se.entered_at <= now()
  UNION ALL
  SELECT w.contact_id, w.joined_at FROM waitlist_entries w WHERE w.joined_at <= now()
  UNION ALL
  -- Somebody wrote something down about this person.
  SELECT n.contact_id, n.date FROM contact_notes n WHERE n.date <= now()
  UNION ALL
  SELECT d.contact_id, n.date
    FROM deal_notes n JOIN deals d ON d.id = n.deal_id
   WHERE n.date <= now()
),
bounds AS (
  SELECT contact_id, max(at) AS last_at
    FROM occurred
   WHERE at IS NOT NULL AND contact_id IS NOT NULL
   GROUP BY contact_id
)
UPDATE contacts c
   SET last_seen = b.last_at
  FROM bounds b
 WHERE b.contact_id = c.id
   AND c.last_seen IS DISTINCT FROM b.last_at;

-- A Contact with no occurred evidence at all keeps whatever it has, but can
-- still never sit in the future.
UPDATE contacts SET last_seen = now() WHERE last_seen > now();

-- ---------------------------------------------------------------------------
-- 3. Prove it.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_future bigint;
  v_backwards bigint;
BEGIN
  SELECT count(*) INTO v_future FROM contacts WHERE last_seen > now();
  IF v_future > 0 THEN
    RAISE EXCEPTION 'Last Activity still in the future for % contact(s)', v_future;
  END IF;

  SELECT count(*) INTO v_backwards FROM contacts
   WHERE first_seen IS NOT NULL AND last_seen IS NOT NULL AND last_seen < first_seen;
  IF v_backwards > 0 THEN
    RAISE EXCEPTION '% contact(s) were last seen before they were first seen', v_backwards;
  END IF;

  RAISE NOTICE 'Last Activity: no future values, no reversed ranges';
END $$;
