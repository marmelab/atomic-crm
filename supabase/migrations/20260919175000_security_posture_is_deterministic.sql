-- The security posture of this database is rebuilt from this repository,
-- not remembered by one server.
--
-- WHAT WAS WRONG
--
-- MAIN carried a piece of privilege configuration that nothing in this
-- repository created: an ALTER DEFAULT PRIVILEGES on role postgres in
-- schema public, hardening every table it creates down to
-- TRUNCATE/REFERENCES/TRIGGER (+MAINTAIN on PG16+) for authenticated and
-- service_role, and nothing at all for anon. Someone applied it once, by
-- hand, and it never entered the chain.
--
-- Every migration since was written against that. They say
--
--     grant select on public.application_responses to authenticated;
--
-- and never revoke, because on MAIN there was nothing to revoke — the
-- table arrived with no client privileges. Replay the same chain into an
-- empty database WITHOUT that hardening and Supabase's stock default
-- privileges apply instead, so the very same statement leaves
-- authenticated holding INSERT, UPDATE and DELETE as well.
--
-- Measured against MAIN at this point in the chain: 23 over-grants across
-- 12 relations, every one of them in the permissive direction. A database
-- rebuilt from this repository — the documented disaster-recovery path —
-- would have let any signed-in client forge outcome history, rewrite
-- immutable Application answers, write Contact identity rows, and delete
-- Stripe relations. MAIN itself was never exposed. The rebuild was.
--
-- Found by 20260919180000, which runs immediately after this one and
-- refuses to proceed while a client can reach deal_outcome_events. It
-- fails closed, which is why this was findable at all, and it is why this
-- migration is dated to land just before it: the chain cannot get past
-- that assertion in a clean room until the posture is right.
--
-- WHAT THIS DOES
--
-- Nothing on MAIN. Every statement below is already true there, which is
-- the point — this migration transcribes MAIN's posture into the chain so
-- an empty database reaches the same place. In a clean room it is the
-- difference between a faithful rebuild and a quietly weaker one.
--
-- Two halves, and both are necessary. Fixing only the existing tables
-- would leave the next table created permissive again; setting only the
-- default privileges would leave the tables that already exist wrong.
--
-- Scope is deliberately TABLES. Functions and sequences show no
-- divergence between MAIN and a replayed clean room, and narrowing
-- privileges nothing has been shown to need is how a security change
-- becomes an outage.

-- ---------------------------------------------------------------------------
-- 1. FUTURE OBJECTS — what a table gets merely by being created
-- ---------------------------------------------------------------------------
-- Application tables are owned by postgres (46 of 46 in a replayed clean
-- room), so this is the default set that actually applies to them.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant truncate, references, trigger on tables to authenticated, service_role;

-- MAINTAIN arrived in PostgreSQL 16 and is part of MAIN's ACL (Dxtm).
-- Granted conditionally so the same chain still replays on an older
-- server instead of failing on an unknown privilege name.
do $$
begin
  if current_setting('server_version_num')::int >= 160000 then
    execute 'alter default privileges for role postgres in schema public '
         || 'grant maintain on tables to authenticated, service_role';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. EXISTING OBJECTS — the relations already created by this point
-- ---------------------------------------------------------------------------
-- Each statement mirrors what supabase/schemas/06_grants.sql already
-- declares for that relation, and each is a no-op on MAIN. The list is
-- historical and closed: it covers the tables that existed when the
-- hardening was missing, and section 1 covers everything created after.

-- The outcome audit trail. Written only by record_deal_outcome_event(),
-- which is SECURITY DEFINER precisely so that no client ever needs INSERT
-- here. A browser that could write this could invent how a sale ended.
revoke select, insert, update, delete on table public.deal_outcome_events
  from anon, authenticated, service_role;

-- Application answers are immutable evidence: the exact question and the
-- exact answer, readable by the CRM and rewritable by nobody.
revoke insert, update, delete on table public.application_responses
  from anon, authenticated, service_role;
revoke select on table public.application_responses from anon, service_role;
grant select on table public.application_responses to authenticated;

revoke insert, update, delete on table public.application_form_versions
  from anon, authenticated, service_role;
revoke select on table public.application_form_versions from anon, service_role;
grant select on table public.application_form_versions to authenticated;

revoke insert, update, delete on table public.application_form_questions
  from anon, authenticated, service_role;
revoke select on table public.application_form_questions from anon, service_role;
grant select on table public.application_form_questions to authenticated;

-- Identity. A handle is never identity and neither is a row a client
-- wrote: these are populated through record_external_identity() and
-- merge_contacts_safely(), never by hand from a browser.
revoke insert, update, delete on table public.contact_external_identities
  from anon, authenticated, service_role;
revoke select on table public.contact_external_identities from anon, service_role;
grant select on table public.contact_external_identities to authenticated;

