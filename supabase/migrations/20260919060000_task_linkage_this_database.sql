-- What the linkage rules actually resolved in this database, asserted.
--
-- 20260919050000 links Tasks to their Opportunity by rule — a call names
-- its Opportunity, and a Contact with exactly one Opportunity leaves
-- nothing to choose between. Rules are the right shape for a migration
-- that has to rebuild anywhere. They say nothing about whether the answer
-- was right HERE, which is what this checks.
--
-- Four of the twelve open Tasks resolved:
--
--   153  resolve sales call   via call 108 -> Opportunity 139
--   158  follow up Gil Lelli  sole Opportunity
--    29  sales call, Sarah Henke  sole Opportunity
--   161  review Courtney Foregger's application  sole Application
--
-- One deliberately did not. DAX KARA has TWO Applications and TWO
-- Opportunities, and his review Task says only "Review Dax Kara's
-- application". Nothing records which one. A rule that picked the earlier,
-- or the active one, would be inventing the answer and would route Leif to
-- a specific Application on no evidence, so his Task keeps a NULL
-- opportunity_id and application_id and is surfaced as an open question
-- rather than quietly resolved.
--
-- The remaining seven open Tasks are Enrollment-scoped (Lara's five
-- onboarding steps, two cadence weeks) and have no Opportunity by nature.
--
-- This asserts production facts and is not replayed into an empty
-- database; see replay-manifest.json.

begin;

do $$
declare
  v_linked int;
  v_dax int;
  v_open int;
begin
  select count(*) into v_open from public.tasks where done_date is null;
  if v_open <> 12 then
    raise exception 'expected 12 open Tasks, found % — the population changed', v_open;
  end if;

  select count(*) into v_linked
    from public.tasks
   where done_date is null and opportunity_id is not null;
  if v_linked <> 4 then
    raise exception 'expected 4 open Tasks linked to an Opportunity, found %', v_linked;
  end if;

  -- Each of the four, by the route that produced it.
  if (select opportunity_id from public.tasks where id = 153) is distinct from 139 then
    raise exception 'Task 153 should name Opportunity 139 via its call, got %',
      coalesce((select opportunity_id::text from public.tasks where id = 153), 'NULL');
  end if;
  if (select opportunity_id from public.tasks where id = 158) is null then
    raise exception 'Task 158 (Gil Lelli follow-up) should name his sole Opportunity';
  end if;
  if (select opportunity_id from public.tasks where id = 29) is null then
    raise exception 'Task 29 (Sarah Henke sales call) should name her sole Opportunity';
  end if;
  if (select application_id from public.tasks where id = 161) is null then
    raise exception 'Task 161 should name Courtney Foregger''s sole Application';
  end if;

  -- And the one that must stay honest about not knowing.
  select count(*) into v_dax
    from public.tasks
   where id = 162 and opportunity_id is null and application_id is null;
  if v_dax <> 1 then
    raise exception 'Task 162 (Dax Kara) was assigned an Application or Opportunity; he has two of each and nothing says which';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- The projection rules must not have disturbed the work itself
-- ---------------------------------------------------------------------
do $$
declare
  v_lara int;
  v_lara_open int;
begin
  select count(*), count(*) filter (where done_date is null)
    into v_lara, v_lara_open
    from public.tasks where enrollment_id = 65 and type = 'onboarding_item';

  if v_lara <> 5 or v_lara_open <> 5 then
    raise exception 'Lara Spagnola should have 5 open onboarding Tasks, found % (% open)',
      v_lara, v_lara_open;
  end if;

  if exists (select 1 from public.enrollment_onboarding_items
              where enrollment_id = 65 and status = 'done') then
    raise exception 'an onboarding item was marked done for Lara; no completion evidence exists';
  end if;
end $$;

commit;
