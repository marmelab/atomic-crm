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

-- Seeded from what the Offers already declare, so this table starts out
-- agreeing with current behaviour exactly.
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
