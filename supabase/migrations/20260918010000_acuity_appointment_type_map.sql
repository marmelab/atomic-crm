-- ===========================================================================
-- One Offer, several Acuity appointment types
-- ===========================================================================
-- offers.acuity_appointment_type_id holds exactly ONE sales-call type, which
-- was true until it wasn't: The Living Example is booked through the current
-- "Mini Deep Dive" (91345095) AND through "chat" (78497441), a historical
-- type Leif later deleted in Acuity but which still has real bookings
-- against it. With one column per Offer the second type resolves to nothing,
-- and the webhook silently ignores every booking made through it — three
-- upcoming ones today, plus whatever history exists.
--
-- So the mapping moves into its own table, where an Offer may claim as many
-- appointment types as it really has, and each one says what KIND of
-- appointment it is. That distinction is the other half of the problem:
-- 90522599 ("Zoom 1:1") is an LE CLIENT SESSION, not a sales call, and
-- somebody who reaches that calendar by accident must never become a sales
-- Opportunity because of it.
--
-- The existing offers columns stay exactly as they are and keep working —
-- this table is seeded from them and read first, so nothing that depends on
-- them changes behaviour.
CREATE TABLE IF NOT EXISTS "public"."acuity_appointment_type_map" (
    -- Acuity's own stable numeric id, as text. The primary key IS the
    -- appointment type: one type can only ever mean one thing.
    "acuity_appointment_type_id" text PRIMARY KEY,
    "offer_id" bigint NOT NULL,
    -- 'sales_call'     — booking it is entering the sales pipeline
    -- 'client_session' — booking it is an existing client's session, and is
    --                    NEVER evidence of a sales Opportunity
    "kind" text NOT NULL,
    -- Set only when a specific Cohort has its own appointment type. Null
    -- means the type serves the Offer as a whole.
    "cohort_id" bigint,
    -- False for a type Acuity no longer offers. Its existing bookings stay
    -- authoritative; it simply cannot receive new ones.
    "is_current" boolean NOT NULL DEFAULT true,
    "label" text,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "acuity_appointment_type_map_kind_check"
      CHECK (kind IN ('sales_call', 'client_session'))
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'acuity_appointment_type_map_offer_id_fkey') THEN
    ALTER TABLE "public"."acuity_appointment_type_map"
      ADD CONSTRAINT "acuity_appointment_type_map_offer_id_fkey"
      FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'acuity_appointment_type_map_cohort_id_fkey') THEN
    ALTER TABLE "public"."acuity_appointment_type_map"
      ADD CONSTRAINT "acuity_appointment_type_map_cohort_id_fkey"
      FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "acuity_appointment_type_map_offer_id_idx"
  ON "public"."acuity_appointment_type_map" USING btree ("offer_id", "kind");

-- The canonical appointment-type configuration, stated outright.
--
-- REPRODUCIBILITY REPAIR (2026-09-18). This block used to seed the table
-- by SELECTing offers.acuity_appointment_type_id — "from what the Offers
-- already declare". On MAIN those columns hold real Acuity ids and the
-- seed produced the right rows. Nothing in the migration chain ever SETS
-- them: they were configured out of band, so on a database rebuilt from
-- this repository they are null and the seed produced almost nothing. A
-- later migration then asserted configuration that only existed because
-- production data happened to exist, and a clean replay stopped there.
--
-- Which Acuity appointment type means which Offer is integration
-- configuration, not business data. It belongs in the repository, so the
-- rows below are stated rather than derived. Offers are matched by NAME
-- because names are what the migration chain itself creates
-- (20260830130000, 20260917190000); ids are assigned by a sequence and
-- are not stable across environments.
--
-- Fail-closed: a missing Offer raises rather than writing a mapping with
-- no business target.
DO $$
DECLARE
  v_le  bigint;
  v_gyu bigint;
BEGIN
  SELECT id INTO v_le  FROM "public"."offers" WHERE name = 'The Living Example';
  SELECT id INTO v_gyu FROM "public"."offers" WHERE name = 'Growing Yourself Up';
  IF v_le IS NULL OR v_gyu IS NULL THEN
    RAISE EXCEPTION 'expected Offers are missing: le=% gyu=%', v_le, v_gyu;
  END IF;

  INSERT INTO "public"."acuity_appointment_type_map"
    ("acuity_appointment_type_id", "offer_id", "kind", "label")
  VALUES
    -- Mini Deep Dive, booked at leifariel.as.me/chat2.
    ('91345095', v_le,  'sales_call',     'The Living Example sales call'),
    -- Zoom 1:1, the paid client session type.
    ('90522599', v_le,  'client_session', 'The Living Example client session'),
    -- Named "Growing Yourself Up" in Acuity today. Its meaning is
    -- effective-dated by 20260918050000 and 20260918110000: it did not
    -- mean GYU before GYU existed.
    ('64654501', v_gyu, 'sales_call',     'Growing Yourself Up sales call')
  ON CONFLICT ("acuity_appointment_type_id") DO NOTHING;
END $$;

-- Anything else an Offer declares still maps, so configuring a new type on
-- an Offer keeps working. It runs AFTER the canonical rows above and
-- conflicts away against them rather than competing with them.
INSERT INTO "public"."acuity_appointment_type_map"
  ("acuity_appointment_type_id", "offer_id", "kind", "label")
SELECT o.acuity_appointment_type_id, o.id, 'sales_call', o.name || ' sales call'
  FROM "public"."offers" o
 WHERE o.acuity_appointment_type_id IS NOT NULL
ON CONFLICT ("acuity_appointment_type_id") DO NOTHING;

INSERT INTO "public"."acuity_appointment_type_map"
  ("acuity_appointment_type_id", "offer_id", "kind", "label")
SELECT o.client_session_acuity_appointment_type_id, o.id, 'client_session', o.name || ' client session'
  FROM "public"."offers" o
 WHERE o.client_session_acuity_appointment_type_id IS NOT NULL
ON CONFLICT ("acuity_appointment_type_id") DO NOTHING;

INSERT INTO "public"."acuity_appointment_type_map"
  ("acuity_appointment_type_id", "offer_id", "kind", "cohort_id", "label")
SELECT c.acuity_appointment_type_id, c.offer_id, 'sales_call', c.id, c.name || ' sales call'
  FROM "public"."cohorts" c
 WHERE c.acuity_appointment_type_id IS NOT NULL
ON CONFLICT ("acuity_appointment_type_id") DO NOTHING;

-- The type this table exists for: "chat", deleted in Acuity, still carrying
-- real Living Example sales-call bookings.
INSERT INTO "public"."acuity_appointment_type_map"
  ("acuity_appointment_type_id", "offer_id", "kind", "is_current", "label")
SELECT '78497441', o.id, 'sales_call', false, 'chat (historical LE sales call)'
  FROM "public"."offers" o
 WHERE o.name = 'The Living Example'
ON CONFLICT ("acuity_appointment_type_id") DO NOTHING;

ALTER TABLE "public"."acuity_appointment_type_map" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'acuity_appointment_type_map' AND policyname = 'Enable read access for authenticated users') THEN
    CREATE POLICY "Enable read access for authenticated users" ON "public"."acuity_appointment_type_map" FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Enable insert for authenticated users only" ON "public"."acuity_appointment_type_map" FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "Enable update for authenticated users only" ON "public"."acuity_appointment_type_map" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE "public"."acuity_appointment_type_map" TO authenticated;
GRANT ALL ON TABLE "public"."acuity_appointment_type_map" TO service_role;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."acuity_appointment_type_map" FROM anon;
