// How long an Application may sit before it becomes an exception.
//
// Leif reviews applications within three days. That is a promise measured
// in days on a calendar, not in hours on a clock: an application submitted
// at 11pm has not used up a day of anyone's attention, and one submitted
// at 8am has not had a full day by lunchtime. Counting 72 hours would make
// both of those wrong, and would move the deadline by an hour twice a year
// when the clocks change.
//
// So the unit is the CALENDAR DAY in the CRM's own timezone.
//
//   day 0    the day it was submitted, however late in the day
//   day 1-3  three full days to review it
//   day 4+   overdue
//
// Everything here is derived from those two dates. Nothing uses the time
// of day, so DST cannot shift a deadline: a calendar date has no offset.
export const CRM_TIMEZONE = "America/Denver";

// Three full review days after the day it arrived.
export const REVIEW_WINDOW_DAYS = 3;

// The calendar date in the CRM's timezone, as YYYY-MM-DD.
//
// Uses the Intl calendar rather than arithmetic on epoch milliseconds,
// which is what makes this correct across DST: "what day is it in Denver"
// is a question about a calendar, and adding 24-hour blocks answers a
// different one.
export const toCrmDateKey = (value: Date | string): string => {
  const date = typeof value === "string" ? new Date(value) : value;
  // en-CA renders ISO-ordered YYYY-MM-DD, which sorts and subtracts
  // correctly as a plain string.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CRM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

// Whole days between two CRM calendar dates.
//
// Both are midnight-anchored UTC instants built from the date parts, so
// the subtraction counts calendar days and never inherits an offset.
const daysBetween = (fromKey: string, toKey: string): number => {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000,
  );
};

export type ReviewTiming =
  | { state: "within"; daysElapsed: number; daysRemaining: number }
  | { state: "overdue"; daysElapsed: number; daysOverdue: number };

// Where an Application sits against the three-day promise.
export const reviewTiming = (
  submittedAt: Date | string,
  now: Date | string = new Date(),
): ReviewTiming => {
  const daysElapsed = daysBetween(toCrmDateKey(submittedAt), toCrmDateKey(now));

  if (daysElapsed <= REVIEW_WINDOW_DAYS) {
    return {
      state: "within",
      daysElapsed,
      daysRemaining: REVIEW_WINDOW_DAYS - daysElapsed,
    };
  }
  return {
    state: "overdue",
    daysElapsed,
    daysOverdue: daysElapsed - REVIEW_WINDOW_DAYS,
  };
};

// The last calendar date on which reviewing it is still on time.
export const reviewDeadlineDateKey = (submittedAt: Date | string): string => {
  const [y, m, d] = toCrmDateKey(submittedAt).split("-").map(Number);
  const deadline = new Date(Date.UTC(y, m - 1, d + REVIEW_WINDOW_DAYS));
  return deadline.toISOString().slice(0, 10);
};

// What the row says about its own timing. Never a raw timestamp: "2 days
// remaining" is the thing Leif acts on, and a date he has to subtract from
// today is not.
export const describeReviewTiming = (timing: ReviewTiming): string => {
  if (timing.state === "within") {
    if (timing.daysRemaining === 0) return "Due today";
    if (timing.daysRemaining === 1) return "1 day remaining";
    return `${timing.daysRemaining} days remaining`;
  }
  if (timing.daysOverdue === 1) return "Overdue by 1 day";
  return `Overdue by ${timing.daysOverdue} days`;
};
