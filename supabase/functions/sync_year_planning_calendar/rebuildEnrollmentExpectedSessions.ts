import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

export type RebuildResult = {
  enrollmentsRebuilt: number;
  assignmentsCreated: number;
  slotsRenumbered: number;
  slotsRetiredWithHistory: number;
  slotsDiscarded: number;
};

// Recompute every live Living Example container's Session Week schedule
// from the calendar this run just refreshed.
//
// The algorithm is NOT reimplemented here. It lives in one place —
// public.rebuild_all_expected_sessions(), migration 20260921150000 —
// because a Start Date change has to rebuild the schedule inside the
// same transaction as the change, which only a database function can do.
// Two copies of the session-week rule is exactly the class of bug this slice
// has spent its whole life removing.
//
// Idempotent by construction: the same Start Dates and the same calendar
// always produce the same schedule, and a rerun reports zero changes.
export const rebuildEnrollmentExpectedSessions =
  async (): Promise<RebuildResult> => {
    const { data, error } = await supabaseAdmin.rpc(
      "rebuild_all_expected_sessions",
    );
    if (error) throw new Error(error.message);

    const row = Array.isArray(data) ? data[0] : data;
    return {
      enrollmentsRebuilt: row?.enrollments_rebuilt ?? 0,
      assignmentsCreated: row?.slots_inserted ?? 0,
      slotsRenumbered: row?.slots_renumbered ?? 0,
      slotsRetiredWithHistory: row?.slots_retired_with_history ?? 0,
      slotsDiscarded: row?.slots_discarded ?? 0,
    };
  };
