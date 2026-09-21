import { getSupabaseClient } from "../providers/supabase/supabase";

// "Sync Calendar" — refresh Year Tracking.
//
// Deliberately the same shape as deals/syncStripe.ts: the browser holds no
// credential, supabase.functions.invoke carries the signed-in user's own
// JWT, and the Edge Function that already owns this integration does the
// work. There is exactly one Google Calendar synchronisation path in this
// repository and this calls it — sync_year_planning_calendar, the same
// function the scheduled job runs.
//
// Re-running it is safe. Every `1:1s` event upserts by (calendar id, event
// id) against a unique index, so a second run resolves to the same row
// rather than a duplicate week; an event that has vanished from the
// calendar is soft-deleted rather than removed, because a cadence issue
// may still reference it. The session-week assignment pass that follows is
// append-only for the same reason.
export type SyncCalendarResult =
  | {
      status: "ok";
      // Weeks the calendar now holds, and how many were newly seen.
      windowsUpserted: number;
      windowsDeleted: number;
      assignmentsCreated: number;
    }
  | { status: "error"; message: string };

export const syncYearTracking = async (): Promise<SyncCalendarResult> => {
  const { data, error } = await getSupabaseClient().functions.invoke<{
    windowsUpserted?: number;
    windowsDeleted?: number;
    assignmentsCreated?: number;
  }>("sync_year_planning_calendar", { method: "POST", body: {} });

  if (error) {
    return {
      status: "error",
      message:
        // The calendar not answering is a real, reportable state — never
        // silently leaving the old weeks on screen as though they were
        // fresh.
        error.message ?? "The Year Tracking calendar could not be reached.",
    };
  }

  return {
    status: "ok",
    windowsUpserted: data?.windowsUpserted ?? 0,
    windowsDeleted: data?.windowsDeleted ?? 0,
    assignmentsCreated: data?.assignmentsCreated ?? 0,
  };
};
