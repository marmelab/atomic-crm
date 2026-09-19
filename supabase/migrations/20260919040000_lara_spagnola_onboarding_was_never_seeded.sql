-- Which of this database's Enrollments the CRM is supposed to know about,
-- and the one whose checklist went missing.
--
-- Twenty-eight of the thirty-three Enrollments were written by the
-- historical importer, as already-running clients whose onboarding
-- happened before the CRM tracked any of it. Every one of them carries an
-- enrollment-level historical_import_records row, and every one has zero
-- checklist items. That provenance row — not the empty checklist, and not
-- a date — is the evidence, so the classification is decided by evidence
-- that was recorded at the time rather than by inference now.
--
-- LARA SPAGNOLA is the single Enrollment that is neither imported nor
-- seeded, and the reason is worth writing down, because it looked like a
-- live bug and is not one.
--
-- Her Enrollment (65) was created at 2026-09-17 18:12:11, the same second
-- her Opportunity's `won` stage event was written, with entered_at set to
-- the historical 2026-08-14. It has ZERO enrollment_status_events. Only
-- one thing suppresses that trigger — app.migration_mode — so her row was
-- inserted by a corrective import run, in migration mode, which is exactly
-- the path that deliberately does not seed checklists. The run then did
-- not write her an enrollment provenance row, so she reads as live while
-- having been created as historical.
--
-- The live Won path was tested directly against this database, rolled
-- back, before anything here was written: a new Opportunity moved to Won
-- produced an Enrollment with 5 items, 5 Tasks and 1 status event, and
-- re-saving Won left all three unchanged. It is not broken, and Lara is
-- not evidence that it is.
--
-- So she is TRACKED. Her onboarding has not happened yet — she is a
-- current client sitting at status 'onboarding' — and calling her
-- legacy_untracked would say her setup happened outside the CRM, which is
-- false. She gets the checklist the Won path would have given her, as
-- INCOMPLETE: no completion evidence exists for her anywhere, and the
-- owner-confirmed onboarding facts recorded for Denise, Ava, Linda and
-- Emma do not mention her. Nothing here is marked done.
--
-- This repairs specific production rows and asserts their exact state. It
-- is not replayed into an empty database; see replay-manifest.json.

begin;

-- ---------------------------------------------------------------------
-- 1. Classify by recorded provenance, not by inference
-- ---------------------------------------------------------------------
do $$
declare
  v_legacy int;
  v_tracked int;
  v_legacy_with_items int;
begin
  update public.enrollments e
     set onboarding_tracking = 'legacy_untracked',
         updated_at = now()
   where exists (
     select 1 from public.historical_import_records r
      where r.entity_table = 'enrollments' and r.entity_id = e.id
   );
  get diagnostics v_legacy = row_count;

  if v_legacy <> 28 then
    raise exception 'expected 28 imported Enrollments, classified %', v_legacy;
  end if;

  select count(*) into v_tracked from public.enrollments
   where onboarding_tracking = 'tracked';
  if v_tracked <> 5 then
    raise exception 'expected 5 tracked Enrollments, found %', v_tracked;
  end if;

  -- An imported Enrollment that DOES carry checklist items would mean the
  -- provenance rule is the wrong rule, so it is checked rather than
  -- assumed.
  select count(*) into v_legacy_with_items
    from public.enrollments e
   where e.onboarding_tracking = 'legacy_untracked'
     and exists (select 1 from public.enrollment_onboarding_items i
                  where i.enrollment_id = e.id);
  if v_legacy_with_items <> 0 then
    raise exception '% legacy_untracked Enrollment(s) carry checklist items; provenance is not the right rule', v_legacy_with_items;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Lara's checklist, seeded incomplete
-- ---------------------------------------------------------------------
do $$
declare
  v record;
  v_seeded int;
  v_required int;
  v_done int;
begin
  select e.*, d.offer_id, d.stage into v
    from public.enrollments e
    join public.deals d on d.id = e.opportunity_id
   where e.id = 65;
  if not found then
    raise exception 'Enrollment 65 does not exist';
  end if;

  -- Refuse unless she is in the exact state this was written for.
  if v.status is distinct from 'onboarding' then
    raise exception 'Enrollment 65 is %, expected onboarding — state changed', v.status;
  end if;
  if v.stage is distinct from 'won' then
    raise exception 'Enrollment 65 belongs to an Opportunity at %, expected won', v.stage;
  end if;
  if v.onboarding_tracking is distinct from 'tracked' then
    raise exception 'Enrollment 65 is %, expected tracked', v.onboarding_tracking;
  end if;
  if exists (select 1 from public.enrollment_onboarding_items where enrollment_id = 65) then
    raise exception 'Enrollment 65 already has checklist items; this repair assumes none';
  end if;

  v_seeded := public.seed_enrollment_onboarding(65);

  -- Growing Yourself Up states five active required templates. If that
  -- number changes, the repair should be re-read rather than silently
  -- seeding something else.
  if v_seeded <> 5 then
    raise exception 'expected to seed 5 onboarding items for Enrollment 65, seeded %', v_seeded;
  end if;

  select count(*) filter (where is_required),
         count(*) filter (where status = 'done')
    into v_required, v_done
    from public.enrollment_onboarding_items where enrollment_id = 65;

  if v_required <> 5 then
    raise exception 'Enrollment 65 has % required items, expected 5', v_required;
  end if;
  -- Nothing is known to be finished, so nothing may say it is.
  if v_done <> 0 then
    raise exception '% of Lara''s items were marked done; no completion evidence exists', v_done;
  end if;

  if (select count(*) from public.tasks where enrollment_id = 65) <> 5 then
    raise exception 'expected 5 onboarding Tasks for Enrollment 65, found %',
      (select count(*) from public.tasks where enrollment_id = 65);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. The integrity view must now be empty
-- ---------------------------------------------------------------------
do $$
declare
  v_broken text;
begin
  select string_agg(enrollment_id::text, ', ' order by enrollment_id)
    into v_broken from public.enrollments_missing_onboarding;
  if v_broken is not null then
    raise exception 'tracked Enrollments still have no required onboarding items: %', v_broken;
  end if;
end $$;

commit;
