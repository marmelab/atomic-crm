-- MAIN-ONLY. Two facts the CRM was refusing to hold.
--
-- Listed in replay-manifest.json: named production records, no schema.
-- The structural half — deriving scheduled_on so a call can be created at
-- all — is 20260920020000 and replays on its own.
--
-- 1. DAX KARA'S CALL ALREADY HAPPENED.
--
-- Leif entered 2026-08-01 12:30 and got "Server communication error"; the
-- insert died on the NOT NULL that 20260920020000 now fills, so NOTHING
-- was written — no call, no event, no stage change, Opportunity 219
-- untouched since it was created. The call is recorded here exactly once,
-- through the same shape the app now uses:
--
--   status 'booked' with a past instant, plus resolution_requested_at.
--
-- That pairing is the product's existing answer for a call that has
-- already happened and whose outcome nobody has stated. It is NOT a
-- pending future call: the reconciler's past-tense guard turns it into
-- the one "what happened on this call?" question, the same one Megan
-- Auron and Mila Frattini carry. Leif has made no decision about Dax and
-- none is invented here.
--
-- It attaches to Opportunity 219 — his CURRENT attempt, application 182,
-- reviewed yesterday, in call_booked since 14:17 today. Opportunity 101
-- is his earlier attempt, outcome 'nurture', and is left alone: one
-- Opportunity per sales attempt, and an older ended one does not get a
-- newer call.
--
-- 2. AURELIE BOLEOR CANCELLED A CALL SHE SUPPOSEDLY NEVER BOOKED.
--
-- Opportunity 68 sits in `approved` with a legitimate linked Acuity call
-- that is `cancelled`. Those two statements cannot both be true —
-- cancelling requires having booked. Her stage-event log simply never
-- recorded the transition; a missing history row is not evidence that
-- the stage never happened, and the call is the stronger fact.
--
-- The repair was deliberately refused once before, on the grounds that
-- she had no call_booked stage event. That was too conservative, and
-- this reverses it on the owner's correction.
--
-- PROVENANCE OF THE TIMESTAMP: her transition cannot be dated. The call
-- carries no `booked` event — only a `cancelled` one at 2026-09-17
-- 19:52 — so the only provable claim is that she had booked by the time
-- the call was scheduled, 2026-09-15 18:00Z. Rather than dress a
-- reconciliation up as a historical moment, the new stage event is
-- stamped NOW: this is when the CRM was corrected, which is the only
-- thing that actually happened then. Her `interested` and `approved`
-- events stay exactly as they are.
--
-- Nothing else in the class is touched. 41 Opportunities sit in a
-- pre-call stage with a call attached, and 40 of them are terminal —
-- `lost` or `nurture`. Their stage records where the sale had got to
-- when it ended, and reopening a finished attempt to tidy its history
-- would overwrite a real outcome with bookkeeping.

begin;

-- ---------------------------------------------------------------------
-- 1. Dax
-- ---------------------------------------------------------------------
do $$
declare
  v_call_id bigint;
  v_sales_id bigint;
  v_when constant timestamptz := timestamptz '2026-08-01 12:30 America/Denver';
begin
  if not exists (
    select 1 from deals
     where id = 219 and contact_id = 110 and stage = 'call_booked'
       and outcome is null and archived_at is null
  ) then
    raise exception 'Opportunity 219 is not the case this repair was written for';
  end if;
  if exists (select 1 from sales_calls where opportunity_id = 219) then
    raise exception 'Opportunity 219 already has a Sales Call; this would duplicate it';
  end if;
  -- His earlier attempt keeps its own call and its own ending.
  if (select outcome from deals where id = 101) is distinct from 'nurture' then
    raise exception 'Opportunity 101 changed; check which attempt this call belongs to';
  end if;

  insert into sales_calls
    (opportunity_id, contact_id, status, original_scheduled_at, scheduled_at,
     reschedule_count, source, resolution_requested_at)
  values (219, 110, 'booked', v_when, v_when, 0, 'manual', now())
  returning id into v_call_id;

  insert into sales_call_events (sales_call_id, kind, occurred_at, new_scheduled_at)
  values (v_call_id, 'booked', now(), v_when);

  -- The question the product asks about a past call nobody has resolved.
  select id into v_sales_id from sales where administrator = true limit 1;
  insert into tasks (contact_id, type, text, due_date, status,
                     sales_call_id, opportunity_id, sales_id)
  values (110, 'resolve_sales_call',
          'Dax Kara · what happened on this call?',
          now(), 'pending', v_call_id, 219, v_sales_id);
