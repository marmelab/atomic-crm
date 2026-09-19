-- Alva Winsa's sales attempt was ended by a missed meeting, not by anybody.
--
-- Opportunity 187 carries outcome = 'lost'. No human chose that: the
-- retired no-show rule set it automatically the moment her call was marked
-- no_show. The rule is gone; the record it left is not, and leaving it
-- would mean the system's own bug is still making a business claim about
-- a real person.
--
-- This corrects the state of the SAME still-current attempt. It does not
-- invent a rebooking, does not create a second Opportunity, and does not
-- decide anything on her behalf: prospect_decision stays null, and what
-- happens next becomes visible through the derived condition (active +
-- latest call cancelled/no-show + nothing booked since) rather than being
-- answered here.
--
-- The no-show itself stays exactly as it is. It happened.
--
-- Scope is one row, deliberately. The other 17 call_booked + lost
-- Opportunities are NOT touched: Alva is corrected because there is
-- specific evidence her exit was mechanical, and the rest have not been
-- individually reviewed. A bulk reactivation would be the same mistake in
-- the opposite direction.

begin;

-- record_deal_outcome_event()'s repair-aware body moved to 20260919020000_final_outcome_event_behaviour.sql.
-- This migration repairs historical production data and is not replayed
-- into an empty database, so it must not be the only thing that creates
-- structure the finished CRM needs. Its assertions below are unchanged.

-- ---------------------------------------------------------------------
-- 2. The correction, with its premises asserted rather than assumed
-- ---------------------------------------------------------------------
do $$
declare
  v record;
  v_booked int;
  v_no_show int;
  v_events_before int;
  v_events_after int;
begin
  select * into v from public.deals where id = 187;
  if not found then
    raise exception 'Opportunity 187 does not exist';
  end if;
  if v.stage is distinct from 'call_booked' or v.outcome is distinct from 'lost' then
    raise exception 'Opportunity 187 is %/%, expected call_booked/lost — state changed',
      v.stage, coalesce(v.outcome, 'null');
  end if;
  if v.exit_reason is not null or v.exit_note is not null then
    raise exception 'Opportunity 187 carries a human exit reason (%/%); this correction assumes none',
      v.exit_reason, v.exit_note;
  end if;
  if v.prospect_decision is not null then
    raise exception 'Opportunity 187 has prospect_decision %; a stated decision is not mechanical',
      v.prospect_decision;
  end if;

  select count(*) into v_booked from public.sales_calls
   where opportunity_id = 187 and status = 'booked';
  if v_booked <> 0 then
    raise exception 'Opportunity 187 has % booked calls; it is not stranded', v_booked;
  end if;

  select count(*) into v_no_show from public.sales_calls
   where opportunity_id = 187 and attendance = 'no_show';
  if v_no_show < 1 then
    raise exception 'Opportunity 187 has no no-show call; the mechanical cause is unproven';
  end if;

  select count(*) into v_events_before from public.deal_outcome_events
   where opportunity_id = 187;

  -- The correction itself. exit_reason and exit_note are already null, so
  -- nothing is "cleared" that a human wrote.
  perform set_config('app.outcome_event_source', 'repair', true);
  perform set_config(
    'app.outcome_event_note',
    'Mechanically-created exit removed. The retired no-show rule set outcome = lost automatically when this call was marked no_show; no human ended this sales attempt. The no-show itself is preserved. Stage returns to approved because Call Booked asserts a booked call and there is none.',
    true);

  update public.deals
     set outcome = null,
         stage = 'approved',
         stage_entered_at = now(),
         updated_at = now()
   where id = 187;

  select count(*) into v_events_after from public.deal_outcome_events
   where opportunity_id = 187;
  if v_events_after <> v_events_before + 1 then
    raise exception 'expected exactly one correction event, got %',
      v_events_after - v_events_before;
  end if;

  -- The reconstructed baseline must still be there: the record of what the
  -- system believed is part of the history, not something to tidy away.
  if not exists (
    select 1 from public.deal_outcome_events
    where opportunity_id = 187 and reconstructed and new_outcome = 'lost'
  ) then
    raise exception 'the original reconstructed lost event was lost';
  end if;

  if not (select public.deal_is_active(archived_at, stage, outcome)
          from public.deals where id = 187) then
    raise exception 'Opportunity 187 is still not active after the correction';
  end if;
end $$;

commit;
