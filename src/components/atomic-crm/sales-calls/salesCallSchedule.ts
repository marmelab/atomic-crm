import { formatTimestampWithTimeString } from "../deals/dealUtils";
import type { SalesCall } from "../types";

// How to READ a Sales Call's schedule, whatever its precision.
//
// A historical call can be known to have happened on a particular day with
// no record anywhere of the clock time — no Acuity appointment, no calendar
// event, nothing. Those rows carry the date and NULL timestamps, because
// putting midnight or noon in the column would state a time the source
// never contained, and a reader cannot tell an invented time from a real
// one. So the precision is explicit and these helpers honour it.

type ScheduleLike = Pick<
  SalesCall,
  | "scheduled_on"
  | "schedule_precision"
  | "scheduled_at"
  | "original_scheduled_at"
>;

// Every row that predates the precision column is a real appointment.
export const isDateOnly = (call: ScheduleLike): boolean =>
  (call.schedule_precision ?? "exact") === "date_only";

// The date, for ordering and for grouping. Present for every call.
export const scheduleDate = (call: ScheduleLike): string | null =>
  call.scheduled_on ??
  (call.scheduled_at ? call.scheduled_at.slice(0, 10) : null);

// Human-readable, and deliberately WITHOUT a time when none is known —
// never "12:00 AM", which is the placeholder this whole model exists to
// avoid.
export const formatSalesCallSchedule = (call: ScheduleLike): string => {
  if (!isDateOnly(call) && call.scheduled_at) {
    return formatTimestampWithTimeString(call.scheduled_at);
  }
  const date = scheduleDate(call);
  if (!date) return "Date not recorded";
  // Parsed as UTC noon so a date-only value cannot slide a day in a
  // west-of-UTC timezone.
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// For the places that want to say so out loud.
export const formatSalesCallScheduleWithPrecision = (
  call: ScheduleLike,
): string =>
  isDateOnly(call)
    ? `${formatSalesCallSchedule(call)} · time unknown`
    : formatSalesCallSchedule(call);
