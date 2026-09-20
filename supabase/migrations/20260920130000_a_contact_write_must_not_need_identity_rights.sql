-- Writing a Contact must not require the right to read identity rows.
--
-- WHAT WAS WRONG
--
-- clamp_contact_last_seen() is the trigger that refuses to let a Contact
-- claim it was seen in the future. When it finds one, it repairs the value
-- by asking contact_last_occurred_activity() what the latest real evidence
-- is — and that helper reads contact_external_identities among its seven
-- sources.
--
-- Both are SECURITY INVOKER, so the whole chain runs with the privileges of
-- whoever wrote the Contact. `authenticated` has SELECT on
-- contact_external_identities and never noticed. `service_role` does not —
-- deliberately, on MAIN as well as here, because identity rows are written
-- through record_external_identity() and never by a client. So:
--
--     insert into contacts (..., last_seen) values (..., now() + 2s)
--       as service_role
--     -> 42501 permission denied for table contact_external_identities
--
-- Reproduced deterministically: the same INSERT with a PAST last_seen
-- succeeds, because the repair branch is never entered. Only a last_seen
-- strictly greater than now() reaches the helper — which is exactly what a
-- client-generated `new Date().toISOString()` becomes by the time the
-- database evaluates now(), so the failure is real, intermittent, and
-- looks like nothing in particular.
--
-- service_role is the Edge Functions. findOrCreateContact() in the Acuity
-- webhook creates a Contact for a person booking a call for the first time,
-- and the public application intake does the same.
--
-- WHY THIS FIX
--
-- The wrong repair is a grant. Handing service_role SELECT on
-- contact_external_identities would silence the error by giving the caller
-- standing authority over identity data it has no business reading, and
-- would put the clean room back out of step with MAIN.
--
-- The narrow repair is to let the TRIGGER do what a trigger is for. Marking
-- clamp_contact_last_seen() SECURITY DEFINER elevates exactly one function,
-- and the nested SECURITY INVOKER helper then resolves against the definer
-- rather than the caller. Nobody gains a table privilege.
--
-- Why this specific function and not the helper: contact_last_occurred_
-- activity() is EXECUTE-able by anon. Making THAT definer would let an
-- unauthenticated caller probe the activity time of any contact id.
-- clamp_contact_last_seen() is a trigger function, and a trigger function
-- cannot be invoked any other way — `select clamp_contact_last_seen()`
-- answers 0A000, "trigger functions can only be called as triggers". So
-- there is no path by which a client reaches the elevated code except by
-- writing a Contact it was already allowed to write.
--
-- search_path stays pinned to public, which is safe here because no client
-- role holds CREATE on that schema (checked: anon, authenticated and
-- service_role are all false), so nothing can shadow the objects the body
-- resolves. The body runs no dynamic SQL and writes no table; it only
-- assigns to NEW.
--
-- One deliberate behaviour change worth stating: the repair now reads its
-- evidence past RLS instead of through the caller's view of it. That makes
-- the clamped value the same fact for every writer, where before it could
-- differ by who happened to be writing. The clamp is answering "when was
-- this person actually last seen", which has one answer.

CREATE OR REPLACE FUNCTION public.clamp_contact_last_seen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_occurred timestamptz;
begin
  if new.last_seen is not null and new.last_seen > now() then
    -- On INSERT there is no prior row; TG_OP tells us which fallback is
    -- honest. Either way, now() is never the answer.
    v_occurred := contact_last_occurred_activity(new.id);
    if v_occurred is not null then
      new.last_seen := v_occurred;
    elsif tg_op = 'UPDATE' then
      new.last_seen := old.last_seen;
    else
      new.last_seen := null;
    end if;
  end if;

  if new.first_seen is not null and new.last_seen is not null
     and new.last_seen < new.first_seen then
    new.last_seen := new.first_seen;
  end if;

  return new;
end;
$function$
;

comment on function public.clamp_contact_last_seen() is
  'Refuses a Contact a last_seen in the future, repairing it from real evidence. SECURITY DEFINER because the repair reads contact_external_identities, which service_role deliberately cannot: writing a Contact must not require the right to read identity rows. A trigger function is unreachable except through the trigger, so this elevates no caller.';

-- ---------------------------------------------------------------------------
-- PROVE IT
-- ---------------------------------------------------------------------------
-- Probes run under `set local role`, inside a subtransaction that ends by
-- raising, so every row they write is rolled back while the verdicts —
-- plain PL/pgSQL variables — survive.
do $$
declare
  v_offer      bigint;
  v_service_ok boolean := false;
  v_service_err text;
  v_auth_ok    boolean := false;
  v_auth_err   text;
  v_clamped    timestamptz := 'infinity';
  v_denied     boolean := false;
begin
  if not (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'clamp_contact_last_seen') then
    raise exception 'clamp_contact_last_seen() is still SECURITY INVOKER';
  end if;

  begin
    select id into v_offer from offers order by id limit 1;

    -- service_role, the role the Edge Functions hold, writing the exact
    -- shape that used to fail.
    set local role service_role;
    begin
      insert into contacts (first_name, last_name, first_seen, last_seen)
      values ('Zz', 'Clamp Probe', now() - interval '1 hour', now() + interval '2 seconds')
      returning last_seen into v_clamped;
      v_service_ok := true;
    exception when others then
      v_service_err := format('%s: %s', sqlstate, sqlerrm);
    end;

    -- And the protected table stays out of reach of that same role.
    begin
      perform 1 from contact_external_identities limit 1;
    exception when insufficient_privilege then
      v_denied := true;
    end;
    reset role;

    -- authenticated must be unaffected.
    set local role authenticated;
    begin
      insert into contacts (first_name, last_name, first_seen, last_seen)
      values ('Zz', 'Clamp Probe Auth', now() - interval '1 hour', now() + interval '2 seconds');
      v_auth_ok := true;
    exception when others then
      v_auth_err := format('%s: %s', sqlstate, sqlerrm);
    end;
    reset role;

    raise exception 'ZZ_CLAMP_PROBE_ROLLBACK';
  exception when others then
    if sqlerrm <> 'ZZ_CLAMP_PROBE_ROLLBACK' then
      raise;
    end if;
  end;

  if not v_service_ok then
    raise exception 'service_role still cannot write a Contact with a future last_seen — %',
      coalesce(v_service_err, 'no error reported');
  end if;

  if not v_auth_ok then
    raise exception 'authenticated lost the ability to write a Contact — %',
      coalesce(v_auth_err, 'no error reported');
  end if;

  -- The canonical rule: a future last_seen never survives. With no other
  -- evidence for a brand-new Contact, the honest answer is null.
  if v_clamped is not null then
    raise exception
      'a future last_seen survived the clamp as % — it must be repaired from evidence or left null', v_clamped;
  end if;

  if not v_denied then
    raise exception
      'service_role can now read contact_external_identities directly — the fix was supposed to elevate the trigger, not the caller';
  end if;
end $$;
