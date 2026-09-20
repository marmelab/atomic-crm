-- The other half of MAIN's hand-applied hardening: sequences and functions.
--
-- 20260919175000 brought tables into the chain and had to sit where it
-- sits, immediately before the assertion that discovered the gap. This one
-- sits at the END on purpose. MAIN's narrowing of sequence and function
-- defaults was applied after the newest migration had already run — the
-- evidence is in MAIN itself, where public.sales_call_open_question() from
-- 20260920100000 is still executable by everyone while
-- reconcile_sales_call_tasks() beside it is not. Putting this any earlier
-- would strip EXECUTE from functions the later migrations create, and the
-- clean room would end up STRICTER than production instead of equal to it.
-- Reproducing a posture means reproducing when it happened.
--
-- Measured after a full deterministic replay, against MAIN:
--   23 sequences and 5 functions more permissive in the clean room.
-- Every statement here is already true on MAIN, so this is a no-op there
-- and a repair in a rebuild.
--
-- The five functions are not incidental. They are the privileged
-- operations the architecture deliberately keeps away from a browser:
-- merging two people, writing an external identity, and the reconcilers
-- that rewrite Task state. In a rebuilt database a signed-in client could
-- call all five directly. On MAIN none of them can.

-- ---------------------------------------------------------------------------
-- 1. FUTURE OBJECTS
-- ---------------------------------------------------------------------------
-- MAIN: sequences {postgres=rwU/postgres}, functions {postgres=X/postgres}.
-- A new sequence or function arrives reachable by its owner and nobody
-- else; anything a client needs is granted explicitly, in the migration
-- that knows why.
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. EXISTING SEQUENCES
-- ---------------------------------------------------------------------------
-- Twenty-one are owner-only on MAIN. Identity and serial columns do not
-- need a client grant to work — MAIN has run this way throughout — so
-- taking these back costs the app nothing.
do $$
declare
  v_seq text;
begin
  foreach v_seq in array array[
    'acuity_appointment_type_map_id_seq',
    'application_form_questions_id_seq',
    'application_form_versions_id_seq',
    'application_responses_id_seq',
    'companies_id_seq',
    'contactNotes_id_seq',
    'contact_external_identities_id_seq',
    'contact_merges_id_seq',
    'contacts_id_seq',
    'dealNotes_id_seq',
    'deal_outcome_events_id_seq',
    'deal_payment_schedule_items_id_seq',
    'deals_id_seq',
    'favicons_excluded_domains_id_seq',
    'historical_application_source_snapshots_id_seq',
    'historical_import_records_id_seq',
    'sales_id_seq',
    'tags_id_seq',
    'tasks_id_seq',
    'waitlist_invitation_batches_id_seq',
    'waitlist_invitations_id_seq'
  ] loop
    if to_regclass(format('public.%I', v_seq)) is not null then
      execute format(
        'revoke all on sequence public.%I from anon, authenticated, service_role',
        v_seq);
    end if;
  end loop;
end $$;

-- The two Stripe sequences keep SELECT and USAGE on MAIN and lose only
-- UPDATE: the app reads and advances them through inserts, and nothing
-- legitimately calls setval() from a browser.
do $$
declare
  v_seq text;
begin
  foreach v_seq in array array[
    'contact_stripe_customers_id_seq',
    'deal_stripe_plan_objects_id_seq'
  ] loop
    if to_regclass(format('public.%I', v_seq)) is not null then
      execute format(
        'revoke update on sequence public.%I from anon, authenticated, service_role',
        v_seq);
      execute format(
        'grant select, usage on sequence public.%I to authenticated, service_role',
        v_seq);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. EXISTING FUNCTIONS
-- ---------------------------------------------------------------------------
-- Revoked by identity rather than by name so an overload cannot slip
-- through, and so this stays correct if a signature changes later.
do $$
declare
  v_name text;
  v_ident text;
begin
  foreach v_name in array array[
    'merge_contacts_safely',
    'record_external_identity',
    'reconcile_sales_call_tasks',
    'reconcile_application_review_tasks',
    'seed_enrollment_onboarding'
  ] loop
    for v_ident in
      select p.oid::regprocedure::text
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = v_name
    loop
      execute format(
        'revoke all on function %s from public, anon, authenticated, service_role',
        v_ident);
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. PROVE IT
-- ---------------------------------------------------------------------------
do $$
declare
  v_name text;
  v_role text;
  v_acl  text;
  v_ok   boolean;
begin
  foreach v_name in array array['S', 'f'] loop
    select defaclacl::text into v_acl
      from pg_default_acl
     where defaclrole = 'postgres'::regrole
       and defaclnamespace = 'public'::regnamespace
       and defaclobjtype = v_name;

    if v_acl is null then
      raise exception
        'default privileges for postgres on % in public were not set', v_name;
    end if;

    foreach v_role in array array['anon', 'authenticated', 'service_role'] loop
      if v_acl like '%' || v_role || '=%' then
        raise exception
          'a new % in public would still be reachable by %: %', v_name, v_role, v_acl;
      end if;
    end loop;
  end loop;

  -- No client role may call the privileged five.
  foreach v_name in array array[
    'merge_contacts_safely',
    'record_external_identity',
    'reconcile_sales_call_tasks',
    'reconcile_application_review_tasks',
    'seed_enrollment_onboarding'
  ] loop
    foreach v_role in array array['anon', 'authenticated', 'service_role'] loop
      select bool_or(has_function_privilege(v_role, p.oid, 'EXECUTE'))
        into v_ok
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = v_name;

      if coalesce(v_ok, false) then
        raise exception '% can still execute %()', v_role, v_name;
      end if;
    end loop;
  end loop;

  -- The classifier the app and the Acuity handler are held to stays
  -- callable: it reads nothing and decides nothing on its own, and the
  -- cross-runtime contract calls it directly.
  select bool_or(has_function_privilege('service_role', p.oid, 'EXECUTE'))
    into v_ok
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'sales_call_open_question';

  if not coalesce(v_ok, false) then
    raise exception
      'sales_call_open_question() lost EXECUTE — this migration is meant to narrow the privileged five and nothing else';
  end if;
end $$;
