-- The recovered submissions, attached to the right sales attempts.
--
-- Four repairs, each with its own evidence, and one deliberate refusal.
--
--   SOURCE IDENTITY   159 Applications came from a preserved Notion page
--                     and never recorded which one. The snapshot store
--                     already holds that mapping exactly, so it is copied
--                     onto the Application itself and proved unique.
--
--   RESPONSES         The exact questions and answers are read out of the
--                     preserved snapshots into application_responses, in
--                     source order, wording untouched. Nothing is fetched
--                     from Notion; nothing consults today's labels file.
--
--   WRONG-OFFER LINKS 14 Applications point at an Opportunity for a
--                     DIFFERENT programme — a Living Example submission
--                     attached to a Growing Yourself Up attempt. Every one
--                     of them has ZERO same-Offer Opportunity to move to,
--                     so the link is cleared rather than corrected. An
--                     unlinked Application is honest; a false one makes
--                     the drawer show one programme's answers under
--                     another's heading. No Opportunity is invented to
--                     give them somewhere to go.
--
--   UNLINKED          24 Applications have exactly one same-Contact,
--                     same-Offer Opportunity, and none of those
--                     Opportunities already carries an Application, so
--                     there is nothing to choose between and nothing to
--                     displace. The remaining 64 have no candidate at all
--                     and stay unlinked.
--
-- DAX KARA, left open by Slice 3, resolves without a judgement call. He
-- has two Living Example Applications and two Living Example
-- Opportunities, and each Application already points at its own:
--
--   41  submitted 2026-08-15 -> Opportunity 101, interested/nurture, ended
--   182 submitted 2026-08-21 -> Opportunity 219, application_received, live
--
-- Only one of those is current review work. His Task is attached to that
-- one. Nothing is guessed: the Offers agree, the links already existed,
-- and the live/terminal distinction decides it.
--
-- This repairs named production rows and asserts their exact state. It is
-- not replayed into an empty database; see replay-manifest.json.

begin;

-- ---------------------------------------------------------------------
-- 1. Durable source identity for the original 159
-- ---------------------------------------------------------------------
do $$
declare
  v_backfilled int;
  v_dupes int;
  v_covered int;
begin
  update public.applications a
     set source_page_id = s.notion_page_id,
         form_key = s.source_database_id,
         form_label = s.source_database_title
    from public.historical_application_source_snapshots s
   where s.application_id = a.id
     and s.notion_page_id is not null
     and not s.is_copy_artifact
     and a.source_page_id is null;
  get diagnostics v_backfilled = row_count;

  if v_backfilled <> 159 then
    raise exception 'expected to backfill 159 source page ids, backfilled %', v_backfilled;
  end if;

  -- The two already imported keep the value they arrived with; they only
  -- gain form provenance.
  update public.applications a
     set form_key = coalesce(a.form_key, s.source_database_id),
         form_label = coalesce(a.form_label, s.source_database_title)
    from public.historical_application_source_snapshots s
   where s.application_id = a.id and a.form_key is null;

  select count(*) into v_dupes from (
    select source_page_id from public.applications
     where source_page_id is not null
     group by source_page_id having count(*) > 1) z;
  if v_dupes <> 0 then
    raise exception '% source page id(s) are claimed by more than one Application', v_dupes;
  end if;

  select count(*) into v_covered from public.applications where source_page_id is not null;
  if v_covered <> 161 then
    raise exception 'expected all 161 Applications to carry a source page id, found %', v_covered;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. The exact questions and answers
-- ---------------------------------------------------------------------
do $$
declare
  v_snapshot record;
  v_rows int;
  v_total int := 0;
  v_apps int := 0;
begin
  for v_snapshot in
    select s.id
      from public.historical_application_source_snapshots s
     where s.application_id is not null
       and not s.is_copy_artifact
     order by s.id
  loop
    v_rows := public.materialize_application_responses(v_snapshot.id);
    v_total := v_total + v_rows;
    if v_rows > 0 then v_apps := v_apps + 1; end if;
  end loop;

  if v_apps <> 161 then
    raise exception 'expected responses for 161 Applications, wrote for %', v_apps;
  end if;
  if v_total = 0 then
    raise exception 'no responses were written';
  end if;

  -- Not one response may belong to a copy artifact or to the
  -- evidence-only source row.
  if exists (
    select 1 from public.application_responses r
      join public.historical_application_source_snapshots s on s.id = r.source_snapshot_id
     where s.is_copy_artifact or s.application_id is null
  ) then
    raise exception 'a copy artifact or evidence-only snapshot produced response rows';
  end if;

  raise notice 'materialised % response rows across % Applications', v_total, v_apps;
end $$;

-- ---------------------------------------------------------------------
-- 3. Clear the links that point at the wrong programme
-- ---------------------------------------------------------------------
do $$
declare
  v_cleared int;
  v_rescuable int;
