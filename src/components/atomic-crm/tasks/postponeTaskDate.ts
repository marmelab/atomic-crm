import { getDenverDateString } from "../dashboard/artOracle/selectDailyArtwork";
import { dateOnlyToTimestamp } from "../misc/dateOnlyToTimestamp";

// Small polish/cleanup slice: Task.tsx's postpone-tomorrow/postpone-next-
// week actions previously computed "tomorrow" as `Date.now() + 24h` and
// stored only the UTC calendar date's first 10 characters straight into
// tasks.due_date (a timestamptz) — the same class of bug already fixed in
// followUpTask.ts for deals.follow_up_date: a bare date implies UTC
// midnight, which renders one day early for any viewer west of UTC, and
// "add 24h in UTC" isn't even the right "tomorrow" for a viewer/business
// anchored to America/Denver in the first place.
//
// "Tomorrow"/"next week" here mean the CRM's established America/Denver
// business-day (completedTodaySelection.ts's own day-boundary logic),
// not the viewer's own system timezone. Explicit `now` parameter (never
// `new Date()` internally) for deterministic, timer-free testing — see
// completedTodaySelection.ts's own header for why (vitest-browser-react's
// render hangs under vi.useFakeTimers() in this codebase).
export const computePostponeDueDate = (
  now: Date,
  daysAhead: number,
): string => {
  const [year, month, day] = getDenverDateString(now).split("-").map(Number);
  // Calendar-field arithmetic (not millisecond arithmetic): JS normalizes
  // an out-of-range day (e.g. day=32) into the correct following month/
  // year on its own, immune to DST wall-clock drift.
  const target = new Date(year!, month! - 1, day! + daysAhead);
  const isoDate = [
    target.getFullYear(),
    String(target.getMonth() + 1).padStart(2, "0"),
    String(target.getDate()).padStart(2, "0"),
  ].join("-");
  return dateOnlyToTimestamp(isoDate);
};
