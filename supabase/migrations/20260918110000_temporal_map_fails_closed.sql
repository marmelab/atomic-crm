-- ===========================================================================
-- The appointment-type map must be able to say "I don't know"
-- ===========================================================================
-- The previous migration split Acuity type 64654501 at 2026-01-01: legacy
-- 1:1 before, Growing Yourself Up after. That date was not business truth.
-- It was picked because it sat tidily between the last unmatched 2025
-- booking and the first 2026 one, and a tidy date is not evidence.
--
-- The audit that should have come first says the boundary cannot be dated
-- at all from what we hold:
--
--   * The type is mixed in EVERY year. 2024: one legacy, one GYU, one LE.
--     2025: one legacy, eight GYU, two LE. 2026: twenty-six GYU and six
--     LE — including 2026-09-11, days ago.
--
--   * Those Offer labels are not evidence of what the TYPE meant, because
--     the historical import attached a call to the person's Opportunity,
--     not to an Opportunity matching the booking. Libby Sloan-O'Brien's
--     2025-08-09 booking on this type is attached to a Living Example
--     Opportunity created 2026-08-04 — a year after the call, and her only
--     one. Kerri Fukui's two bookings likewise.
--
--   * Acuity itself keeps no rename or creation history. The type is
--     called "Growing Yourself Up" today and books at /grow; what it was
--     called in 2024 is not recoverable from the API.
--
-- What IS evidence: the first Growing Yourself Up Application is
-- 2026-07-26, the first GYU enrolment 2026-08-05, and the only GYU cohorts
-- that exist are Fall 2026 and January 2027. GYU as a program with
-- applications and cohorts demonstrably begins in mid-2026. Before that,
-- Leif's ruling stands on its own authority: 2024-2025 use of this type
-- was his earlier 1:1 coaching.
--
-- Between those two — the start of 2026 up to the first GYU Application —
-- nothing establishes what booking this type meant. So the map now says
-- exactly that, and the resolver returns nothing rather than a guess.

-- ---------------------------------------------------------------------------
-- 1. A period may be explicitly UNKNOWN.
-- ---------------------------------------------------------------------------
-- Distinct from "no row at all", which is a gap. Both fail closed for a
-- caller, but an unknown period is a deliberate, documented statement that
-- this interval was examined and could not be determined — so it shows up
-- in the map as a fact rather than looking like an oversight.
ALTER TABLE "public"."acuity_appointment_type_map"
  ALTER COLUMN "offer_id" DROP NOT NULL;

