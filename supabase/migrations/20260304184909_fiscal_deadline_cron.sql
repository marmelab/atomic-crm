-- Enable pg_cron and pg_net for scheduled Edge Function invocation.
-- Secrets (project_url, service_role_key) must be stored in Vault.
-- See supabase/seed.sql for local setup; for remote run:
--   select vault.create_secret('<project-url>', 'project_url');
--   select vault.create_secret('<service-role-key>', 'service_role_key');

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Schedule fiscal_deadline_check to run daily at 07:00 UTC (08:00 CET / 09:00 CEST)
select cron.schedule(
  'fiscal-deadline-check-daily',
  '0 7 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/fiscal_deadline_check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
