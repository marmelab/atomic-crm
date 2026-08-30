import type { Enrollment } from "../types";

// Enrollment lifecycle statuses that occupy a Living Example client slot.
// Mirrors cohorts/cohortCapacity.ts's ACTIVE_ENROLLMENT_STATUSES exactly —
// "Completed" never occupies capacity, here or there.
const ACTIVE_ENROLLMENT_STATUSES: ReadonlySet<Enrollment["status"]> = new Set([
  "onboarding",
  "active",
  "offboarding",
]);

export type NextOpening = {
  date: string;
  // How many active Enrollments end in the same calendar month as `date`.
  countInMonth: number;
};

export type LivingExampleCapacity = {
  active: number;
  max: number | null;
  openings: number | null;
  nextOpening: NextOpening | null;
};

// Pure so the "how full is my 1:1 practice" math is unit-testable without a
// data provider. `now` is injectable for deterministic tests.
export const computeLivingExampleCapacity = (
  enrollments: Pick<Enrollment, "status" | "end_date">[],
  max: number | null,
  now: Date = new Date(),
): LivingExampleCapacity => {
  const activeEnrollments = enrollments.filter((enrollment) =>
    ACTIVE_ENROLLMENT_STATUSES.has(enrollment.status),
  );
  const active = activeEnrollments.length;
  const openings = max != null ? Math.max(max - active, 0) : null;

  const futureEndDates = activeEnrollments
    .map((enrollment) => enrollment.end_date)
    .filter((date): date is string => !!date)
    .filter((date) => new Date(date) >= now)
    .sort();

  let nextOpening: NextOpening | null = null;
  if (futureEndDates.length > 0) {
    const earliest = futureEndDates[0]!;
    const earliestMonth = earliest.slice(0, 7); // YYYY-MM
    const countInMonth = futureEndDates.filter(
      (date) => date.slice(0, 7) === earliestMonth,
    ).length;
    nextOpening = { date: earliest, countInMonth };
  }

  return { active, max, openings, nextOpening };
};
