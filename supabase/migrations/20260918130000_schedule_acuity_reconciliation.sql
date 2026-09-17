-- ===========================================================================
-- Reconcile with Acuity on a schedule, not only on an event
-- ===========================================================================
-- The webhook is a stream, and a stream loses things: bookings made before
-- the integration existed, deliveries that failed while the function was
-- down, events Acuity dropped, reschedules that arrived out of order. None
-- of them ever arrive again, and the CRM is quietly wrong until somebody
-- notices — which is how thirty-four live bookings came to be missing, and
-- how Susan Hendriks sat in Call Booked with nothing in her calendar.
--
-- Same scheduler, same secret, same shape as sync-year-planning-calendar:
-- pg_cron calls the Edge Function over pg_net with the cron secret from
-- the vault. No second scheduler stack, and the Acuity credentials stay in
-- the one function that already holds them.
--
-- Hourly. The webhook already gives low latency for anything that reaches
-- it, so this only has to close gaps — often enough that a missed
-- cancellation cannot survive a working day, rarely enough to be a trivial
-- load (one list call plus a lookup per unconfirmed booking).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron is not installed; the reconciliation cannot be scheduled';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'pg_net is not installed; the reconciliation cannot be scheduled';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_invoke_secret'
  ) THEN
    RAISE EXCEPTION 'vault secret cron_invoke_secret is missing; refusing to schedule an unauthenticated call';
  END IF;
END $$;

SELECT cron.unschedule('reconcile-acuity')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-acuity');

SELECT cron.schedule(
  'reconcile-acuity',
  '17 * * * *',
  $job$
  select net.http_post(
    url := 'https://xlyywsguftyvomeretju.supabase.co/functions/v1/acuity_webhook?action=reconcile',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_invoke_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-acuity') THEN
    RAISE EXCEPTION 'reconcile-acuity was not scheduled';
  END IF;
  RAISE NOTICE 'acuity reconciliation scheduled hourly';
END $$;
