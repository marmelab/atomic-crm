-- "Committed" becomes "Onboarding", because that is what the stage is for.
--
-- Committed described a promise to pay, and the board treated it as the
-- last thing before money arrived. The real business model is different:
-- when somebody says yes the SALE IS WON immediately and never moves
-- again, and what follows is setup work — contract, access, and a payment
-- arrangement that exists. The Opportunity leaves the board when that work
-- is finished, not when the last installment clears.
--
-- Nothing is lost here. Every Opportunity keeps its identity and its
-- history; the stage it sits at, and every stage event that ever recorded
-- it, are renamed together so the transition log still reads as one story.
--
-- Worth knowing about the fourteen rows this touches: all fourteen are
-- historical imports with a Stripe customer, no payment, no recorded
-- decision and no Enrollment — people who began a checkout between
-- 2024-11 and 2026-06 and never completed it. They are genuinely
-- "post-sale setup never finished", so the new name fits them, but they
-- have been dormant for up to two years and need a decision from Leif
-- rather than a migration inventing one.

begin;

do $$
declare
  v_deals int;
  v_events int;
begin
  select count(*) into v_deals from public.deals where stage = 'committed';
  select count(*) into v_events from public.deal_stage_events where stage = 'committed';

  update public.deals set stage = 'onboarding' where stage = 'committed';
  update public.deal_stage_events set stage = 'onboarding' where stage = 'committed';

  raise notice 'renamed % Opportunities and % stage events', v_deals, v_events;

  if exists (select 1 from public.deals where stage = 'committed') then
    raise exception 'some Opportunities are still at the committed stage';
  end if;
  if exists (select 1 from public.deal_stage_events where stage = 'committed') then
    raise exception 'some stage events still record the committed stage';
  end if;
end $$;

commit;
