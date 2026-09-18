import type { Enrollment } from "../types";

// Whether somebody is a client RIGHT NOW is a question about dates, not
// about a status column.
//
// Daniel Alexander appeared under Current Clients with a container that
// starts on 8 November — seven weeks away. His Enrollment status is
// "active", and status alone was the whole classification, so "we have
// agreed and set this up" was being read as "this is happening now". Leif
// cannot plan around a Current list that includes people he has not
// started working with.
//
// So the four inputs the question actually depends on are all used:
// start_date, end_date, the terminal statuses, and today.
export type EnrollmentPhase = "upcoming" | "current" | "past";

// completed / withdrawn / ended are all historically finished, however
// differently they got there — the row's own status badge is what
// distinguishes someone who finished from someone who left.
const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  "completed",
  "withdrawn",
  "ended",
]);

export const classifyEnrollment = (
  enrollment: Pick<Enrollment, "status" | "start_date" | "end_date">,
  today: string = toDateKey(new Date()),
): EnrollmentPhase => {
  // A terminal status is decisive regardless of dates: somebody who
  // withdrew last week is not "current" because their container would
  // still have been running.
  if (TERMINAL_STATUSES.has(enrollment.status)) return "past";

  // A container whose end date has passed is finished in substance even if
  // nobody has recorded the terminal status yet.
  if (enrollment.end_date && enrollment.end_date < today) return "past";

  // Not started yet. Includes onboarding — agreeing terms and setting
  // somebody up is real work, but it is not the programme running.
  if (enrollment.start_date && enrollment.start_date > today) {
    return "upcoming";
  }

  // Started and not finished. An enrollment with no start_date at all
  // falls here rather than being hidden: it is live work whose date was
  // never recorded, and the row says "Start date not set" truthfully
  // instead of being filed as upcoming on a date nobody knows.
  return "current";
};

// Current clients, newest-starting first — Leif's own requested order, so
// the person he most recently began with is at the top. An enrollment with
// no start date sorts last rather than being treated as infinitely old,
// and id descending breaks ties so the order never shuffles between
// renders.
export const byNewestStartFirst = (
  a: Pick<Enrollment, "id" | "start_date">,
  b: Pick<Enrollment, "id" | "start_date">,
): number => {
  const aKey = a.start_date ?? "";
  const bKey = b.start_date ?? "";
  if (aKey !== bKey) {
    if (!aKey) return 1;
    if (!bKey) return -1;
    return bKey.localeCompare(aKey);
  }
  return Number(b.id) - Number(a.id);
};

// Upcoming reads the other way round: the container starting soonest is
// the one Leif needs to prepare for next.
export const bySoonestStartFirst = (
  a: Pick<Enrollment, "id" | "start_date">,
  b: Pick<Enrollment, "id" | "start_date">,
): number => {
  const aKey = a.start_date ?? "";
  const bKey = b.start_date ?? "";
  if (aKey !== bKey) {
    if (!aKey) return 1;
    if (!bKey) return -1;
    return aKey.localeCompare(bKey);
  }
  return Number(a.id) - Number(b.id);
};

const toDateKey = (value: Date): string =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate(),
  ).padStart(2, "0")}`;
