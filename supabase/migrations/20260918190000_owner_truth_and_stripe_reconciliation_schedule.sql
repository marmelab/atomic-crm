-- ===========================================================================
-- Owner-stated truth, and Stripe reconciliation on a schedule
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Linda Turner starts on 8 November.
-- ---------------------------------------------------------------------------
-- Her Enrollment had no start date because the CRM derived it from the
-- earliest 1:1 session on the calendar and she has none booked yet. That
-- made her Current, which is wrong twice: she has not started, and an
-- absent calendar entry is not evidence about when a container begins.
--
-- Leif has stated the date. An owner-confirmed container start outranks
-- the absence of a session, so the date is recorded rather than derived.
UPDATE enrollments
   SET start_date = DATE '2026-11-08'
  FROM deals d, contacts c
 WHERE enrollments.opportunity_id = d.id
   AND c.id = d.contact_id
   AND c.last_name = 'Turner'
   AND c.first_name = 'Linda'
   AND enrollments.start_date IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Emma Wijns is onboarded.
-- ---------------------------------------------------------------------------
-- Leif has confirmed her setup is complete; what is still outstanding is
-- her payment plan, which is a different dimension entirely. Her
-- Enrollment sat at 'onboarding', which said the opposite.
--
-- The smallest truthful representation available in this schema is the
-- status itself — no checklist timestamps are fabricated, because no
-- checklist was ever seeded for her and inventing per-item completion
-- times would be writing history nobody lived.
UPDATE enrollments
   SET status = 'active'
  FROM deals d, contacts c
 WHERE enrollments.opportunity_id = d.id
   AND c.id = d.contact_id
   AND c.last_name = 'Wijns'
   AND enrollments.status = 'onboarding';

-- ---------------------------------------------------------------------------
-- 3. Stripe reconciliation, hourly.
-- ---------------------------------------------------------------------------
-- The Stripe webhook subscribes to exactly one event
-- (checkout.session.completed), so it only ever learns about plans the CRM
-- created itself. Eighteen people had plans built by hand in Stripe that
-- the CRM knew nothing about — Denise Cormier and Ava Frotton among them.
--
-- Same scheduler, same secret, same shape as the Acuity reconciliation and
-- the calendar sync: pg_cron calls the Edge Function that already holds
-- the Stripe key. Offset from the others so the three never contend.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron is not installed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_invoke_secret'
  ) THEN
    RAISE EXCEPTION 'vault secret cron_invoke_secret is missing; refusing to schedule an unauthenticated call';
  END IF;
END $$;

SELECT cron.unschedule('reconcile-stripe')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-stripe');

SELECT cron.schedule(
  'reconcile-stripe',
  '47 * * * *',
  $job$
  select net.http_post(
    url := 'https://xlyywsguftyvomeretju.supabase.co/functions/v1/stripe_webhook?action=reconcile',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_invoke_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );
  $job$
);

-- ---------------------------------------------------------------------------
-- 4. Prove it.
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_start date; v_status text;
BEGIN
  SELECT e.start_date INTO v_start
    FROM enrollments e JOIN deals d ON d.id = e.opportunity_id
    JOIN contacts c ON c.id = d.contact_id
   WHERE c.first_name = 'Linda' AND c.last_name = 'Turner';
  IF v_start IS DISTINCT FROM DATE '2026-11-08' THEN
    RAISE EXCEPTION 'Linda starts % (expected 2026-11-08)', v_start;
  END IF;
  IF v_start <= current_date THEN
    RAISE EXCEPTION 'Linda would still classify as Current';
  END IF;

  SELECT e.status INTO v_status
    FROM enrollments e JOIN deals d ON d.id = e.opportunity_id
    JOIN contacts c ON c.id = d.contact_id
   WHERE c.last_name = 'Wijns';
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Emma is % (expected active — onboarding complete)', v_status;
  END IF;

  -- Her paid-in-full must have survived everything above.
  IF NOT EXISTS (
    SELECT 1 FROM deal_payment_schedule_items i
      JOIN deals d ON d.id = i.deal_id JOIN contacts c ON c.id = d.contact_id
     WHERE c.last_name = 'Turner' AND i.status = 'paid'
  ) THEN
    RAISE EXCEPTION 'Linda lost her owner-stated paid-in-full record';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-stripe') THEN
    RAISE EXCEPTION 'reconcile-stripe was not scheduled';
  END IF;

  RAISE NOTICE 'Linda starts 2026-11-08 (Upcoming), Emma onboarded, Stripe reconciliation hourly';
END $$;
