-- ===========================================================================
-- Four owner-authorized identity merges
-- ===========================================================================
-- The historical import created a standalone Contact for every Living
-- Example Application that carried no email address, keyed on the Notion
-- page id (`le-standalone:<page>`). When that applicant already existed in
-- the CRM under their real email, the result was two records for one
-- person: the real one with their Deals, calls and sessions, and an orphan
-- holding nothing but the Application.
--
-- Nine same-name pairs were audited field by field. Five are NOT merged:
--
--   Terra Israd (212/213) are two different people — two distinct real
--   email addresses, nothing shared. Leif confirmed this independently.
--
--   Denise Cormier, Maria Pujol Carreras, Neil Zaragoza and Sigrid Kipper
--   Thau have an Application on BOTH sides, so the orphan is not
--   self-evidently the same person's, and the orphan carries no email to
--   decide it with. Left separate, deliberately, for future source
--   evidence. No task is created for them: they are a historical
--   ambiguity, not current operational work.
--
-- The four below are merged on Leif's authorization, on the evidence that
-- the active Living Example person has NO Application of their own and the
-- only Application under that name is the isolated orphan — and an LE
-- client necessarily applied at some point.
--
--   Gina McNamara   45 <- 346
--   Mark Walsh      96 <- 365
--   Sarah Monast    99 <- 358
--   Sophie Russell  98 <- 351
--
-- Nothing is duplicated and nothing is lost. The surviving record keeps
-- its real email; the orphan's only "email" is a Notion page id, not an
-- address, and that page is already recorded on the Application's own
-- provenance row, so moving the Application carries the source with it.

BEGIN;

-- Outbound avatar enrichment fires one HTTP lookup per contact write.
-- These are record repairs, not new people.
SELECT set_historical_migration_mode(true);

DO $$
DECLARE
  v_pair record;
  v_moved_applications bigint := 0;
  v_moved_other bigint := 0;
  v_n bigint;
  v_drop_prov text;
BEGIN
  FOR v_pair IN
    SELECT * FROM (VALUES (45, 346), (96, 365), (99, 358), (98, 351)) p(keep, drop_id)
  LOOP
    -- Re-verify at the moment of writing rather than trusting the audit
    -- that produced this list.
    IF (SELECT lower(first_name || last_name) FROM contacts WHERE id = v_pair.keep)
       IS DISTINCT FROM
       (SELECT lower(first_name || last_name) FROM contacts WHERE id = v_pair.drop_id) THEN
      RAISE EXCEPTION 'contacts % and % no longer share a name', v_pair.keep, v_pair.drop_id;
    END IF;

    -- The survivor must be the side with the real address, and the dropped
    -- side must still be the emailless orphan. If either has changed since
    -- the audit, stop rather than merge the wrong way round.
    IF EXISTS (
      SELECT 1 FROM contacts c, jsonb_array_elements(c.email_jsonb) e
       WHERE c.id = v_pair.drop_id AND (e->>'email') NOT LIKE 'le-standalone:%'
    ) THEN
      RAISE EXCEPTION 'contact % carries a real email address and is not an orphan', v_pair.drop_id;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM contacts c, jsonb_array_elements(c.email_jsonb) e
       WHERE c.id = v_pair.keep AND (e->>'email') NOT LIKE 'le-standalone:%'
    ) THEN
      RAISE EXCEPTION 'survivor % has no real email address', v_pair.keep;
    END IF;

    -- Everything the orphan owns moves across. Applications are the only
    -- non-zero case in this batch; the rest are written anyway so a merge
    -- can never silently strand a row that appeared after the audit.
    UPDATE applications SET contact_id = v_pair.keep WHERE contact_id = v_pair.drop_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_moved_applications := v_moved_applications + v_n;

    UPDATE deals SET contact_id = v_pair.keep WHERE contact_id = v_pair.drop_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_moved_other := v_moved_other + v_n;
    UPDATE sales_calls SET contact_id = v_pair.keep WHERE contact_id = v_pair.drop_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_moved_other := v_moved_other + v_n;
    UPDATE client_sessions SET contact_id = v_pair.keep WHERE contact_id = v_pair.drop_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_moved_other := v_moved_other + v_n;
    UPDATE contact_notes SET contact_id = v_pair.keep WHERE contact_id = v_pair.drop_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_moved_other := v_moved_other + v_n;
    UPDATE tasks SET contact_id = v_pair.keep WHERE contact_id = v_pair.drop_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_moved_other := v_moved_other + v_n;
    UPDATE waitlist_entries SET contact_id = v_pair.keep WHERE contact_id = v_pair.drop_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_moved_other := v_moved_other + v_n;
    UPDATE waitlist_invitations SET contact_id = v_pair.keep WHERE contact_id = v_pair.drop_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_moved_other := v_moved_other + v_n;

    -- Date Added becomes the earliest truthful evidence across both, which
    -- in every one of these four is the orphan's Application submission —
    -- the person really did first appear then.
    UPDATE contacts
       SET first_seen = least(
             first_seen,
             (SELECT first_seen FROM contacts WHERE id = v_pair.drop_id))
     WHERE id = v_pair.keep;

    -- Provenance. The orphan's own row cannot be repointed at the survivor
    -- (historical_import_records is UNIQUE on entity_table+entity_id), so
    -- its source key is appended to the survivor's evidence instead. The
    -- Notion page itself is already recorded against the Application that
    -- moved, so nothing becomes untraceable.
    SELECT source_key INTO v_drop_prov
      FROM historical_import_records
     WHERE entity_table = 'contacts' AND entity_id = v_pair.drop_id;

    IF v_drop_prov IS NOT NULL THEN
      UPDATE historical_import_records
         SET evidence_notes = concat_ws(
               ' | ',
               nullif(evidence_notes, ''),
               format('merged contact %s (%s) on owner authorization', v_pair.drop_id, v_drop_prov))
       WHERE entity_table = 'contacts' AND entity_id = v_pair.keep;

      DELETE FROM historical_import_records
       WHERE entity_table = 'contacts' AND entity_id = v_pair.drop_id;
    END IF;

    DELETE FROM contacts WHERE id = v_pair.drop_id;
  END LOOP;

  IF v_moved_applications <> 4 THEN
    RAISE EXCEPTION 'expected to move exactly 4 Applications, moved %', v_moved_applications;
  END IF;
  RAISE NOTICE 'merged 4 identities: % Application(s), % other row(s) moved',
    v_moved_applications, v_moved_other;
