-- ===========================================================================
-- Identifiers, and a temperature that is only a temperature
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. contacts.identifiers
-- ---------------------------------------------------------------------------
-- Leif runs this business out of memory as much as out of the CRM, and the
-- thing that brings a person back is rarely their pipeline stage — it is
-- "nurse · Florida · 50s · anxious". A free-text cue, written by a human
-- for a human.
--
-- Deliberately ONE nullable free-text column rather than structured fields
-- for profession/location/age/disposition. The examples are not a schema:
-- they are whatever Leif happens to remember about that person, in his own
-- words and his own order, and forcing them into columns would both lose
-- the ones that fit nothing and demand values he does not have. Nothing
-- computes on this, nothing validates it, and nothing is required.
--
-- No existing Contact field serves this. `background` is prose about how
-- they met and their story; `title`/`company_id` are employment facts.
-- Neither is a glanceable memory cue, and overloading `background` would
-- make the drawer show a paragraph where a line belongs.
ALTER TABLE "public"."contacts"
  ADD COLUMN IF NOT EXISTS "identifiers" text;

COMMENT ON COLUMN "public"."contacts"."identifiers" IS
  'Human memory cues, free text, e.g. "nurse · Florida · 50s · anxious". Never computed on, never required, never inferred.';

-- No historical backfill. The import source holds no field that reliably
-- means this, and a guessed identifier is worse than an empty one: Leif
-- would read it as something he wrote. See this round's report for the
-- source audit.

-- ---------------------------------------------------------------------------
-- 2. Relationship temperature: drop "In Contract"
-- ---------------------------------------------------------------------------
-- contacts.status is the relationship TEMPERATURE — None / Cold / Warm /
-- Hot. "In Contract" was in that vocabulary and is not a temperature: it
-- is a claim that somebody is a paying client, which is owned by the
-- Opportunity (stage won) and the Enrollment (status active). One field
-- was answering two unrelated questions, and the one it answered less
-- reliably was the one people would have trusted.
--
-- Migrates the value away without touching any client truth: the
-- Enrollment and the Opportunity already carry that and are untouched
-- here. 'hot' rather than NULL, because somebody who signed is not a
-- person of unknown warmth.
DO $$
DECLARE v_moved bigint;
BEGIN
  UPDATE contacts SET status = 'hot' WHERE status = 'in-contract';
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE 'contacts moved off the "In Contract" temperature: %', v_moved;

  IF EXISTS (SELECT 1 FROM contacts WHERE status = 'in-contract') THEN
    RAISE EXCEPTION 'contacts still carry the retired "in-contract" status';
  END IF;
END $$;

-- Sorting and filtering the Contacts list by temperature.
CREATE INDEX IF NOT EXISTS "contacts_status_idx"
  ON "public"."contacts" USING btree ("status") WHERE "status" IS NOT NULL;
