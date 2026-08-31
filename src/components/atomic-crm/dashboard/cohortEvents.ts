import type { Identifier } from "ra-core";

import type { Cohort, Deal, Enrollment } from "../types";

export type CohortEventKind =
  | "applications_open"
  | "applications_close"
  | "cohort_start"
  | "cohort_end";

export type CohortEvent = {
  cohortId: Identifier;
  cohortName: string;
  kind: CohortEventKind;
  date: string; // YYYY-MM-DD
  enrolledCount: number;
  maxCapacity: number | null;
};

type CohortInput = Pick<
  Cohort,
  | "id"
  | "name"
  | "applications_open_at"
  | "applications_close_at"
  | "program_start_at"
  | "program_end_at"
  | "maximum_capacity"
>;

// Next Up / Coming Up (Dashboard temporal-intelligence slice, §7): projects
// each Cohort's own structured dates into discrete future events — never
// inferred or fabricated from a name/status, only from a column that is
// actually set. `todayDateString` must already be an America/Denver
// "YYYY-MM-DD" (dashboard/artOracle/selectDailyArtwork.ts's
// getDenverDateString) — Cohort dates are plain Postgres `date` columns
// (no time component, confirmed in supabase/schemas/01_tables.sql), so
// comparing them as plain strings against that is exact; there is no
// timezone conversion to get wrong here, unlike Task.due_date
// (timestamptz — see tasksPredicate.ts for that one instead).
export const computeCohortEvents = (
  cohorts: CohortInput[],
  enrolledCountByCohortId: Map<string, number>,
  todayDateString: string,
): CohortEvent[] => {
  const events: CohortEvent[] = [];

  const pushIfFuture = (
    cohort: CohortInput,
    kind: CohortEventKind,
    date: string | null | undefined,
  ) => {
    if (!date || date < todayDateString) return;
    events.push({
      cohortId: cohort.id,
      cohortName: cohort.name,
      kind,
      date,
      enrolledCount: enrolledCountByCohortId.get(String(cohort.id)) ?? 0,
      maxCapacity: cohort.maximum_capacity ?? null,
    });
  };

  for (const cohort of cohorts) {
    pushIfFuture(cohort, "applications_open", cohort.applications_open_at);
    pushIfFuture(cohort, "applications_close", cohort.applications_close_at);
    pushIfFuture(cohort, "cohort_start", cohort.program_start_at);
    pushIfFuture(cohort, "cohort_end", cohort.program_end_at);
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
};

// Enrollment lifecycle statuses that occupy a Cohort seat. Mirrors
// cohorts/cohortCapacity.ts's own ACTIVE_ENROLLMENT_STATUSES exactly — same
// deliberate per-file local copy convention already established there and
// in dashboard/livingExampleCapacity.ts / programs/useIndividualProgramData.ts,
// not a new pattern.
const ACTIVE_ENROLLMENT_STATUSES: ReadonlySet<Enrollment["status"]> = new Set([
  "onboarding",
  "active",
  "offboarding",
]);

// Groups active-enrollment counts by Cohort, via the Deal that links an
// Enrollment to a Cohort — the same relationship useCohortCapacity.ts reads,
// just aggregated across every Cohort in one pass instead of one Cohort at
// a time, so Coming Up's projection stays at a small constant number of
// queries regardless of how many Cohorts exist (no N+1 useCohortCapacity
// call per Cohort).
export const computeEnrolledCountByCohort = (
  deals: Pick<Deal, "id" | "cohort_id">[],
  enrollments: Pick<Enrollment, "opportunity_id" | "status">[],
): Map<string, number> => {
  const cohortIdByDeal = new Map(
    deals
      .filter((deal) => deal.cohort_id != null)
      .map((deal) => [String(deal.id), String(deal.cohort_id)]),
  );

  const counts = new Map<string, number>();
  for (const enrollment of enrollments) {
    if (!ACTIVE_ENROLLMENT_STATUSES.has(enrollment.status)) continue;
    const cohortId = cohortIdByDeal.get(String(enrollment.opportunity_id));
    if (!cohortId) continue;
    counts.set(cohortId, (counts.get(cohortId) ?? 0) + 1);
  }
  return counts;
};