begin
  -- Refuse to clear anything that could instead be corrected.
  select count(*) into v_rescuable
    from public.applications a
    join public.deals d on d.id = a.opportunity_id
   where a.offer_id is distinct from d.offer_id
     and (select count(*) from public.deals d2
           where d2.contact_id = a.contact_id and d2.offer_id = a.offer_id) > 0;
  if v_rescuable <> 0 then
    raise exception '% wrong-Offer Application(s) DO have a same-Offer Opportunity and should be relinked, not cleared', v_rescuable;
  end if;

  update public.applications a
     set opportunity_id = null
    from public.deals d
   where d.id = a.opportunity_id
     and a.offer_id is distinct from d.offer_id;
  get diagnostics v_cleared = row_count;

  if v_cleared <> 14 then
    raise exception 'expected to clear 14 wrong-Offer links, cleared %', v_cleared;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Attach the ones with exactly one home
-- ---------------------------------------------------------------------
do $$
declare
  v_linked int;
begin
  update public.applications a
     set opportunity_id = d.id
    from public.deals d
   where a.opportunity_id is null
     and d.contact_id = a.contact_id
     and d.offer_id = a.offer_id
     -- Exactly one candidate, and it is not already spoken for.
     and (select count(*) from public.deals d2
           where d2.contact_id = a.contact_id and d2.offer_id = a.offer_id) = 1
     and not exists (select 1 from public.applications a2
                      where a2.opportunity_id = d.id);
  get diagnostics v_linked = row_count;

  if v_linked <> 24 then
    raise exception 'expected to link 24 uniquely-matchable Applications, linked %', v_linked;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5. Dax Kara's review Task points at the submission it means
-- ---------------------------------------------------------------------
do $$
declare
  v_app record;
  v_task bigint;
begin
  -- The one Application that is genuinely current review work: pending,
  -- on a live Opportunity that is still at Application Received.
  select a.id, a.opportunity_id into v_app
    from public.applications a
    join public.deals d on d.id = a.opportunity_id
    join public.contacts c on c.id = a.contact_id
   where c.first_name = 'Dax' and c.last_name = 'Kara'
     and a.status = 'pending'
     and public.deal_is_active(d.archived_at, d.stage, d.outcome)
     and d.stage = 'application_received';

  if not found then
    raise exception 'Dax Kara has no Application awaiting review on a live attempt; state changed';
  end if;
  if v_app.id <> 182 or v_app.opportunity_id <> 219 then
    raise exception 'expected Dax''s current Application to be 182 on Opportunity 219, found % on %',
      v_app.id, v_app.opportunity_id;
  end if;

  select t.id into v_task
    from public.tasks t
    join public.contacts c on c.id = t.contact_id
   where c.first_name = 'Dax' and c.last_name = 'Kara'
     and t.type = 'review_application' and t.done_date is null;
  if not found then
    raise exception 'Dax Kara has no open review Task to attach';
  end if;

  update public.tasks
     set application_id = v_app.id, opportunity_id = v_app.opportunity_id
   where id = v_task;
end $$;

-- ---------------------------------------------------------------------
-- 6. Prove the whole picture
-- ---------------------------------------------------------------------
do $$
declare
  v_offer_mismatch int;
  v_contact_mismatch int;
  v_linked int;
  v_unlinked int;
  v_actionable_without_task int;
  v_tasks_unlinked int;
begin
  select count(*) into v_offer_mismatch
    from public.applications a join public.deals d on d.id = a.opportunity_id
   where a.offer_id is distinct from d.offer_id;
  select count(*) into v_contact_mismatch
    from public.applications a join public.deals d on d.id = a.opportunity_id
   where a.contact_id is distinct from d.contact_id;
  if v_offer_mismatch <> 0 or v_contact_mismatch <> 0 then
    raise exception 'after repair: % Offer and % Contact mismatch(es) remain',
      v_offer_mismatch, v_contact_mismatch;
  end if;

  select count(*) filter (where opportunity_id is not null),
         count(*) filter (where opportunity_id is null)
    into v_linked, v_unlinked from public.applications;
  -- 73 linked, minus the 14 cleared, plus the 24 attached.
  if v_linked <> 83 or v_unlinked <> 78 then
    raise exception 'expected 83 linked / 78 unlinked Applications, found % / %',
      v_linked, v_unlinked;
  end if;

  -- Every Application that IS current review work has exactly one task.
  select count(*) into v_actionable_without_task
    from public.applications a join public.deals d on d.id = a.opportunity_id
   where a.status = 'pending'
     and public.deal_is_active(d.archived_at, d.stage, d.outcome)
     and d.stage = 'application_received'
     and not exists (select 1 from public.tasks t
                      where t.type = 'review_application' and t.done_date is null
                        and t.application_id = a.id);
  if v_actionable_without_task <> 0 then
    raise exception '% actionable pending Application(s) have no review Task', v_actionable_without_task;
  end if;

  -- And no open review Task is left pointing at nothing.
  select count(*) into v_tasks_unlinked
    from public.tasks where type = 'review_application' and done_date is null
     and application_id is null;
  if v_tasks_unlinked <> 0 then
    raise exception '% open review Task(s) still name no Application', v_tasks_unlinked;
  end if;

  -- The 99 pending Applications were NOT turned into work.
  if (select count(*) from public.tasks
       where type = 'review_application' and done_date is null) <> 2 then
    raise exception 'review Task count changed; historical pending Applications must not become a backlog';
  end if;
end $$;

commit;
