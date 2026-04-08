-- Supabase security drift detection.
--
-- Run this against a production Supabase project. Each row returned is a
-- drift finding and MUST be investigated. The CI wrapper
-- (scripts/drift-check.sh) exits non-zero when this query returns any row.
--
-- Covered invariants:
--   1. Every table in public must have Row Level Security enabled.
--   2. Every table in public must be declared in supabase/schemas/01_tables.sql
--      (drift caught when tables are created via the SQL Editor or external
--      scripts — e.g. business_card_leads, crm_notifications, "People_backup").
--   3. The anon role must not hold any privilege on public relations
--      (enforced runtime by migrations/20260408120000_enforce_rls_security.sql,
--      re-checked here in case someone GRANTs it back manually).
--   4. The anon role must not hold EXECUTE on any public function.
--   5. The `attachments` storage bucket must be private
--      (flipped by migrations/20260408140000_attachments_bucket_private.sql).
--   6. Storage buckets never revert to public = true.
--
-- The declared-tables allowlist is hard-coded below so the drift check is
-- fully self-contained and can be reviewed at a glance. Update it whenever
-- a new table is added to supabase/schemas/01_tables.sql.

with declared_tables(name) as (
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
-- 1. tables without RLS
select
  'rls_disabled' as finding,
  format('%I.%I', schemaname, tablename) as object,
  'ALTER TABLE ... ENABLE ROW LEVEL SECURITY' as remediation
from pg_tables
where schemaname = 'public'
  and rowsecurity = false

union all

-- 2. tables not declared in 01_tables.sql
select
  'undeclared_table',
  format('public.%I', c.relname),
  'Add the table to supabase/schemas/01_tables.sql or drop it'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname not in (select name from declared_tables)

union all

-- 3. anon grants on public tables
select distinct
  'anon_table_grant',
  format('public.%I (%s)', g.table_name, g.privilege_type),
  'REVOKE ... ON TABLE ... FROM anon'
from information_schema.role_table_grants g
where g.table_schema = 'public'
  and g.grantee = 'anon'

union all

-- 4. anon EXECUTE on public functions
select
  'anon_function_grant',
  format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)),
  'REVOKE EXECUTE ON FUNCTION ... FROM anon'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and has_function_privilege('anon', p.oid, 'EXECUTE')

union all

-- 5. attachments bucket must be private
select
  'attachments_bucket_public',
  id,
  'UPDATE storage.buckets SET public = false WHERE id = ''attachments'''
from storage.buckets
where id = 'attachments'
  and public = true

union all

-- 6. any other public bucket
select
  'public_storage_bucket',
  id,
  'Review whether this bucket really needs unauthenticated reads'
from storage.buckets
where public = true
  and id <> 'attachments'

order by finding, object;
