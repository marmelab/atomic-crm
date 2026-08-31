import { useGetList, type Identifier } from "ra-core";

import type { Application, Deal, Enrollment } from "../types";
import { NON_APPROVED_TERMINAL_APPLICATION_STATUSES } from "../applications/applicationConstants";
import { useWaitlistEntries } from "../waitlist/useWaitlistEntries";
import { classifyCohortOpportunity } from "./cohortCapacity";

export type CohortPerson = { deal: Deal; group: "enrolled" | "in_sales" };

// Reads Cohort capacity from the underlying deals/enrollments/applications
// relationships (per the domain-model proof slice: no duplicated/
// denormalized counter).
export const useCohortCapacity = (cohortId?: Identifier) => {
  const { data: deals, isPending: dealsPending } = useGetList<Deal>(
    "deals",
    {
      filter: { cohort_id: cohortId },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: cohortId != null },
  );

  const dealIds = deals?.map((deal) => deal.id) ?? [];
  const opportunityIdList = `(${dealIds.join(",")})`;

  const { data: enrollments, isPending: enrollmentsPending } =
    useGetList<Enrollment>(
      "enrollments",
      {
        filter: { "opportunity_id@in": opportunityIdList },
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "id", order: "ASC" },
      },
      { enabled: !dealsPending },
    );

  const { data: applications, isPending: applicationsPending } =
    useGetList<Application>(
      "applications",
      {
        filter: { "opportunity_id@in": opportunityIdList },
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "id", order: "ASC" },
      },
      { enabled: !dealsPending },
    );

  const { isPending: waitlistPending, entries: waitlistEntries } =
    useWaitlistEntries({ cohortId: cohortId ?? null });

  if (
    dealsPending ||
    enrollmentsPending ||
    applicationsPending ||
    waitlistPending ||
    !deals
  ) {
    return {
      isPending: true,
      enrolledCount: undefined,
      inSalesCount: undefined,
      waitingCount: undefined,
      people: [] as CohortPerson[],
    };
  }

  const enrollmentByOpportunity = new Map(
    (enrollments ?? []).map((enrollment) => [
      String(enrollment.opportunity_id),
      enrollment,
    ]),
  );

  const rejectedApplicationOpportunityIds = new Set(
    (applications ?? [])
      .filter((application) =>
        NON_APPROVED_TERMINAL_APPLICATION_STATUSES.has(application.status),
      )
      .map((application) => String(application.opportunity_id)),
  );

  const people: CohortPerson[] = [];
  for (const deal of deals) {
    const group = classifyCohortOpportunity({
      stage: deal.stage,
      outcome: deal.outcome,
      enrollment: enrollmentByOpportunity.get(String(deal.id)),
      hasRejectedApplication: rejectedApplicationOpportunityIds.has(
        String(deal.id),
      ),
    });
    if (group !== "other") {
      people.push({ deal, group });
    }
  }

  return {
    isPending: false,
    enrolledCount: people.filter((p) => p.group === "enrolled").length,
    inSalesCount: people.filter((p) => p.group === "in_sales").length,
    // Never counted as enrolled/in_sales — a separate population (Waitlists
    // slice, §15).
    waitingCount: waitlistEntries.length,
    people,
  };
};