end $$;

-- ---------------------------------------------------------------------
-- 2. Aurelie
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from deals
     where id = 68 and stage = 'approved' and outcome is null and archived_at is null
  ) then
    raise exception 'Opportunity 68 is not the case this repair was written for';
  end if;
  -- The evidence: a real, linked, cancelled call.
  if not exists (
    select 1 from sales_calls
     where opportunity_id = 68 and status = 'cancelled' and cancelled_at is not null
  ) then
    raise exception 'Opportunity 68 has no cancelled call to prove it reached call_booked';
  end if;
  -- And nothing later that would outrank it.
  if exists (
    select 1 from deal_stage_events
     where opportunity_id = 68 and stage in ('decision', 'onboarding', 'won')
  ) then
    raise exception 'Opportunity 68 progressed past call_booked; leaving it alone';
  end if;

  update deals
     set stage = 'call_booked', stage_entered_at = now(), updated_at = now()
   where id = 68;
end $$;

-- ---------------------------------------------------------------------
-- Prove it
-- ---------------------------------------------------------------------
do $$
declare v_n int;
begin
  -- Dax: exactly one call, on the right attempt, at the stated instant.
  select count(*) into v_n from sales_calls where opportunity_id = 219;
  if v_n <> 1 then raise exception 'expected exactly 1 call on 219, found %', v_n; end if;

  if (select scheduled_at from sales_calls where opportunity_id = 219)
       <> timestamptz '2026-08-01 12:30 America/Denver' then
    raise exception 'Dax''s call is not at the owner-confirmed time';
  end if;
  if (select scheduled_on from sales_calls where opportunity_id = 219) <> date '2026-08-01' then
    raise exception 'Dax''s call was filed under the wrong day';
  end if;
  if (select resolution_requested_at from sales_calls where opportunity_id = 219) is null then
    raise exception 'Dax''s past call is not marked as an open question';
  end if;
  -- No decision was invented for him.
  if (select outcome is not null or prospect_decision is not null
        from deals where id = 219) then
    raise exception 'a sales decision was invented for Dax';
  end if;
  -- His earlier attempt is untouched.
  if (select stage from deals where id = 101) <> 'interested'
     or (select outcome from deals where id = 101) <> 'nurture'
     or (select count(*) from sales_calls where opportunity_id = 101) <> 1 then
    raise exception 'Dax''s earlier Opportunity was disturbed';
  end if;

  -- Aurelie: in call_booked, call still cancelled, no decision invented.
  if (select stage from deals where id = 68) <> 'call_booked' then
    raise exception 'Opportunity 68 did not reach call_booked';
  end if;
  if (select outcome is not null or prospect_decision is not null
        from deals where id = 68) then
    raise exception 'a sales decision was invented for Aurelie';
  end if;
  select count(*) into v_n from sales_calls
   where opportunity_id = 68 and status = 'cancelled';
  if v_n <> 1 then raise exception 'Aurelie''s cancelled call changed'; end if;
  select count(*) into v_n from deal_stage_events
   where opportunity_id = 68 and stage = 'call_booked';
  if v_n <> 1 then
    raise exception 'expected exactly one call_booked event on 68, found %', v_n;
  end if;

  -- The invariant, for every Opportunity still in play: no active one is
  -- left claiming a pre-call stage while holding a call that proves
  -- otherwise.
  select count(*) into v_n
    from deals d
   where public.deal_is_active(d.archived_at, d.stage, d.outcome)
     and d.stage in ('interested', 'application_received', 'approved')
     and exists (select 1 from sales_calls s where s.opportunity_id = d.id);
  if v_n <> 0 then
    raise exception '% active Opportunity(ies) still contradict their own call', v_n;
  end if;

  -- And no terminal Opportunity was reopened to get there.
  if (select count(*) from deals where outcome is not null) <> 80 then
    raise exception 'the number of ended Opportunities changed';
  end if;
end $$;

commit;