ALTER TABLE "public"."acuity_appointment_type_map"
  ADD COLUMN IF NOT EXISTS "resolution" text NOT NULL DEFAULT 'mapped';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'acuity_appointment_type_map_resolution_check') THEN
    ALTER TABLE "public"."acuity_appointment_type_map"
      ADD CONSTRAINT "acuity_appointment_type_map_resolution_check"
      CHECK (resolution IN ('mapped', 'unknown'));
  END IF;
  -- An unknown period names no Offer, and a mapped one must.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'acuity_appointment_type_map_resolution_shape_check') THEN
    ALTER TABLE "public"."acuity_appointment_type_map"
      ADD CONSTRAINT "acuity_appointment_type_map_resolution_shape_check"
      CHECK (
        (resolution = 'mapped'  AND offer_id IS NOT NULL) OR
        (resolution = 'unknown' AND offer_id IS NULL)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. The resolver reports what it knows, including that it does not know.
-- ---------------------------------------------------------------------------
-- Returns at most one row. A caller must treat anything other than
-- resolution = 'mapped' as "do not classify this booking":
--
--   no row            the type/date falls in a GAP — nothing claims it
--   resolution unknown the interval was examined and is undetermined
--   resolution mapped  the meaning is established
DROP FUNCTION IF EXISTS "public"."resolve_acuity_appointment_type"(text, date);

CREATE OR REPLACE FUNCTION "public"."resolve_acuity_appointment_type"(
  "p_appointment_type_id" text,
  "p_on" date
) RETURNS TABLE (
  "offer_id" bigint,
  "offer_name" text,
  "kind" text,
  "cohort_id" bigint,
  "label" text,
  "resolution" text,
  "valid_from" date,
  "valid_to" date
)
    LANGUAGE "sql"
    STABLE
    SET "search_path" TO 'public'
    AS $$
  select m.offer_id, o.name, m.kind, m.cohort_id, m.label, m.resolution,
         m.valid_from, m.valid_to
    from acuity_appointment_type_map m
    left join offers o on o.id = m.offer_id
   where m.acuity_appointment_type_id = p_appointment_type_id
     and p_on >= m.valid_from
     and (m.valid_to is null or p_on < m.valid_to)
   limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 3. Re-state 64654501 from the audit.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_legacy bigint;
  v_gyu    bigint;
  v_first_gyu_application date;
BEGIN
  SELECT id INTO v_legacy FROM offers WHERE name = '1:1 Coaching (Legacy)';
  SELECT id INTO v_gyu    FROM offers WHERE name = 'Growing Yourself Up';

  -- Read from the data rather than typed in, so the boundary is the
  -- evidence itself and cannot drift away from it.
  SELECT min(a.submitted_at)::date INTO v_first_gyu_application
    FROM applications a JOIN offers o ON o.id = a.offer_id
   WHERE o.name = 'Growing Yourself Up';

  IF v_first_gyu_application IS NULL THEN
    RAISE EXCEPTION 'no Growing Yourself Up Application exists to date the current era from';
  END IF;

  DELETE FROM acuity_appointment_type_map WHERE acuity_appointment_type_id = '64654501';

  -- A. Leif's ruling, on his own authority: 2024-2025 bookings on this
  --    type were his earlier 1:1 coaching, not GYU.
  INSERT INTO acuity_appointment_type_map
    (acuity_appointment_type_id, offer_id, kind, is_current, resolution, label, valid_from, valid_to)
  VALUES ('64654501', v_legacy, 'sales_call', false, 'mapped',
          'pre-GYU 1:1 coaching sales call (Leif''s ruling for 2024-2025)',
          DATE '-infinity', DATE '2026-01-01');

  -- B. Undetermined. Leif's ruling covers 2024-2025 and "the current era";
  --    this interval is neither. The two bookings that fall in it
  --    (2026-03-05, 2026-04-16) are both attached to Living Example
  --    Opportunities, which is suggestive but is attachment-by-person, not
  --    evidence about the type. Nothing is resolved here on purpose.
  INSERT INTO acuity_appointment_type_map
    (acuity_appointment_type_id, offer_id, kind, is_current, resolution, label, valid_from, valid_to)
  VALUES ('64654501', NULL, 'sales_call', false, 'unknown',
          'undetermined: after Leif''s stated 2024-2025 legacy era, before the first GYU Application',
          DATE '2026-01-01', v_first_gyu_application);

  -- C. The current era, dated by the first time anyone applied to Growing
  --    Yourself Up. The only GYU cohorts that exist (Fall 2026, January
  --    2027) and the first GYU enrolment (2026-08-05) both sit after it.
  INSERT INTO acuity_appointment_type_map
    (acuity_appointment_type_id, offer_id, kind, is_current, resolution, label, valid_from, valid_to)
  VALUES ('64654501', v_gyu, 'sales_call', true, 'mapped',
          'Growing Yourself Up sales call (from the first GYU Application)',
          v_first_gyu_application, NULL);

  RAISE NOTICE '64654501: legacy until 2026-01-01, undetermined until %, GYU thereafter', v_first_gyu_application;
END $$;

-- ---------------------------------------------------------------------------
-- 4. "chat" is a 1:1 sales call, for its whole life.
-- ---------------------------------------------------------------------------
-- Leif has ruled that 78497441 was a 1:1 SALES CALL type — not a generic
-- interaction, not a client session, never GYU. The previous migration
-- split it at the same invented 2026-01-01, which was unnecessary as well
-- as unfounded: every "chat" booking that exists (earliest 2025-05-21)
-- postdates the earliest Living Example Opportunity (2024-10-25), so none
-- of them predate Living Example and none need the legacy representation.
--
-- Acuity corroborates the lineage: the current Living Example sales call
-- ("Mini Deep Dive", 91345095) books at leifariel.as.me/chat2 — the
-- successor link to this type's own /chat.
--
-- One period, one meaning, no boundary to get wrong.
DO $$
DECLARE
  v_le bigint;
  v_earliest_chat date;
  v_earliest_le_deal date;
BEGIN
  SELECT id INTO v_le FROM offers WHERE name = 'The Living Example';

  SELECT min(sc.scheduled_on) INTO v_earliest_chat
    FROM sales_calls sc WHERE sc.acuity_appointment_type_id = '78497441';
  SELECT min(d.created_at)::date INTO v_earliest_le_deal
    FROM deals d JOIN offers o ON o.id = d.offer_id WHERE o.name = 'The Living Example';

  -- The claim this collapse rests on, asserted rather than assumed. A
  -- database holding no chat bookings at all (a fresh or disposable one)
  -- has nothing that could predate Living Example, so the mapping is
  -- installed without the comparison.
  IF v_earliest_chat IS NOT NULL AND v_earliest_le_deal IS NOT NULL
     AND v_earliest_chat < v_earliest_le_deal THEN
    RAISE EXCEPTION 'a chat booking (%) predates the earliest Living Example Opportunity (%) — the single-period collapse is not safe',
      v_earliest_chat, v_earliest_le_deal;
  END IF;

  DELETE FROM acuity_appointment_type_map WHERE acuity_appointment_type_id = '78497441';

  INSERT INTO acuity_appointment_type_map
    (acuity_appointment_type_id, offer_id, kind, is_current, resolution, label, valid_from, valid_to)
  VALUES ('78497441', v_le, 'sales_call', false, 'mapped',
          'chat — Living Example 1:1 sales call (retired; succeeded by Mini Deep Dive /chat2)',
          DATE '-infinity', NULL);

  RAISE NOTICE 'chat: single Living Example 1:1 sales-call period (earliest chat %, earliest LE Opportunity %)',
    v_earliest_chat, v_earliest_le_deal;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Prove the resolver's behaviour, including where it must say nothing.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_name text;
  v_res  text;
  v_rows bigint;
BEGIN
  -- 2024-2025 on the GYU type is never GYU.
  FOR v_name IN
    SELECT (SELECT offer_name FROM resolve_acuity_appointment_type('64654501', d.day))
      FROM (VALUES (DATE '2024-11-30'), (DATE '2025-07-24'), (DATE '2025-12-31')) d(day)
  LOOP
    IF v_name IS DISTINCT FROM '1:1 Coaching (Legacy)' THEN
      RAISE EXCEPTION '2024-2025 booking on 64654501 resolved to %', v_name;
    END IF;
  END LOOP;

  -- The undetermined interval fails closed.
  SELECT resolution, offer_name INTO v_res, v_name
    FROM resolve_acuity_appointment_type('64654501', DATE '2026-03-05');
  IF v_res IS DISTINCT FROM 'unknown' OR v_name IS NOT NULL THEN
    RAISE EXCEPTION 'the undetermined 64654501 interval resolved to %/%', v_res, v_name;
  END IF;

  -- The current era resolves to GYU.
  SELECT resolution, offer_name INTO v_res, v_name
    FROM resolve_acuity_appointment_type('64654501', DATE '2026-10-16');
  IF v_res IS DISTINCT FROM 'mapped' OR v_name IS DISTINCT FROM 'Growing Yourself Up' THEN
    RAISE EXCEPTION 'current 64654501 resolved to %/%', v_res, v_name;
  END IF;

  -- chat is Living Example in every era it has bookings in, and never GYU.
  FOR v_name IN
    SELECT (SELECT offer_name FROM resolve_acuity_appointment_type('78497441', d.day))
      FROM (VALUES (DATE '2025-05-21'), (DATE '2026-09-15'), (DATE '2026-10-15')) d(day)
  LOOP
    IF v_name IS DISTINCT FROM 'The Living Example' THEN
      RAISE EXCEPTION 'chat resolved to % (expected The Living Example)', v_name;
    END IF;
  END LOOP;

  -- An unmapped type yields no row at all — a gap, which also fails closed.
  SELECT count(*) INTO v_rows FROM resolve_acuity_appointment_type('99999999', DATE '2026-01-01');
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'an unmapped appointment type returned % row(s)', v_rows;
  END IF;

  -- Still at most one match for any (type, date).
  IF EXISTS (
    SELECT 1 FROM acuity_appointment_type_map m
      CROSS JOIN (VALUES (DATE '2024-06-01'), (DATE '2025-07-24'), (DATE '2026-01-01'),
                         (DATE '2026-03-05'), (DATE '2026-07-26'), (DATE '2026-10-16'),
                         (DATE '2027-06-01')) d(day)
     WHERE d.day >= m.valid_from AND (m.valid_to IS NULL OR d.day < m.valid_to)
     GROUP BY m.acuity_appointment_type_id, d.day
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'more than one mapping matches some (type, date)';
  END IF;

  RAISE NOTICE 'temporal resolution verified, including the undetermined interval';
END $$;
