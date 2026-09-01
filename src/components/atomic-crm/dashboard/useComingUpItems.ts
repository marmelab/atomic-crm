import { useMemo } from "react";
import { useGetList } from "ra-core";

import type { Cohort, Deal, Enrollment, Offer } from "../types";
import { useIndividualProgramData } from "../programs/useIndividualProgramData";
import { getDenverDateString } from "./artOracle/selectDailyArtwork";
import {
  computeCohortEvents,
  computeEnrolledCountByCohort,
} from "./cohortEvents";
import { buildComingUpItems, type NextUpItem } from "./comingUpProjection";

// §19/§12: a calm, scannable Coming Up list, not a dumped calendar.
const MAX_ITEMS = 8;

// Next Up / Coming Up's single data-fetching hook (Dashboard temporal-
// intelligence slice, §14/§27): a small constant number of queries
// regardless of how many Cohorts or Enrollments exist — Living Example via
// the SAME useIndividualProgramData.ts the Program page itself uses (its
// upcomingOpenings is not recomputed here), Cohorts via one list query plus
// one Deals query and one Enrollments query scoped to those Cohorts'
// Opportunities (computeEnrolledCountByCohort aggregates all of them in one
// pass — never one useCohortCapacity call per Cohort).
export const useComingUpItems = (): {
  isPending: boolean;
  items: NextUpItem[];
} => {
  const { data: offers, isPending: offersPending } = useGetList<Offer>(
    "offers",
    {
      filter: { type: "individual" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    },
  );
  // Finds "the" individual Offer with a capacity ceiling, same discovery
  // rule as dashboard/useLivingExampleCapacityData.ts — never a hardcoded
  // name/id.
  const leOffer = offers?.find((offer) => offer.max_active_clients != null);

  const { isPending: leProgramPending, upcomingOpenings } =
    useIndividualProgramData(leOffer?.id);

  const { data: cohorts, isPending: cohortsPending } = useGetList<Cohort>(
    "cohorts",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "program_start_at", order: "ASC" },
    },
  );
  const cohortIds = (cohorts ?? []).map((cohort) => cohort.id);

  const { data: cohortDeals, isPending: cohortDealsPending } = useGetList<Deal>(
    "deals",
    {
      filter: { "cohort_id@in": `(${cohortIds.join(",")})` },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: cohortIds.length > 0 },
  );

  const cohortDealIds = (cohortDeals ?? []).map((deal) => deal.id);
  const { data: cohortEnrollments, isPending: cohortEnrollmentsPending } =
    useGetList<Enrollment>(
      "enrollments",
      {
        filter: { "opportunity_id@in": `(${cohortDealIds.join(",")})` },
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "id", order: "ASC" },
      },
      { enabled: cohortDealIds.length > 0 },
    );

  const isPending =
    offersPending ||
    (leOffer != null && leProgramPending) ||
    cohortsPending ||
    (cohortIds.length > 0 &&
      (cohortDealsPending ||
        (cohortDealIds.length > 0 && cohortEnrollmentsPending)));

  const items = useMemo(() => {
    if (isPending) return [];

    const today = getDenverDateString();
    const enrolledByCohort = computeEnrolledCountByCohort(
      cohortDeals ?? [],
      cohortEnrollments ?? [],
    );
    const cohortEvents = computeCohortEvents(
      cohorts ?? [],
      enrolledByCohort,
      today,
    );

    return buildComingUpItems({
      leOfferId: leOffer?.id ?? null,
      upcomingOpenings: leOffer ? upcomingOpenings : [],
      cohortEvents,
      limit: MAX_ITEMS,
    });
  }, [
    isPending,
    cohorts,
    cohortDeals,
    cohortEnrollments,
    leOffer,
    upcomingOpenings,
  ]);

  return { isPending, items };
};
