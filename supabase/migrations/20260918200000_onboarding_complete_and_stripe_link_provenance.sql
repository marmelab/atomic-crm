-- ===========================================================================
-- Onboarding is its own dimension, and Stripe links say where they came from
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. What enrollment.status actually means, established before changing it.
-- ---------------------------------------------------------------------------
-- The domain is explicit and documented, so this is not a guess:
--
--   activateEnrollment() is "the explicit human Activate action", and
--   enforce_enrollment_activation_requirements() REFUSES the move from
--   'onboarding' to 'active' while any required onboarding item is not
--   'done'.
--
-- So 'onboarding' means onboarding is still incomplete, and 'active' is
-- the canonical post-onboarding state. There is no separate
-- onboarding-complete flag; the status IS the representation.
--
-- Leif has confirmed Denise Cormier, Ava Frotton and Linda Turner are all
-- fully onboarded. They sat at 'onboarding', which said the opposite and
-- would have shown "complete onboarding" as outstanding work that is
-- already done. Emma Wijns is already 'active' and is left alone.
--
-- No checklist timestamps are fabricated. None of these four ever had a
-- checklist seeded, and inventing per-item completion times would be
-- writing history nobody lived — the status carries the owner-confirmed
-- fact, and the absence of items honestly reflects that no checklist was
-- ever tracked for them.
--
-- The activation guard passes vacuously here (zero required items), which
-- is checked rather than assumed.
DO $$
DECLARE
  v_blocked bigint;
  v_moved bigint;
BEGIN
  SELECT count(*) INTO v_blocked
    FROM enrollments e
    JOIN deals d ON d.id = e.opportunity_id
    JOIN contacts c ON c.id = d.contact_id
   WHERE c.last_name IN ('Cormier', 'Frotton', 'Turner')
     AND c.id <> 344
     AND EXISTS (
       SELECT 1 FROM enrollment_onboarding_items oi
        WHERE oi.enrollment_id = e.id AND oi.is_required AND oi.status <> 'done');
  IF v_blocked > 0 THEN
    RAISE EXCEPTION '% enrollment(s) have incomplete required onboarding items — refusing to mark them onboarded', v_blocked;
  END IF;

  UPDATE enrollments e
     SET status = 'active'
    FROM deals d, contacts c
   WHERE e.opportunity_id = d.id
     AND c.id = d.contact_id
     AND c.last_name IN ('Cormier', 'Frotton', 'Turner')
     AND c.id <> 344
     AND e.status = 'onboarding';
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  RAISE NOTICE 'owner-confirmed onboarding complete for % enrollment(s)', v_moved;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Where a Stripe link came from.
-- ---------------------------------------------------------------------------
-- Eighteen payment plans were linked by reconciliation rather than by the
-- CRM's own checkout, and six months from now "why is this subscription on
-- this Opportunity?" needs an answer that is not archaeology. Two columns,
-- not an audit subsystem: when, and on what basis.



-- Backfill what reconciliation just linked. Everything currently carrying a
-- Stripe id and no checkout session was found by reconciliation, because
-- the CRM checkout always records a session id.
UPDATE deals
   SET stripe_link_source = CASE
         WHEN stripe_checkout_session_id IS NOT NULL THEN 'crm_checkout'
         ELSE 'reconciliation_customer_id'
       END,
       stripe_linked_at = coalesce(stripe_linked_at, now())
 WHERE (stripe_subscription_id IS NOT NULL OR stripe_subscription_schedule_id IS NOT NULL)
   AND stripe_link_source IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Prove it.
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_n bigint;
BEGIN
  -- The four are all onboarded.
  SELECT count(*) INTO v_n
    FROM enrollments e JOIN deals d ON d.id = e.opportunity_id
    JOIN contacts c ON c.id = d.contact_id
   WHERE c.last_name IN ('Cormier', 'Frotton', 'Turner', 'Wijns')
     AND c.id <> 344 AND e.status = 'active';
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'expected 4 onboarded enrollments, found %', v_n;
  END IF;

  -- And all four are still Upcoming — onboarding did not move the phase.
  SELECT count(*) INTO v_n
    FROM enrollments e JOIN deals d ON d.id = e.opportunity_id
    JOIN contacts c ON c.id = d.contact_id
   WHERE c.last_name IN ('Cormier', 'Frotton', 'Turner', 'Wijns')
     AND c.id <> 344 AND e.start_date > current_date;
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'expected 4 Upcoming enrollments, found %', v_n;
  END IF;

  -- Emma's payment is still outstanding: onboarding did not imply payment.
  IF EXISTS (
    SELECT 1 FROM deals d JOIN contacts c ON c.id = d.contact_id
     WHERE c.last_name = 'Wijns'
       AND (d.stripe_subscription_id IS NOT NULL
         OR d.stripe_subscription_schedule_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Emma gained a Stripe plan she does not have';
  END IF;

  -- Linda's paid-in-full survived.
  IF NOT EXISTS (
    SELECT 1 FROM deal_payment_schedule_items i
      JOIN deals d ON d.id = i.deal_id JOIN contacts c ON c.id = d.contact_id
     WHERE c.last_name = 'Turner' AND i.status = 'paid'
  ) THEN
    RAISE EXCEPTION 'Linda lost her paid-in-full record';
  END IF;

  -- Every Stripe link says where it came from.
  SELECT count(*) INTO v_n FROM deals
   WHERE (stripe_subscription_id IS NOT NULL OR stripe_subscription_schedule_id IS NOT NULL)
     AND stripe_link_source IS NULL;
  IF v_n <> 0 THEN
    RAISE EXCEPTION '% Stripe link(s) have no recorded provenance', v_n;
  END IF;

  RAISE NOTICE 'four onboarded and still Upcoming; every Stripe link carries provenance';
END $$;
