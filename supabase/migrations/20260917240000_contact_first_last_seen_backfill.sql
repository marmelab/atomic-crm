-- ===========================================================================
-- contacts.first_seen / last_seen for the imported people
-- ===========================================================================
-- 288 of 300 Contacts carry NULL in both columns: the historical importer
-- never wrote them, so "Date added" and "Last activity" sorting would place
-- almost everybody in one undifferentiated block. A previous slice noticed
-- the same thing from the other direction and concluded these fields were
-- not meaningful in this CRM, which was true while they held no data.
--
-- They are derivable, though, and the derivation is exactly what the column
-- names say: first_seen is the EARLIEST real dated evidence this person
-- exists, last_seen the LATEST. Every source below is already in MAIN and
-- already dated — an application submission, a sales call, a client
-- session, the creation of their Opportunity. Nothing is invented, and a
-- person with no dated evidence at all keeps NULL rather than a guess.
--
-- Deliberately not a trigger: these are historical facts being filled in
-- once. Live Contacts already get first_seen/last_seen from the app.

WITH evidence AS (
  SELECT c.id AS contact_id, e.at
    FROM contacts c
    JOIN LATERAL (
      SELECT a.submitted_at AS at FROM applications a WHERE a.contact_id = c.id
      UNION ALL
      SELECT a.reviewed_at FROM applications a WHERE a.contact_id = c.id
      UNION ALL
      -- A date-only historical call has no timestamp; its date is still
      -- real evidence, read at midday so it cannot slide a day.
      SELECT coalesce(sc.original_scheduled_at, (sc.scheduled_on + time '12:00') AT TIME ZONE 'UTC')
        FROM sales_calls sc WHERE sc.contact_id = c.id
      UNION ALL
      SELECT cs.scheduled_at FROM client_sessions cs WHERE cs.contact_id = c.id
      UNION ALL
      SELECT d.created_at FROM deals d WHERE d.contact_id = c.id
      UNION ALL
      SELECT w.joined_at FROM waitlist_entries w WHERE w.contact_id = c.id
    ) e ON true
   WHERE e.at IS NOT NULL
),
bounds AS (
  SELECT contact_id, min(at) AS first_at, max(at) AS last_at
    FROM evidence
   GROUP BY contact_id
)
UPDATE contacts c
   SET first_seen = COALESCE(c.first_seen, b.first_at),
       last_seen  = COALESCE(c.last_seen,  b.last_at)
  FROM bounds b
 WHERE b.contact_id = c.id
   AND (c.first_seen IS NULL OR c.last_seen IS NULL);

-- Report what is still unknown rather than filling it with anything. A
-- Contact with no dated evidence anywhere legitimately has no first_seen,
-- and sorting places them last.
DO $$
DECLARE v_missing bigint;
BEGIN
  SELECT count(*) INTO v_missing FROM contacts WHERE first_seen IS NULL;
  RAISE NOTICE 'contacts still without first_seen (no dated evidence anywhere): %', v_missing;
END $$;

-- Sorting reads these on every Contacts page load.
CREATE INDEX IF NOT EXISTS "contacts_first_seen_idx" ON "public"."contacts" USING btree ("first_seen");
CREATE INDEX IF NOT EXISTS "contacts_last_seen_idx" ON "public"."contacts" USING btree ("last_seen");
