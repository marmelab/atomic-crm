-- Run the rebuild the previous two migrations made possible.
--
-- 20260921140000 corrected eighteen Start Weeks to what Leif actually
-- stated. 20260921150000 then installed the rebuild — the function, and a
-- trigger that rebuilds an Enrollment's derived schedule whenever its
-- start date moves.
--
-- In that order, the trigger cannot have fired for those corrections: it
-- did not exist yet when they were made. And nothing calls the full
-- rebuild. So the deployment left `enrollments.start_date` holding the
-- owner's answer while `enrollment_expected_sessions` still held the
-- schedule derived from the imported dates — two timelines for one
-- Enrollment, which is the exact condition this slice exists to remove.
--
-- It was caught by checking production after the push rather than by any
-- test, and it could not have been caught by a clean-room replay: with no
-- Enrollments to rebuild, a missing rebuild and a completed one look
-- identical.
--
-- Rehearsed against production first, inside a transaction that was rolled
-- back:
--
--   live slots      197 -> 198
--   slots changed   35
--   client_sessions 208 -> 208   (attendance untouched)
--   cadence issues    2 -> 2     (owner classifications preserved)
--
-- The rebuild's own guarantees — actual sessions never touched, owner
-- cadence decisions preserved and re-hung on their own week, a calendar
-- too short left short rather than invented — are proven case by case
-- against real Postgres in e2e/sessionScheduleRebuild.spec.ts.

select public.rebuild_all_expected_sessions();

-- Coherence, asserted as a fixed point rather than restated.
--
-- Re-deriving something already derived must change nothing. If a second
-- pass moves a slot, the schedule is not a function of its authorities and
-- the answer depends on how many times it was asked — which would make
-- every later rebuild, including the one behind "Sync Calendar", a source
-- of drift rather than of agreement.
do $$
declare
  v_moved bigint;
begin
  create temporary table schedule_fixed_point on commit drop as
    select enrollment_id, ordinal, source_window_id
      from public.enrollment_expected_sessions
     where retired_at is null;

  perform public.rebuild_all_expected_sessions();

  select count(*) into v_moved from (
    select enrollment_id, ordinal, source_window_id
      from public.enrollment_expected_sessions where retired_at is null
    except
    select enrollment_id, ordinal, source_window_id from schedule_fixed_point
  ) d;

  if v_moved > 0 then
    raise exception
      'rebuilding an already-rebuilt schedule moved % slot(s); the schedule is not a function of its authorities', v_moved;
  end if;
end $$;
