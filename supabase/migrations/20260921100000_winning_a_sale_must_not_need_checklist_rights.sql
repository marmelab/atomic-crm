-- ===========================================================================
-- A paid sale must not need rights to seed a checklist
-- ===========================================================================
--
-- LIVE PRODUCTION REGRESSION, introduced by this repository.
--
-- 20260920120000 (Reliability Pass 1's own security work) revoked EXECUTE on
-- five privileged functions from anon, authenticated and service_role. That
-- was right for four of them. The fifth, seed_enrollment_onboarding(), is
-- not only called directly: it is called by handle_deal_won(), the AFTER
-- trigger that creates a client's Enrollment the moment an Opportunity
-- becomes Won.
--
-- handle_deal_won() was SECURITY INVOKER, so that inner call ran as whoever
-- wrote the deal. Reproduced against a database built from this chain, over
-- PostgREST, with the exact call chain:
--
--   update deals set stage = 'won'   (as service_role)
--     -> PL/pgSQL function handle_deal_won() line 35 at PERFORM
--     -> SELECT public.seed_enrollment_onboarding(v_enrollment_id)
--     -> 42501 permission denied for function seed_enrollment_onboarding
--
-- WHO this blocks is the part worth stating precisely, because the obvious
-- reading is wrong. An ordinary signed-in user was never able to set Won:
-- handle_deal_saved() refuses it outright, because Won must only ever mean
-- somebody paid and a CRM user must not be able to fabricate that. The role
-- that legitimately reaches Won is `service_role` — the Stripe webhook.
--
-- So this is not a button Leif could not press. It is a client paying and
-- the CRM failing to enroll them: no Enrollment, no onboarding checklist,
-- no Tasks, and a webhook error instead of a client.
--
-- It is the scheduled_on failure class, from the pass built to prevent it:
-- a privilege obligation tightened with no check that the writers could
-- still meet it. The writer contracts cover Sales Call creation; nothing
-- covered completing a sale.
--
-- THE FIX, and why this one.
--
-- Granting a client role EXECUTE on seed_enrollment_onboarding() would undo
-- the security work: it could then be called directly against anybody's
-- Enrollment. A SECURITY DEFINER wrapper around the seeding call would need
-- the same revoke to stay safe, which is where we came in.
--
-- So the TRIGGER is elevated and the callee stays locked — exactly the shape
-- 20260920130000 already had to use for clamp_contact_last_seen(). It is
-- safe here for reasons worth writing down:
--
--   * it is a trigger function: no user-supplied arguments beyond NEW, so
--     there is no parameter for a caller to steer it with;
--   * it contains no dynamic SQL at all;
--   * search_path is pinned to 'public';
--   * everything it touches — the Enrollment, the onboarding seed, the
--     scholarship slot handover — is a direct consequence of a Won
--     transition the caller was already allowed to make. Elevation grants
--     no capability that was not already implied by writing the deal.
--
-- Nothing else changes. No table grant, no role membership, the business
-- refusal for an ordinary user is untouched, and seed_enrollment_onboarding()
-- remains unreachable by a client directly.
CREATE OR REPLACE FUNCTION public.handle_deal_won()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cohort cohorts%ROWTYPE;
  v_enrollment_id bigint;
begin
  -- A historical Won Deal must never fire live onboarding: the importer
  -- inserts the truthful final-state Enrollment itself. Only
  -- set_historical_migration_mode() can set this GUC, transaction-locally.
  if current_setting('app.migration_mode', true) = 'true' then
    return new;
  end if;

  if new.stage = 'won' and (tg_op = 'INSERT' or old.stage is distinct from 'won') then
    if new.cohort_id is not null then
      select * into v_cohort from cohorts where id = new.cohort_id;
    end if;

    -- Idempotent: the unique constraint on enrollments.opportunity_id means
    -- re-saving Won never creates a duplicate. `returning ... into` only
    -- assigns on a genuine insert, so the block below stays replay-safe.
    insert into enrollments (opportunity_id, status, start_date, end_date, onboarding_tracking)
    values (
      new.id,
      'onboarding',
      v_cohort.program_start_at::date,
      v_cohort.program_end_at::date,
      -- A sale made today is tracked. legacy_untracked is only ever a
      -- statement about the past, never a default for new work.
      'tracked'
    )
    on conflict (opportunity_id) do nothing
    returning id into v_enrollment_id;

    if v_enrollment_id is not null then
      perform public.seed_enrollment_onboarding(v_enrollment_id);

      -- Scholarship slot occupancy moves from Deal to Enrollment in the
      -- same transaction, so the slot is never observably free between the
      -- two.
      if new.pricing_mode = 'scholarship' then
        update scholarship_slots
           set holder_deal_id = null, holder_enrollment_id = v_enrollment_id, updated_at = now()
         where offer_id = new.offer_id and holder_deal_id = new.id;
        if not found then
          raise exception 'Deal % reached Won as scholarship but held no scholarship slot for offer % — data inconsistency', new.id, new.offer_id;
        end if;

        insert into scholarship_slot_events (offer_id, deal_id, enrollment_id, event_type, occurred_at)
        values (new.offer_id, new.id, v_enrollment_id, 'deal_converted_to_enrollment', now());
      end if;
    end if;
  end if;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- PROVE IT, by doing it
-- ---------------------------------------------------------------------------
-- An ACL describes a lock. This turns the handle: it completes a real Won
-- transition and checks what the workflow is supposed to produce.
--
-- It runs on a direct database connection, where auth.role() is null — the
-- admin context the Won guard deliberately permits, and the only one
-- available inside a migration. The role that matters in production is
-- service_role (the Stripe webhook); e2e/winningASale.spec.ts exercises
-- that one over PostgREST, where a JWT role actually exists. Both hit the
-- same trigger and the same denied call.
--
-- Everything here is rolled back.
do $$
declare
  v_sales bigint;
  v_contact bigint;
  v_deal bigint;
  v_enrollments int;
  v_items int;
  v_items_after int;
begin
  select id into v_sales from sales limit 1;
  if v_sales is null then
    raise notice 'no sales row to probe with; skipping behavioural check';
    return;
  end if;

  insert into contacts (first_name, last_name, sales_id)
    values ('Won', 'Probe', v_sales) returning id into v_contact;
  insert into deals (name, contact_id, offer_id, stage, amount, sales_id, index)
    values ('won probe', v_contact, 1, 'interested', 0, v_sales, 0)
    returning id into v_deal;

  -- 1. The transition a completed payment performs.
  begin
    update deals set stage = 'won' where id = v_deal;
  exception when insufficient_privilege then
    raise exception 'a Won transition still cannot seed onboarding: %', sqlerrm;
  end;

  -- 2. Exactly one Enrollment, and onboarding actually seeded.
  select count(*) into v_enrollments from enrollments where opportunity_id = v_deal;
  if v_enrollments <> 1 then
    raise exception 'expected exactly 1 Enrollment, found %', v_enrollments;
  end if;

  select count(*) into v_items
    from enrollment_onboarding_items i
    join enrollments e on e.id = i.enrollment_id
   where e.opportunity_id = v_deal;
  if v_items = 0 then
    raise exception 'Won created an Enrollment but seeded no onboarding items';
  end if;

  -- 3. Re-saving Won is a no-op, not a second Enrollment or a second
  --    checklist — Stripe retries. The ON CONFLICT DO NOTHING guard has to
  --    survive the elevation.
  update deals set stage = 'won', updated_at = now() where id = v_deal;

  select count(*) into v_enrollments from enrollments where opportunity_id = v_deal;
  select count(*) into v_items_after
    from enrollment_onboarding_items i
    join enrollments e on e.id = i.enrollment_id
   where e.opportunity_id = v_deal;
  if v_enrollments <> 1 or v_items_after <> v_items then
    raise exception
      're-saving Won duplicated state: % Enrollment(s), % item(s) (was %)',
      v_enrollments, v_items_after, v_items;
  end if;

  -- 4. And the privileged function is STILL unreachable by a client on its
  --    own. The whole point of elevating the trigger rather than opening
  --    the callee.
  begin
    set local role authenticated;
    perform public.seed_enrollment_onboarding(
      (select id from enrollments where opportunity_id = v_deal));
    reset role;
    raise exception 'seed_enrollment_onboarding is directly callable by authenticated';
  exception when insufficient_privilege then
    reset role;
  end;

  raise exception 'rollback probe';
exception when others then
  if sqlerrm <> 'rollback probe' then raise; end if;
  raise notice 'a Won transition seeds its Enrollment and onboarding exactly once; the privileged function stays directly unreachable';
end $$;

-- No privilege was broadened. seed_enrollment_onboarding() must still grant
-- EXECUTE to nobody but its owner, and this migration must not have handed
-- anything to a client role.
do $$
declare
  v_acl text;
begin
  select coalesce(array_to_string(p.proacl, ' | '), '(null)')
    into v_acl
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'seed_enrollment_onboarding';

  if v_acl ~ '(anon|authenticated|service_role)=' then
    raise exception 'seed_enrollment_onboarding was opened to a client role: %', v_acl;
  end if;
  raise notice 'seed_enrollment_onboarding EXECUTE unchanged: %', v_acl;
end $$;
