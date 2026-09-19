-- The outcome-event trigger's final behaviour, owned deterministically.
--
-- record_deal_outcome_event() is created by 20260918370000 (deterministic)
-- and then replaced by 20260918390000 — Alva Winsa's correction, which is a
-- MAIN-only historical repair and is not replayed into an empty database.
-- That left the final behaviour owned by a migration a rebuild skips, so a
-- rebuilt database would have the earlier body: one that stamps every
-- outcome event source = 'app' and cannot record that a change was a
-- repair.
--
-- This is the reason the extraction needed two files rather than one.
-- Installing this body alongside the other structure at 20260918155000
-- would simply be overwritten by 370000; it has to land after it.
--
-- Verbatim from MAIN via pg_get_functiondef, so applying it there replaces
-- the function with itself. No business data is touched.

begin;

CREATE OR REPLACE FUNCTION public.record_deal_outcome_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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

do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'record_deal_outcome_event'
      and pg_get_functiondef(p.oid) like '%app.outcome_event_source%'
  ) then
    raise exception 'record_deal_outcome_event() does not honour app.outcome_event_source';
  end if;
end $$;

commit;
