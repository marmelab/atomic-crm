-- Ending a sales attempt signed Leif out.
--
-- Choose a reason in "Remove from pipeline", click it, and the CRM went to
-- the Sign In page. It happened on Susan Hendriks and again on Aurelie
-- Boleor, and neither removal was recorded — the Opportunities were
-- untouched, which is the tell: the write never landed.
--
-- The chain, end to end:
--
--   update deals set outcome = ...
--     -> AFTER trigger on_deal_outcome_changed
--       -> record_deal_outcome_event(), SECURITY INVOKER
--         -> insert into deal_outcome_events
--           -> 42501 permission denied  (authenticated has no INSERT there)
--             -> PostgREST returns HTTP 403
--               -> the auth provider treats 403 as a dead session
--                 -> logout
--
-- So a missing table grant was being read as an expired login. Nothing was
-- wrong with the session, and nothing was wrong with the reason Leif
-- picked.
--
-- deal_outcome_events is an internal audit table: RLS off, no policies, no
-- grants to anon, authenticated or service_role, and no application code
-- reads or writes it. That is deliberate — an exit is recorded as a
-- consequence of changing an Opportunity, never by a client asserting one
-- directly. Every sibling table of that kind (application_responses,
-- contact_external_identities, contact_merges, the import records) is
-- written the same way, by a SECURITY DEFINER function.
--
-- record_deal_outcome_event() was simply left as INVOKER. Making it
-- DEFINER is what the rest of the schema already does, and it is tighter
-- than the alternative: granting the browser INSERT would let a client
-- forge outcome history, which nothing should be able to do.
--
-- record_deal_stage_event() is deliberately NOT changed. deal_stage_events
-- does grant authenticated INSERT, so it has always worked — which is why
-- moving a card between columns never signed anybody out while ending a
-- sale did.

begin;

create or replace function public.record_deal_outcome_event()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_source text := coalesce(
    nullif(current_setting('app.outcome_event_source', true), ''), 'app');
  v_note text := nullif(current_setting('app.outcome_event_note', true), '');
begin
  if tg_op = 'INSERT' then
    if new.outcome is not null then
      insert into public.deal_outcome_events
        (opportunity_id, old_outcome, new_outcome, exit_reason, occurred_at, source, note)
      values (new.id, null, new.outcome, new.exit_reason, now(), v_source, v_note);
    end if;
  elsif new.outcome is distinct from old.outcome
     or (new.outcome is not null and new.exit_reason is distinct from old.exit_reason) then
    insert into public.deal_outcome_events
      (opportunity_id, old_outcome, new_outcome, exit_reason, occurred_at, source, note)
    values (new.id, old.outcome, new.outcome, new.exit_reason, now(), v_source, v_note);
  end if;
  return new;
end;
$function$;

comment on function public.record_deal_outcome_event() is
  'Writes the audit row for an Opportunity leaving, or changing how it left. SECURITY DEFINER because deal_outcome_events is written only as a consequence of a Deal changing — never by a client asserting an exit directly, which is why no role is granted INSERT on it.';

-- A trigger function is never called directly, so nothing legitimate needs
-- EXECUTE on it. Closing the default grant to PUBLIC keeps a SECURITY
-- DEFINER function from being reachable by anyone who finds its name.
revoke all on function public.record_deal_outcome_event() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Prove the exit path works for the role the browser actually uses
-- ---------------------------------------------------------------------
do $$
declare
  v_contact bigint;
  v_deal bigint;
  v_offer bigint;
  v_ok boolean := false;
  v_failed text := null;
begin
  if not (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'record_deal_outcome_event') then
    raise exception 'record_deal_outcome_event() is still SECURITY INVOKER';
  end if;

  -- The audit row must stay unreachable to a client directly. Granting
  -- INSERT would have fixed the logout too, and would have let a browser
  -- forge outcome history — which nothing should ever be able to do.
  if has_table_privilege('authenticated', 'public.deal_outcome_events', 'INSERT')
     or has_table_privilege('anon', 'public.deal_outcome_events', 'INSERT') then
    raise exception 'a client can now forge outcome history, which this must never allow';
  end if;

  -- Then the behaviour itself: end a synthetic sale as `authenticated`,
  -- which is what the browser is. The inner block is a subtransaction and
  -- ends by raising, so every row it wrote — the Contact, the
  -- Opportunity and the audit row the trigger produced — is rolled back.
  -- PL/pgSQL variables survive that rollback, so the verdict comes out
  -- while the rows do not, and this needs no privilege on
  -- deal_outcome_events at all.
  begin
    select id into v_offer from offers order by id limit 1;
    insert into contacts (first_name, last_name, first_seen, last_seen)
    values ('Zz', 'Exit Probe', now(), now()) returning id into v_contact;
    insert into deals (name, contact_id, offer_id, stage, stage_entered_at)
    values ('zz exit probe', v_contact, v_offer, 'decision', now()) returning id into v_deal;

    set local role authenticated;
    begin
      update deals set outcome = 'lost', exit_reason = 'ghosted',
                       prospect_decision = 'ghosted'
       where id = v_deal;
      v_ok := true;
    exception when others then
      v_failed := format('%s: %s', sqlstate, sqlerrm);
    end;
    reset role;

    raise exception 'ZZ_EXIT_PROBE_ROLLBACK';
  exception when others then
    if sqlerrm <> 'ZZ_EXIT_PROBE_ROLLBACK' then
      raise;
    end if;
  end;

  if not v_ok then
    raise exception 'ending a sale still fails for authenticated — %',
      coalesce(v_failed, 'no error reported');
  end if;
end $$;

commit;
