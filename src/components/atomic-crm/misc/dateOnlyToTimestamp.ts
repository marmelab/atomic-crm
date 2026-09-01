// Converts a bare "YYYY-MM-DD" calendar date (no time component) into a
// full ISO timestamp that is safe to store in a timestamptz column and
// display correctly for any real-world viewer timezone. `new
// Date("2026-09-05")` is parsed as UTC midnight, which renders as the
// WRONG calendar day (e.g. "Sep 4") for any viewer west of UTC — the bug
// originally found and fixed in sales-calls/followUpTask.ts for
// deals.follow_up_date -> tasks.due_date. Constructing at LOCAL NOON
// instead sidesteps it: noon local is far enough from both UTC day
// boundaries that no real-world timezone offset can shift the calendar
// date on either the writing or the reading end.
//
// The single, shared "bare date -> safe timestamp" conversion — reused by
// followUpTask.ts and tasks/postponeTaskDate.ts rather than each keeping
// its own copy of the same trick.
export const dateOnlyToTimestamp = (isoDate: string): string => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year!, month! - 1, day!, 12, 0, 0).toISOString();
};
