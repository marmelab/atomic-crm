-- ===========================================================================
-- Last Activity has to keep up with time passing
-- ===========================================================================
-- Last Activity is DERIVED from events that have occurred, but it is
-- STORED — the Contacts list sorts and filters on it, so it cannot be
-- computed per row on every read. That leaves a gap nothing has filled:
-- events become "occurred" simply because time passes, and no write
-- touches the Contact when they do.
--
-- Caught on the hour it happened. Mihaela Petrova's Opportunity carries a
-- date-only import timestamp of 2026-09-18T00:00:00; the moment the clock
-- passed midnight UTC that stopped being a future date and started being
-- real activity, and her stored Last Activity stayed on the previous day.
-- Every client whose session was yesterday has the same problem: the
-- session happened, and the CRM will not say so until something unrelated
-- happens to write to their row.
--
-- Pure SQL, so it runs directly in pg_cron with no HTTP hop, no Edge
-- Function and no secret. It only ever writes rows whose value actually
-- changed, so a run with nothing to do writes nothing at all.

CREATE OR REPLACE FUNCTION "public"."refresh_contact_last_activity"()
  RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_updated bigint;
begin
  update contacts c
     set last_seen = contact_last_occurred_activity(c.id)
   where contact_last_occurred_activity(c.id) is not null
     and c.last_seen is distinct from contact_last_occurred_activity(c.id);
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

COMMENT ON FUNCTION "public"."refresh_contact_last_activity"() IS
  'Recomputes contacts.last_seen from occurred events only. Idempotent: a second run with no time passing updates 0 rows.';

SELECT cron.unschedule('refresh-contact-last-activity')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-contact-last-activity');

-- Hourly, offset from the Acuity reconciliation so the two do not contend,
-- and deliberately AFTER it: reconciliation may record a cancellation or a
-- concluded call, and this then reflects it.
SELECT cron.schedule(
  'refresh-contact-last-activity',
  '37 * * * *',
  $job$ select refresh_contact_last_activity(); $job$
);

-- Bring everything current once, now.
DO $$
DECLARE
  v_first bigint;
  v_second bigint;
  v_future bigint;
BEGIN
  v_first := refresh_contact_last_activity();
  -- Idempotence, measured rather than asserted: immediately re-running
  -- with no time elapsed must find nothing left to do.
  v_second := refresh_contact_last_activity();
  IF v_second <> 0 THEN
    RAISE EXCEPTION 'refresh is not idempotent: second run updated % row(s)', v_second;
  END IF;

  SELECT count(*) INTO v_future FROM contacts WHERE last_seen > now();
  IF v_future > 0 THEN
    RAISE EXCEPTION 'refresh produced % future Last Activity value(s)', v_future;
  END IF;

  RAISE NOTICE 'Last Activity refreshed: % contact(s) brought current, second run 0', v_first;
END $$;
