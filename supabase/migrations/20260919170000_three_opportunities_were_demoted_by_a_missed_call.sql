-- MAIN-ONLY. Three real Opportunities, put back where the sale reached.
--
-- Listed in replay-manifest.json: it repairs named production records and
-- owns no schema. The rule that demoted them is removed structurally in
-- 20260919160000, which replays on its own.
--
-- Opportunity 139, 187 and 189 each genuinely reached `call_booked` — the
-- stage event is there — and each was then written back to `approved` by
-- the old "a cancelled or missed call un-books the meeting" rule. None of
-- them was decided by a human in between: outcome is null, exit_reason is
-- null, prospect_decision is null, and `approved` is the last stage event
-- on each. They are all still active.
--
-- Two other things are deliberately NOT repaired here:
--
--   Opportunity 68 has a cancelled call but NEVER reached call_booked —
--   its stage history runs interested -> approved, so there is no backward
--   move to undo and putting it in Call Booked would invent a stage it
--   never had. It stays in Approved, and the derived
--   needsNextSalesStep condition surfaces its cancelled call regardless of
--   stage, which is the point of deriving it.
--
--   Opportunities 86, 121 and 159 were demoted by the same rule but have
--   since been given outcome = 'lost'. That is a recorded terminal answer,
--   and a repair that reopened it would overwrite a human decision with a
--   guess. They stay exactly as they are.
--
-- Sales Call facts are untouched: the no-shows are still no-shows, the
-- cancellation is still cancelled, and every attendance timestamp stands.
-- The stage events written by this repair are the honest record that the
-- stage was corrected now.

begin;

do $$
declare
  v_expected bigint[] := array[139, 187, 189];
  v_id bigint;
  v_moved int;
  v_total int := 0;
begin
  foreach v_id in array v_expected loop
    -- Every condition restated per row, so a row that has drifted since
    -- this was written is skipped rather than forced.
    if not exists (
      select 1 from deals d
       where d.id = v_id
         and d.stage = 'approved'
         and d.outcome is null
         and d.exit_reason is null
         and d.prospect_decision is null
         and d.archived_at is null
    ) then
      raise exception 'Opportunity % is no longer the case this repair was written for', v_id;
    end if;

    if not exists (
      select 1 from deal_stage_events e
       where e.opportunity_id = v_id and e.stage = 'call_booked'
    ) then
      raise exception 'Opportunity % has no evidence it ever reached call_booked', v_id;
    end if;

    -- The demotion has to be the LAST thing that happened to the stage.
    if (select e.stage from deal_stage_events e
         where e.opportunity_id = v_id
         order by e.entered_at desc, e.id desc limit 1) <> 'approved' then
      raise exception 'Opportunity % moved again after the demotion; leaving it alone', v_id;
    end if;

    -- And there has to be a cancelled or missed call to explain it.
    if not exists (
      select 1 from sales_calls s
       where s.opportunity_id = v_id
         and (s.status = 'cancelled' or s.attendance = 'no_show')
    ) then
      raise exception 'Opportunity % has no cancelled or missed call to explain the demotion', v_id;
    end if;

    update deals
       set stage = 'call_booked',
           stage_entered_at = now(),
           updated_at = now()
     where id = v_id;
    get diagnostics v_moved = row_count;
    v_total := v_total + v_moved;
  end loop;

  if v_total <> 3 then
    raise exception 'expected to repair exactly 3 Opportunities, repaired %', v_total;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Prove what this database now says
-- ---------------------------------------------------------------------
do $$
declare
  v_n int;
  v_calls int;
begin
  select count(*) into v_n from deals
   where id in (139, 187, 189) and stage = 'call_booked'
     and public.deal_is_active(archived_at, stage, outcome);
  if v_n <> 3 then
    raise exception 'expected 3 active Opportunities in call_booked, found %', v_n;
  end if;

  -- 68 stays where it was: no invented stage.
  if (select stage from deals where id = 68) <> 'approved' then
    raise exception 'Opportunity 68 was moved, and nothing here should have moved it';
  end if;

  -- The three terminal ones keep their recorded answer.
  select count(*) into v_n from deals where id in (86, 121, 159) and outcome = 'lost';
  if v_n <> 3 then
    raise exception 'a terminal outcome was disturbed: expected 3 lost, found %', v_n;
  end if;

  -- Call facts intact: two no-shows and one cancellation across the three.
  select count(*) into v_calls from sales_calls
   where opportunity_id in (139, 187) and attendance = 'no_show';
  if v_calls <> 2 then
    raise exception 'expected the 2 no-shows to be untouched, found %', v_calls;
  end if;
  select count(*) into v_calls from sales_calls
   where opportunity_id = 189 and status = 'cancelled';
  if v_calls <> 1 then
    raise exception 'expected the cancellation to be untouched, found %', v_calls;
  end if;

  -- Nothing gained a booked call out of this: the stage now records how
  -- far the sale got, not that a meeting is in the calendar.
  select count(*) into v_calls from sales_calls
   where opportunity_id in (139, 187, 189) and status = 'booked';
  if v_calls <> 0 then
    raise exception 'a call was resurrected as booked, which this repair must never do';
  end if;
end $$;

commit;
