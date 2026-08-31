import type { Identifier } from "ra-core";

import type { UpcomingOpening } from "../programs/upcomingOpenings";
import type { CohortEvent } from "./cohortEvents";

// Next Up / Coming Up (Dashboard temporal-intelligence slice, §14): the
// centralized VIEW MODEL every Coming Up row renders from — never a
// persisted entity (see this slice's report for why). Deliberately
// structured (not pre-rendered title/detail strings) so ComingUp.tsx does
// the actual translate() calls, the same way every other presentational
// component in this app owns its own i18n rather than baking English text
// into a domain/projection layer.
export type NextUpItem =
  | {
      id: string;
      type: "living_example_opening";
      date: string; // YYYY-MM-DD
      destination: string;
      clientNames: string[];
      openingCount: number;
    }
  | {
      id: string;
      type:
        | "cohort_start"
        | "cohort_end"
        | "cohort_applications_open"
        | "cohort_applications_close";
      date: string; // YYYY-MM-DD
      destination: string;
      cohortName: string;
      enrolledCount: number;
      maxCapacity: number | null;
    };

type CohortNextUpItemType =
  | "cohort_start"
  | "cohort_end"
  | "cohort_applications_open"
  | "cohort_applications_close";

const cohortEventKindToItemType: Record<
  CohortEvent["kind"],
  CohortNextUpItemType
> = {
  applications_open: "cohort_applications_open",
  applications_close: "cohort_applications_close",
  cohort_start: "cohort_start",
  cohort_end: "cohort_end",
};

// Combines the Living Example openings (reusing programs/
// upcomingOpenings.ts's own grouping — never recomputed here) and Cohort
// events into ONE chronological projection, nearest first, capped to
// `limit` (§12/§19: "the next 6-10 meaningful business events", not a
// dumped year of dates). Each underlying fact produces exactly one row —
// see this slice's report for the dedupe rules this depends on upstream
// (computeUpcomingOpenings already merges same-day completions into one
// event; Tasks are never projected here at all).
export const buildComingUpItems = ({
  leOfferId,
  upcomingOpenings,
  cohortEvents,
  limit,
}: {
  leOfferId: Identifier | null;
  upcomingOpenings: UpcomingOpening[];
  cohortEvents: CohortEvent[];
  limit: number;
}): NextUpItem[] => {
  const leItems: NextUpItem[] =
    leOfferId == null
      ? []
      : upcomingOpenings.map((opening) => ({
          id: `le-opening-${opening.date}`,
          type: "living_example_opening",
          date: opening.date,
          destination: `/programs/individual/${leOfferId}#upcoming-openings`,
          clientNames: opening.clients.map((client) => client.name),
          openingCount: opening.count,
        }));

  const cohortItems: NextUpItem[] = cohortEvents.map((event) => ({
    id: `cohort-${event.cohortId}-${event.kind}`,
    type: cohortEventKindToItemType[event.kind],
    date: event.date,
    destination: `/cohorts/${event.cohortId}/show`,
    cohortName: event.cohortName,
    enrolledCount: event.enrolledCount,
    maxCapacity: event.maxCapacity,
  }));

  return [...leItems, ...cohortItems]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .slice(0, limit);
};
