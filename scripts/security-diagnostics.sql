-- Supabase security diagnostics
-- Paste these snippets into the Supabase SQL Editor (one project at a time)
-- to confirm RLS hygiene before and after applying
-- migrations/20260408120000_enforce_rls_security.sql.
--
-- Purpose: detect schema drift between this repo and the production
-- databases (project refs `kmtoziejeblhdggjghrx` and `vrnjdsxdkqmdfdcydlas`).

-- 1. Tables with RLS DISABLED in the public schema.
--    Should return zero rows after the enforcement migration runs.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and rowsecurity = false
order by tablename;

-- 2. Tables with RLS enabled but NO policies at all.
--    Such tables are deny-all for authenticated/anon (only service_role
--    can reach them). After our migration, the `deny_anon_all` restrictive
--    policy is added everywhere, so this query reflects the policies that
--    actually grant access.
select c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = c.relname
      and p.permissive = 'PERMISSIVE'  -- ignore the deny-all restrictive net
  )
order by c.relname;

-- 3. Tables NOT declared in supabase/schemas/01_tables.sql
--    (= drift introduced via Supabase Studio / external scripts).
--    Compare this list against the canonical 12 tables of Atomic CRM.
with declared(name) as (
  values
    ('companies'),
    ('contacts'),
    ('contact_notes'),
    ('deals'),
    ('deal_notes'),
    ('sales'),
    ('tags'),
    ('tasks'),
    ('configuration'),
    ('favicons_excluded_domains'),
    ('google_oauth_tokens'),
    ('connector_preferences')
)
select c.relname as drifted_table
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname not in (select name from declared)
order by c.relname;

-- 4. Privileges granted to the anon role on public relations.
--    Should be empty after the enforcement migration.
select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'anon'
order by table_name, privilege_type;

-- 5. Privileges granted to the anon role on public functions.
--    Should be empty after the enforcement migration.
select n.nspname as schema,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and has_function_privilege('anon', p.oid, 'EXECUTE');

-- 6. Storage buckets that are publicly readable without auth.
--    Anything returned here is reachable through
--    /storage/v1/object/public/<bucket>/<path> by anyone with the URL.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where public = true;

-- 7. Activity on the drifted tables, to figure out which app writes to them.
--    Run after some real traffic to see seq_scan / n_tup_ins counts.
select relname,
       n_tup_ins as inserts,
       n_tup_upd as updates,
       n_tup_del as deletes,
       n_live_tup as live_rows,
       seq_scan,
       idx_scan
from pg_stat_user_tables
where schemaname = 'public'
  and relname in (
    'business_card_leads',
    'crm_notifications',
    'People',
    'People_backup',
    'Notes'
  )
order by relname;

-- 8. Foreign keys to or from the drifted tables — gives hints about how
--    they integrate with the rest of the schema.
select conrelid::regclass as table_name,
       conname            as constraint_name,
       pg_get_constraintdef(c.oid) as definition
from pg_constraint c
where contype = 'f'
  and (
    conrelid::regclass::text in (
      'public."People"',
      'public."People_backup"',
      'public."Notes"',
      'public.business_card_leads',
      'public.crm_notifications'
    )
    or confrelid::regclass::text in (
      'public."People"',
      'public."People_backup"',
      'public."Notes"',
      'public.business_card_leads',
      'public.crm_notifications'
    )
  );