END $$;

-- Last Activity is derived, so it is recomputed rather than carried over
-- from either side. Occurred events only, as everywhere else.
UPDATE contacts c
   SET last_seen = contact_last_occurred_activity(c.id)
 WHERE c.id IN (45, 96, 99, 98)
   AND contact_last_occurred_activity(c.id) IS NOT NULL
   AND c.last_seen IS DISTINCT FROM contact_last_occurred_activity(c.id);

SELECT set_historical_migration_mode(false);

-- ---------------------------------------------------------------------------
-- Prove it.
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_n bigint;
BEGIN
  SELECT count(*) INTO v_n FROM contacts WHERE id IN (346, 365, 358, 351);
  IF v_n <> 0 THEN
    RAISE EXCEPTION '% orphan contact(s) survived the merge', v_n;
  END IF;

  -- Each survivor now holds exactly one Application, and no duplicates
  -- were created anywhere.
  SELECT count(*) INTO v_n FROM (
    SELECT contact_id FROM applications WHERE contact_id IN (45, 96, 99, 98)
     GROUP BY contact_id HAVING count(*) <> 1) z;
  IF v_n <> 0 THEN
    RAISE EXCEPTION '% survivor(s) do not hold exactly one Application', v_n;
  END IF;

  -- Nothing anywhere may still point at a contact that no longer exists.
  SELECT
    (SELECT count(*) FROM applications a WHERE NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id = a.contact_id))
  + (SELECT count(*) FROM deals d WHERE NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id = d.contact_id))
  + (SELECT count(*) FROM sales_calls s WHERE NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id = s.contact_id))
  + (SELECT count(*) FROM client_sessions s WHERE NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id = s.contact_id))
  + (SELECT count(*) FROM tasks t WHERE t.contact_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id = t.contact_id))
    INTO v_n;
  IF v_n <> 0 THEN
    RAISE EXCEPTION '% orphaned row(s) reference a deleted contact', v_n;
  END IF;

  -- The four pairs Leif kept separate must still be separate.
  SELECT count(*) INTO v_n FROM contacts WHERE id IN (106, 344, 142, 341, 133, 364, 161, 349, 212, 213);
  IF v_n <> 10 THEN
    RAISE EXCEPTION 'a pair that must remain separate was merged (% of 10 remain)', v_n;
  END IF;

  RAISE NOTICE 'Group A merged; Group B and Terra untouched';
END $$;

COMMIT;
