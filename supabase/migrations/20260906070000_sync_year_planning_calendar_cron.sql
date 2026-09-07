-- Client + Session Operations cadence correction: schedules the Year
-- Planning calendar sync via Supabase's own documented mechanism
-- (pg_cron + pg_net invoking the Edge Function's HTTP endpoint) — NOT
-- Deno.cron, which is not a durable mechanism for a hosted, request-
-- driven Edge Function isolate (see this slice's own report). Deliberately
-- a SEPARATE migration from the schema correction (20260906060000): this
-- one has a real prerequisite — the pg_cron extension enabled via the
-- Supabase Dashboard (Database -> Extensions), not via a migration, per
-- a documented CLI issue (supabase/cli#1591) where enabling it through a
-- migration can leave its grants broken on a hosted project.
--
-- The invocation secret (x-cron-secret, checked in index.ts) is read
-- from Supabase Vault BY NAME at execution time — never a literal value
-- in this file, source, or logs. The secret itself was generated and
-- stored (both as this function's own Edge Function secret and as this
-- Vault entry) via the Supabase CLI in a prior step, without ever being
-- displayed. The function's own URL below is not sensitive (the same
-- public project URL already present in this repo's own
-- .env.production.local) — Postgres has no "self-relative" URL concept,
-- so a scheduled job necessarily targets a fixed external endpoint.
select cron.schedule(
  'sync-year-planning-calendar',
  '0 */6 * * *',
  $$
  select net.http_post(
    url := 'https://xlyywsguftyvomeretju.supabase.co/functions/v1/sync_year_planning_calendar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_invoke_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
