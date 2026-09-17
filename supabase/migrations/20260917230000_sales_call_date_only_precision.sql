-- ===========================================================================
-- Historical Sales Calls whose clock time is genuinely unknown
-- ===========================================================================
-- A call Leif knows happened (or was ghosted) on a particular DAY, with no
-- Acuity appointment, no calendar event and no source anywhere recording a
-- time. Both timestamp columns are NOT NULL today, so the only way to store
-- such a call was to pick a time — midnight, noon, anything — and every one
-- of those is a fact the source never contained. A nullable-time column
-- paired with a "time unknown" flag would be no better if the timestamp
-- still had to hold something.
--
-- So the date itself becomes the column that is always present, and the
-- precision is recorded explicitly:
--
--   exact      — a real appointment: both timestamps required, as before
--   date_only  — a historical fact: the date is known, and the timestamps
--                are NULL because there is nothing truthful to put in them
--
-- Enforced by CHECK rather than convention, so a date_only row cannot
-- silently acquire an invented time and an exact row cannot lose its real
-- one. Everything that exists today is 'exact' and is unaffected.

-- 1. The date, for every call. Backfilled from the real appointment time so
--    one column can be relied on for ordering and display regardless of
--    precision.
ALTER TABLE "public"."sales_calls"
  ADD COLUMN IF NOT EXISTS "scheduled_on" date;

UPDATE "public"."sales_calls"
   SET scheduled_on = (scheduled_at AT TIME ZONE 'UTC')::date
 WHERE scheduled_on IS NULL AND scheduled_at IS NOT NULL;

DO $$
DECLARE v_missing bigint;
BEGIN
  SELECT count(*) INTO v_missing FROM "public"."sales_calls" WHERE scheduled_on IS NULL;
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'scheduled_on backfill incomplete: % row(s) still null', v_missing;
  END IF;
END $$;

ALTER TABLE "public"."sales_calls"
  ALTER COLUMN "scheduled_on" SET NOT NULL;

-- 2. The precision. Everything already stored is a real appointment.
ALTER TABLE "public"."sales_calls"
  ADD COLUMN IF NOT EXISTS "schedule_precision" text NOT NULL DEFAULT 'exact';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_calls_schedule_precision_check') THEN
    ALTER TABLE "public"."sales_calls"
      ADD CONSTRAINT "sales_calls_schedule_precision_check"
      CHECK (schedule_precision IN ('exact', 'date_only'));
  END IF;
END $$;

-- 3. The timestamps become nullable — but ONLY a date_only row may leave
--    them null, and an exact row must still have both. That is the whole
--    invariant: no row can claim a time it does not have, and no real
--    appointment can lose the time it does.
ALTER TABLE "public"."sales_calls" ALTER COLUMN "original_scheduled_at" DROP NOT NULL;
ALTER TABLE "public"."sales_calls" ALTER COLUMN "scheduled_at" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_calls_schedule_shape_check') THEN
    ALTER TABLE "public"."sales_calls"
      ADD CONSTRAINT "sales_calls_schedule_shape_check"
      CHECK (
        (schedule_precision = 'exact'
          AND original_scheduled_at IS NOT NULL
          AND scheduled_at IS NOT NULL)
        OR
        (schedule_precision = 'date_only'
          AND original_scheduled_at IS NULL
          AND scheduled_at IS NULL)
      );
  END IF;
END $$;

-- A date_only call is history, never a live booking: there is no time to
-- show up at, so it can never be the Opportunity's next scheduled call.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_calls_date_only_not_booked_check') THEN
    ALTER TABLE "public"."sales_calls"
      ADD CONSTRAINT "sales_calls_date_only_not_booked_check"
      CHECK (schedule_precision = 'exact' OR status <> 'booked');
  END IF;
END $$;

-- 4. deals.sales_call_at advertises the next scheduled call, and a
--    date_only row has no time to advertise. Re-issued so the "most recent
--    still-booked call" computation can never pick one up. (The
--    date_only-not-booked constraint above already makes that impossible;
--    this keeps the function honest on its own terms rather than relying on
--    a constraint elsewhere.)
CREATE OR REPLACE FUNCTION "public"."sync_deal_sales_call_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_opportunity_id bigint;
  v_latest timestamptz;
begin
  v_opportunity_id := coalesce(new.opportunity_id, old.opportunity_id);
  if v_opportunity_id is null then
    return coalesce(new, old);
  end if;

  select sc.scheduled_at into v_latest
    from sales_calls sc
   where sc.opportunity_id = v_opportunity_id
     and sc.status = 'booked'
     and sc.schedule_precision = 'exact'
   order by sc.scheduled_at desc
   limit 1;

  update deals
     set sales_call_at = v_latest
   where id = v_opportunity_id
     and sales_call_at is distinct from v_latest;

  return coalesce(new, old);
end;
$$;
