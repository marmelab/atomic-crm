import { useGetList, type Identifier } from "ra-core";

import type { Deal, Enrollment } from "../types";
import { classifyCohortOpportunity } from "./cohortCapacity";

export type CohortPerson = { deal: Deal; group: "enrolled" | "in_sales" };

// Reads Cohort capacity from the underlying deals/enrollments relationships
// (per the domain-model proof slice: no duplicated/denormalized counter).
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
  const { data: enrollments, isPending: enrollmentsPending } =
    useGetList<Enrollment>(
      "enrollments",
      {
        filter: { "opportunity_id@in": `(${dealIds.join(",")})` },
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "id", order: "ASC" },
      },
      { enabled: !dealsPending },
    );

  if (dealsPending || enrollmentsPending || !deals) {
    return {
      isPending: true,
      enrolledCount: undefined,
      inSalesCount: undefined,
      people: [] as CohortPerson[],
    };
  }

  const enrollmentByOpportunity = new Map(
    (enrollments ?? []).map((enrollment) => [
      String(enrollment.opportunity_id),
      enrollment,
    ]),
  );

  const people: CohortPerson[] = [];
  for (const deal of deals) {
    const group = classifyCohortOpportunity({
      stage: deal.stage,
      outcome: deal.outcome,
      enrollment: enrollmentByOpportunity.get(String(deal.id)),
    });
    if (group !== "other") {
      people.push({ deal, group });
    }
  }

  return {
    isPending: false,
    enrolledCount: people.filter((p) => p.group === "enrolled").length,
    inSalesCount: people.filter((p) => p.group === "in_sales").length,
    people,
  };
};
