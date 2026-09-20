// How a week window is said to a human — the Deno half.
//
// The calendar sync runs here, and it is what WROTE the ugly labels into
// Task text in the first place, so this is the copy that actually had the
// bug. Mirrors src/components/atomic-crm/sessions/cadenceWeekLabel.ts
// exactly; the two test files pin the same cases and the same expected
// strings, which is how drift between them gets caught. Edge Functions
// never import from src/, hence two files rather than one.
//
// Pete Bassett's Task read
//
//   Pete Bassett · No session booked for week of 2026-09-13–2026-09-16
//
// which is a machine talking. It should read "Sep 13–16". The ugly form
// was never a rendering problem: the calendar sync's detection pass built
// the label out of raw ISO strings and stored it in the Task text, so the
// words were already wrong by the time anything displayed them. This
// module is the one place the detection pass decides.
//
// window_end is EXCLUSIVE — Google Calendar's own all-day semantics — so
// the last day actually inside a window is the day before it. Every
// calculation here stays in calendar-date arithmetic and never builds a
// Date from a date string, because doing that parses as UTC midnight and
// slides a day backwards for anyone west of Greenwich, which is everyone
// using this CRM.

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const CRM_TIME_ZONE = "America/Denver";

type CalendarDate = { year: number; month: number; day: number };

const parseDay = (value: string | null | undefined): CalendarDate | null => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
};

const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/** The day before this one, in calendar arithmetic only. */
const previousDay = ({ year, month, day }: CalendarDate): CalendarDate => {
  if (day > 1) return { year, month, day: day - 1 };
  if (month > 1) {
    return { year, month: month - 1, day: daysInMonth(year, month - 1) };
  }
  return { year: year - 1, month: 12, day: 31 };
};

/** The year it is where the CRM lives, not where the server is. */
export const crmCurrentYear = (now: number | Date = Date.now()): number =>
  Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: CRM_TIME_ZONE,
      year: "numeric",
    }).format(now instanceof Date ? now : new Date(now)),
  );

const monthDay = ({ month, day }: CalendarDate): string =>
  `${MONTHS[month - 1]} ${day}`;

/**
 * "Sep 13–16", "Sep 28–Oct 2", "Jan 30–Feb 3, 2027".
 *
 * The year appears only when it earns its place: when the range crosses
 * one, or when the window is not in the year it is being read in. A
 * label for this week does not need telling you it is this year.
 *
 * `windowEnd` is exclusive. A window covering a single day prints that
 * day once rather than "Sep 13–13".
 */
export const formatCadenceWeekLabel = (
  windowStart: string | null | undefined,
  windowEnd: string | null | undefined,
  options: { now?: number | Date } = {},
): string => {
  const start = parseDay(windowStart);
  const endExclusive = parseDay(windowEnd);

  // Nothing to say is said as nothing, never as "Invalid Date".
  if (!start && !endExclusive) return "";
  if (!start || !endExclusive) {
    const only = start ?? previousDay(endExclusive!);
    return withYear(only, only, options.now);
  }

  const last = previousDay(endExclusive);

  // An end on or before the start is not a range. Say the day it has.
  if (
    last.year < start.year ||
    (last.year === start.year &&
      (last.month < start.month ||
        (last.month === start.month && last.day <= start.day)))
  ) {
    return withYear(start, start, options.now);
  }

  return withYear(start, last, options.now);
};

const withYear = (
  start: CalendarDate,
  last: CalendarDate,
  now: number | Date | undefined,
): string => {
  const currentYear = crmCurrentYear(now ?? Date.now());
  const crossesYears = start.year !== last.year;
  const isThisYear = start.year === currentYear && last.year === currentYear;

  if (crossesYears) {
    // Both ends carry a year, because neither is implied by the other.
    return `${monthDay(start)}, ${start.year}–${monthDay(last)}, ${last.year}`;
  }

  const sameDay =
    start.month === last.month &&
    start.day === last.day &&
    start.year === last.year;
  // Within one month the month is said once: "Sep 13–16".
  const range = sameDay
    ? monthDay(start)
    : start.month === last.month
      ? `${monthDay(start)}–${last.day}`
      : `${monthDay(start)}–${monthDay(last)}`;

  return isThisYear ? range : `${range}, ${start.year}`;
};

export const formatWindowWeekLabel = (
  window: {
    window_start: string | null | undefined;
    window_end: string | null | undefined;
  },
  options: { now?: number | Date } = {},
): string =>
  formatCadenceWeekLabel(window.window_start, window.window_end, options);
