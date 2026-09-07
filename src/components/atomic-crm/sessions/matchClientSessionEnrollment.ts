import type { DataProvider, Identifier } from "ra-core";

import type { Deal, Enrollment } from "../types";

export type ClientSessionEnrollmentMatch =
  | { kind: "matched"; enrollment: Enrollment }
  | { kind: "none" }
  | { kind: "ambiguous" };

// "Find the one legitimately serviceable Enrollment for this paid-client
// session" — never guessed. Only an ACTIVE Enrollment counts as legitimate
// (an onboarding/offboarding/completed Enrollment is not currently
// consuming sessions); zero or 2+ active matches both come back
// unresolved rather than picking one, mirroring sales-calls/
// matchAcuityBooking.ts's own findActiveOpportunityMatch exactly — the
// caller preserves the session with enrollment_id = null instead of
// silently attaching it to the wrong (or an ambiguous) Enrollment.
export const matchClientSessionEnrollment = async (
  dataProvider: DataProvider,
  { contactId, offerId }: { contactId: Identifier; offerId: Identifier },
): Promise<ClientSessionEnrollmentMatch> => {
  const { data: deals } = await dataProvider.getList<Deal>("deals", {
    filter: { contact_id: contactId, offer_id: offerId },
    pagination: { page: 1, perPage: 100 },
    sort: { field: "id", order: "ASC" },
  });
  if (deals.length === 0) return { kind: "none" };

  const dealIds = deals.map((deal) => deal.id);
  const { data: enrollments } = await dataProvider.getList<Enrollment>(
    "enrollments",
    {
      filter: {
        "opportunity_id@in": `(${dealIds.join(",")})`,
        status: "active",
      },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    },
  );
  if (enrollments.length === 0) return { kind: "none" };
  if (enrollments.length > 1) return { kind: "ambiguous" };
  return { kind: "matched", enrollment: enrollments[0] };
};
