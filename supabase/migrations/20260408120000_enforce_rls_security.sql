-- Enforce Row Level Security on every table in the public schema and revoke
-- the blanket privileges currently granted to the anon role.
--
-- Background: the Supabase Advisor flagged `rls_disabled_in_public` on tables
-- that were created out-of-band (via the SQL Editor) and never enforced RLS:
--   * business_card_leads  -> no RLS, no policies
--   * crm_notifications    -> no RLS, no policies
--   * "People_backup"      -> no RLS, no policies (PII backup, very sensitive)
--   * "People"             -> RLS enabled but no policies (defaults to deny-all)
--   * "Notes"              -> RLS enabled but no policies (defaults to deny-all)
--
-- Combined with the `grant all on table public.* to anon` declared in
-- supabase/schemas/06_grants.sql, any table without RLS becomes fully readable
-- and writable through the public anon key.
--
-- This migration is intentionally idempotent and defensive: it does NOT
-- assume which tables exist, so it also covers any future drift.
--
-- IMPORTANT: enabling RLS on a table that has no policies denies access to
-- the `authenticated` and `anon` roles. The `service_role` always bypasses
-- RLS, so backend integrations using the service role key keep working.
-- If a Make.com / n8n / external flow currently reads or writes one of the
-- drifted tables with the anon key, that flow MUST be migrated to the
-- service role key (or be granted an explicit policy) before this migration
-- ships to production.

-- 1. Enable (and force) RLS on every base table in public.
do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security;', r.relname);
    execute format('alter table public.%I force row level security;', r.relname);
  end loop;
end $$;

-- 2. Revoke the blanket privileges granted to anon on every public relation.
--    The application uses the `authenticated` role exclusively from the browser
--    and `service_role` from edge functions; anon should never touch tables.
do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'v', 'm', 'p')
  loop
    execute format('revoke all on table public.%I from anon;', r.relname);
  end loop;
end $$;

-- Sequences: also drop the implicit anon access (we never use auto-id from anon).
do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'S'
  loop
    execute format('revoke all on sequence public.%I from anon;', r.relname);
  end loop;
end $$;

-- Functions: drop EXECUTE from anon on every public function. Trigger
-- functions only need to be callable by the role doing the DML, so revoking
-- from anon is safe.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure::text as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from anon;', r.sig);
  end loop;
end $$;

-- 3. Stop auto-granting future tables / sequences / functions to anon.
alter default privileges for role postgres in schema public revoke all on tables    from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;

-- 4. Belt-and-braces deny policy: even if someone re-grants anon by mistake,
--    a RESTRICTIVE policy ensures the anon role still cannot read or write.
do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
  loop
    execute format('drop policy if exists "deny_anon_all" on public.%I;', r.relname);
    execute format(
      'create policy "deny_anon_all" on public.%I as restrictive for all to anon using (false) with check (false);',
      r.relname
    );
  end loop;
end $$;
