-- ===========================================================================
-- Four clients the CRM had stopped calling clients
-- ===========================================================================
-- Denise Cormier, Ava Frotton, Linda Turner and Emma Wijns all sat at
-- Committed with no Enrollment, so none of them appeared under Clients at
-- all. Between them: Denise has ten 1:1 sessions on the calendar, Ava
-- nine, Emma nine and is already onboarded, and Linda has PAID IN FULL.
-- The CRM was disagreeing with the business about who its clients were.
--
-- The cause was a model that treated Won as a payment fact. It is not.
-- These are four independent dimensions and none of them may overwrite
-- another:
--
--   sales outcome  did they say yes           deals.stage / outcome
--   payment        agreed / paid / scheduled  schedule items, Stripe
--   enrollment     are they in the programme  enrollments
--   onboarding     is their setup done        checklist items
--
-- Won means the sale was accepted. It does not mean paid in full, does not
-- mean a Stripe subscription is active, and does not mean onboarding is
-- finished. Emma is the proof that the ordering is not a pipeline at all:
-- she is onboarded and still needs a payment plan created.
--
-- Not one of these people had their plan set up through the CRM's own
-- checkout, which is why nothing linked and why they stalled. That is a
-- CRM defect, not a fact about them.

BEGIN;

-- Onboarding checklists are NOT seeded here. What each person's setup
-- state actually is varies (Emma is done, the others are unknown), and
-- inventing a fresh list of pending items would put false work on Leif's
-- dashboard. The generic Won -> Enrollment -> onboarding path is proved by
-- its own tests rather than by using real clients as the fixture.
SELECT set_historical_migration_mode(true);

DO $$
DECLARE
  v_case record;
  v_start date;
  v_status text;
  v_enrollment_id bigint;
BEGIN
  FOR v_case IN
    SELECT * FROM (VALUES
      -- deal, enrollment status once started is decided below
      (97,  'Denise Cormier'),
      (90,  'Ava Frotton'),
      (74,  'Linda Turner'),
      (70,  'Emma Wijns')
    ) c(deal_id, who)
  LOOP
    -- Refuse to act on anything that is not the shape this migration was
    -- written for.
    IF NOT EXISTS (
      SELECT 1 FROM deals
       WHERE id = v_case.deal_id AND stage = 'committed'
         AND outcome IS NULL AND archived_at IS NULL
    ) THEN
      RAISE EXCEPTION '% (deal %) is not an active Committed Opportunity', v_case.who, v_case.deal_id;
    END IF;

    -- 1. SALES: the sale was accepted.
    UPDATE deals
       SET stage = 'won',
           stage_entered_at = now(),
           prospect_decision = 'yes',
           updated_at = now()
     WHERE id = v_case.deal_id;

    -- 2. ENROLLMENT: the client container. start_date comes from the
    --    earliest 1:1 session actually on the calendar — real dated
    --    evidence, not a guess. Nobody gets an invented date: Linda has no
    --    sessions booked yet, so hers stays null and the Clients row says
    --    "Start date not set" truthfully.
    SELECT min(cs.scheduled_at)::date INTO v_start
      FROM client_sessions cs
      JOIN deals d ON d.contact_id = cs.contact_id
     WHERE d.id = v_case.deal_id;

    -- Status reports where the container is, not where payment is.
    -- Everything here starts in the future or has not been scheduled, so
    -- none of them is running yet.
    v_status := CASE
      WHEN v_start IS NOT NULL AND v_start <= current_date THEN 'active'
      ELSE 'onboarding'
    END;

    INSERT INTO enrollments (opportunity_id, status, start_date, end_date)
    VALUES (v_case.deal_id, v_status, v_start, NULL)
    ON CONFLICT (opportunity_id) DO NOTHING
    RETURNING id INTO v_enrollment_id;

    RAISE NOTICE '% -> Won, enrollment % (status %, start %)',
      v_case.who, coalesce(v_enrollment_id::text, 'already existed'), v_status, coalesce(v_start::text, 'not set');
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. PAYMENT: recorded separately, and only where Leif has stated it.
-- ---------------------------------------------------------------------------
-- Linda Turner has paid in full for The Living Example. Recorded from the
-- Offer price snapshot on her own Opportunity, marked owner_stated the
-- same way Mel's and Sam's scholarship terms were, with paid_on left NULL
-- because the date genuinely is not known. Nothing is invented for the
-- other three: their plans exist in Stripe and have not been linked yet.
INSERT INTO deal_payment_schedule_items
  (deal_id, amount, sequence, due_date, status, paid_on, source, notes)
SELECT d.id, d.offer_price_snapshot, 1, NULL, 'paid', NULL, 'owner_stated',
       'Paid in full for The Living Example (owner-stated). Exact payment date not recorded.'
  FROM deals d
 WHERE d.id = 74
   AND d.offer_price_snapshot IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM deal_payment_schedule_items i WHERE i.deal_id = d.id);

SELECT set_historical_migration_mode(false);

-- ---------------------------------------------------------------------------
-- 4. Prove it, on every dimension separately.
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_n bigint; v_paid numeric;
BEGIN
  -- Sales.
  SELECT count(*) INTO v_n FROM deals WHERE id IN (97, 90, 74, 70) AND stage = 'won';
  IF v_n <> 4 THEN RAISE EXCEPTION 'expected 4 Won Opportunities, found %', v_n; END IF;

  -- Enrollment, exactly one each and no duplicates.
  SELECT count(*) INTO v_n FROM enrollments WHERE opportunity_id IN (97, 90, 74, 70);
  IF v_n <> 4 THEN RAISE EXCEPTION 'expected 4 Enrollments, found %', v_n; END IF;
  SELECT count(*) INTO v_n FROM (
    SELECT opportunity_id FROM enrollments GROUP BY 1 HAVING count(*) > 1) z;
  IF v_n <> 0 THEN RAISE EXCEPTION '% Opportunity(ies) have duplicate Enrollments', v_n; END IF;

  -- No invented start dates: Linda has no sessions, so no start date.
  IF (SELECT start_date FROM enrollments WHERE opportunity_id = 74) IS NOT NULL THEN
    RAISE EXCEPTION 'Linda was given a start date she has no evidence for';
  END IF;

  -- Payment recorded only for Linda, and as paid.
  SELECT count(*) INTO v_n FROM deal_payment_schedule_items WHERE deal_id IN (97, 90, 70);
  IF v_n <> 0 THEN RAISE EXCEPTION 'payment was invented for someone Leif did not state'; END IF;
  SELECT sum(amount) INTO v_paid FROM deal_payment_schedule_items
   WHERE deal_id = 74 AND status = 'paid';
  IF v_paid IS DISTINCT FROM 4000.00 THEN
    RAISE EXCEPTION 'Linda paid-in-full records % (expected the 4000 offer price)', v_paid;
  END IF;

  -- Onboarding: no false pending work created for anybody.
  SELECT count(*) INTO v_n FROM enrollment_onboarding_items oi
    JOIN enrollments e ON e.id = oi.enrollment_id
   WHERE e.opportunity_id IN (97, 90, 74, 70);
  IF v_n <> 0 THEN
    RAISE EXCEPTION '% onboarding item(s) were seeded for clients whose setup state is unknown', v_n;
  END IF;

  RAISE NOTICE 'four clients restored: Won, enrolled, payment recorded only where stated';
END $$;

COMMIT;