revoke insert, update, delete on table public.contact_merges
  from anon, authenticated, service_role;
revoke select on table public.contact_merges from anon, service_role;
grant select on table public.contact_merges to authenticated;

-- Import provenance is deliberately unreadable to the UI roles, so no
-- read path can consult it to decide what is historical.
revoke select, insert, update, delete on table public.historical_import_records
  from anon, authenticated, service_role;

-- Stripe relations: the app links and updates them, and never deletes
-- one. Losing the link between a Deal and its plan silently is how an
-- agreed total stops being provable.
revoke delete on table public.contact_stripe_customers
  from anon, authenticated, service_role;
revoke delete on table public.deal_stripe_plan_objects
  from anon, authenticated, service_role;

-- Derived views the Dashboard reads.
revoke insert, update, delete on table public.applications_awaiting_review
  from anon, authenticated, service_role;
revoke select on table public.applications_awaiting_review from anon, service_role;
grant select on table public.applications_awaiting_review to authenticated;

revoke insert, update, delete on table public.enrollments_missing_onboarding
  from anon, authenticated, service_role;
revoke select on table public.enrollments_missing_onboarding from anon, service_role;
grant select on table public.enrollments_missing_onboarding to authenticated;

revoke insert, update, delete on table public.contact_email_addresses
  from anon, authenticated, service_role;
revoke select on table public.contact_email_addresses from anon, service_role;
grant select on table public.contact_email_addresses to authenticated;

-- ---------------------------------------------------------------------------
-- 3. PROVE IT
-- ---------------------------------------------------------------------------
-- Catalog reads and has_table_privilege() only — no DML, so this runs
-- under the migration role without needing any privilege of its own.
do $$
declare
  v_relation text;
  v_role     text;
  v_acl      text;
begin
  -- The default set a new table would inherit must no longer include any
  -- of the four that matter.
  foreach v_role in array array['anon', 'authenticated', 'service_role'] loop
    select defaclacl::text into v_acl
      from pg_default_acl
     where defaclrole = 'postgres'::regrole
       and defaclnamespace = 'public'::regnamespace
       and defaclobjtype = 'r';

    if v_acl is null then
      raise exception
        'default privileges for postgres on tables in public were not set; a new table would inherit Supabase stock grants';
    end if;

    if v_acl ~ (v_role || '=[arwd]') then
      raise exception
        'default privileges still hand % read or write on every new table: %', v_role, v_acl;
    end if;
  end loop;

  -- Nothing a client can reach may carry write on the protected set.
  foreach v_relation in array array[
    'public.deal_outcome_events',
    'public.application_responses',
    'public.application_form_versions',
    'public.application_form_questions',
    'public.contact_external_identities',
    'public.contact_merges',
    'public.contact_email_addresses',
    'public.historical_import_records',
    'public.applications_awaiting_review',
    'public.enrollments_missing_onboarding'
  ] loop
    foreach v_role in array array['anon', 'authenticated', 'service_role'] loop
      if has_table_privilege(v_role, v_relation, 'INSERT')
         or has_table_privilege(v_role, v_relation, 'UPDATE')
         or has_table_privilege(v_role, v_relation, 'DELETE') then
        raise exception '% can still write %', v_role, v_relation;
      end if;
    end loop;

    if has_table_privilege('anon', v_relation, 'SELECT') then
      raise exception 'anon can still read %', v_relation;
    end if;
  end loop;

  -- deal_outcome_events is not even readable by a client.
  if has_table_privilege('authenticated', 'public.deal_outcome_events', 'SELECT') then
    raise exception 'authenticated can still read the outcome audit trail';
  end if;

  -- The Stripe relations keep the access the app genuinely uses, and lose
  -- only the destructive one.
  foreach v_relation in array array[
    'public.contact_stripe_customers',
    'public.deal_stripe_plan_objects'
  ] loop
    if has_table_privilege('authenticated', v_relation, 'DELETE') then
      raise exception 'authenticated can still delete from %', v_relation;
    end if;
    if not has_table_privilege('authenticated', v_relation, 'INSERT')
       or not has_table_privilege('authenticated', v_relation, 'UPDATE')
       or not has_table_privilege('authenticated', v_relation, 'SELECT') then
      raise exception
        'the app lost access it needs on % — this migration is meant to remove DELETE and nothing else', v_relation;
    end if;
  end loop;

  -- And the everyday tables the CRM actually works through are untouched.
  foreach v_relation in array array[
    'public.contacts', 'public.deals', 'public.tasks', 'public.sales_calls'
  ] loop
    if not has_table_privilege('authenticated', v_relation, 'SELECT')
       or not has_table_privilege('authenticated', v_relation, 'INSERT')
       or not has_table_privilege('authenticated', v_relation, 'UPDATE') then
      raise exception 'the CRM lost access it needs on %', v_relation;
    end if;
  end loop;
end $$;
