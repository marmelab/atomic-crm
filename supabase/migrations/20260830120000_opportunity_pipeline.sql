-- Proof slice: reshape the `deals` table into a Leif CRM Opportunity for a
-- single fixed offer (The Living Example). See CLAUDE.md / the "Foundation
-- Audit" report for the architecture decision behind reshaping the existing
-- table in place rather than renaming it.
--
-- - Opportunity belongs to exactly one Contact (was a many-contact array).
-- - Adds: offer (fixed single value for now), outcome, owner_decision,
--   prospect_decision, follow_up_date, source, entry_path.
-- - `stage` keeps its existing free-text shape; the app now drives it with
--   the universal pipeline values (interested .. committed .. won) via the
--   `dealStages` runtime config, same mechanism as before.
--
-- No production data is affected: this is a declarative-schema fork with no
-- real client rows, so the old `contact_ids` array is dropped rather than
-- migrated cell-by-cell.

ALTER TABLE "public"."deals"
    ADD COLUMN "contact_id" bigint,
    ADD COLUMN "offer" text NOT NULL DEFAULT 'the_living_example',
    ADD COLUMN "outcome" text,
    ADD COLUMN "owner_decision" text,
    ADD COLUMN "prospect_decision" text,
    ADD COLUMN "follow_up_date" date,
    ADD COLUMN "source" text,
    ADD COLUMN "entry_path" text;

ALTER TABLE "public"."deals"
    ADD CONSTRAINT "deals_offer_check" CHECK (offer IN ('the_living_example')),
    ADD CONSTRAINT "deals_outcome_check" CHECK (outcome IN ('nurture', 'needs_higher_care', 'not_fit', 'lost')),
    ADD CONSTRAINT "deals_owner_decision_check" CHECK (owner_decision IN ('would_work_with', 'workshops_only', 'do_not_engage')),
    ADD CONSTRAINT "deals_prospect_decision_check" CHECK (prospect_decision IN ('yes', 'thinking', 'no')),
    ADD CONSTRAINT "deals_source_check" CHECK (source IN ('instagram', 'referral', 'podcast', 'workshop', 'substack', 'google', 'other')),
    ADD CONSTRAINT "deals_entry_path_check" CHECK (entry_path IN ('instagram_conversation', 'sales_page', 'other'));

ALTER TABLE "public"."deals"
    ADD CONSTRAINT "deals_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES "public"."contacts"(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE INDEX "deals_contact_id_idx" ON "public"."deals" USING btree (contact_id);

ALTER TABLE "public"."deals"
    DROP COLUMN "contact_ids";

-- Reassign opportunities on contact merge via the new single contact_id FK
-- instead of splicing the old contact_ids array.
CREATE OR REPLACE FUNCTION "public"."merge_contacts"("loser_id" bigint, "winner_id" bigint) RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  winner_contact contacts%ROWTYPE;
  loser_contact contacts%ROWTYPE;
  merged_emails jsonb;
  merged_phones jsonb;
  merged_tags bigint[];
  winner_emails jsonb;
  loser_emails jsonb;
  winner_phones jsonb;
  loser_phones jsonb;
  email_map jsonb;
  phone_map jsonb;
BEGIN
  -- Fetch both contacts
  SELECT * INTO winner_contact FROM contacts WHERE id = winner_id;
  SELECT * INTO loser_contact FROM contacts WHERE id = loser_id;

  IF winner_contact IS NULL OR loser_contact IS NULL THEN
    RAISE EXCEPTION 'Contact not found';
  END IF;

  -- 1. Reassign tasks from loser to winner
  UPDATE tasks SET contact_id = winner_id WHERE contact_id = loser_id;

  -- 2. Reassign contact notes from loser to winner
  UPDATE contact_notes SET contact_id = winner_id WHERE contact_id = loser_id;

  -- 3. Reassign opportunities from loser to winner (single contact_id FK)
  UPDATE deals SET contact_id = winner_id WHERE contact_id = loser_id;

  -- 4. Merge contact data

  -- Get email arrays
  winner_emails := COALESCE(winner_contact.email_jsonb, '[]'::jsonb);
  loser_emails := COALESCE(loser_contact.email_jsonb, '[]'::jsonb);

  -- Merge emails with deduplication by email address
  -- Build a map of email -> email object, then convert back to array
  email_map := '{}'::jsonb;

  -- Add winner emails to map
  IF jsonb_array_length(winner_emails) > 0 THEN
    FOR i IN 0..jsonb_array_length(winner_emails)-1 LOOP
      email_map := email_map || jsonb_build_object(
        winner_emails->i->>'email',
        winner_emails->i
      );
    END LOOP;
  END IF;

  -- Add loser emails to map (won't overwrite existing keys)
  IF jsonb_array_length(loser_emails) > 0 THEN
    FOR i IN 0..jsonb_array_length(loser_emails)-1 LOOP
      IF NOT email_map ? (loser_emails->i->>'email') THEN
        email_map := email_map || jsonb_build_object(
          loser_emails->i->>'email',
          loser_emails->i
        );
      END IF;
    END LOOP;
  END IF;

  -- Convert map back to array
  merged_emails := (SELECT jsonb_agg(value) FROM jsonb_each(email_map));
  merged_emails := COALESCE(merged_emails, '[]'::jsonb);

  -- Get phone arrays
  winner_phones := COALESCE(winner_contact.phone_jsonb, '[]'::jsonb);
  loser_phones := COALESCE(loser_contact.phone_jsonb, '[]'::jsonb);

  -- Merge phones with deduplication by number
  phone_map := '{}'::jsonb;

  -- Add winner phones to map
  IF jsonb_array_length(winner_phones) > 0 THEN
    FOR i IN 0..jsonb_array_length(winner_phones)-1 LOOP
      phone_map := phone_map || jsonb_build_object(
        winner_phones->i->>'number',
        winner_phones->i
      );
    END LOOP;
  END IF;

  -- Add loser phones to map (won't overwrite existing keys)
  IF jsonb_array_length(loser_phones) > 0 THEN
    FOR i IN 0..jsonb_array_length(loser_phones)-1 LOOP
      IF NOT phone_map ? (loser_phones->i->>'number') THEN
        phone_map := phone_map || jsonb_build_object(
          loser_phones->i->>'number',
          loser_phones->i
        );
      END IF;
    END LOOP;
  END IF;

  -- Convert map back to array
  merged_phones := (SELECT jsonb_agg(value) FROM jsonb_each(phone_map));
  merged_phones := COALESCE(merged_phones, '[]'::jsonb);

  -- Merge tags (remove duplicates)
  merged_tags := ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(winner_contact.tags, ARRAY[]::bigint[]) ||
      COALESCE(loser_contact.tags, ARRAY[]::bigint[])
    )
  );

  -- 5. Update winner with merged data
  UPDATE contacts SET
    avatar = COALESCE(winner_contact.avatar, loser_contact.avatar),
    gender = COALESCE(winner_contact.gender, loser_contact.gender),
    first_name = COALESCE(winner_contact.first_name, loser_contact.first_name),
    last_name = COALESCE(winner_contact.last_name, loser_contact.last_name),
    title = COALESCE(winner_contact.title, loser_contact.title),
    company_id = COALESCE(winner_contact.company_id, loser_contact.company_id),
    email_jsonb = merged_emails,
    phone_jsonb = merged_phones,
    linkedin_url = COALESCE(winner_contact.linkedin_url, loser_contact.linkedin_url),
    background = COALESCE(winner_contact.background, loser_contact.background),
    has_newsletter = COALESCE(winner_contact.has_newsletter, loser_contact.has_newsletter),
    first_seen = LEAST(COALESCE(winner_contact.first_seen, loser_contact.first_seen), COALESCE(loser_contact.first_seen, winner_contact.first_seen)),
    last_seen = GREATEST(COALESCE(winner_contact.last_seen, loser_contact.last_seen), COALESCE(loser_contact.last_seen, winner_contact.last_seen)),
    sales_id = COALESCE(winner_contact.sales_id, loser_contact.sales_id),
    tags = merged_tags
  WHERE id = winner_id;

  -- 6. Delete loser contact
  DELETE FROM contacts WHERE id = loser_id;

  RETURN winner_id;
END;
$$;
