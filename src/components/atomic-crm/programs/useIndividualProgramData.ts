import { useGetList, useGetMany, useGetOne, type Identifier } from "ra-core";

import { computeLivingExampleCapacity } from "../dashboard/livingExampleCapacity";
import type { Contact, Deal, Enrollment, Offer } from "../types";
import { computeUpcomingOpenings } from "./upcomingOpenings";

const ACTIVE_ENROLLMENT_STATUSES: ReadonlySet<Enrollment["status"]> = new Set([
  "onboarding",
  "active",
  "offboarding",
]);

export type CurrentClient = {
  enrollmentId: Identifier;
  contactId: Identifier;
  name: string;
  status: Enrollment["status"];
};

// Backs the Living Example / any 1:1 Offer's program page (§8-9 of the
// Programs + Opportunity UX slice): real Offer/Deal/Enrollment/Contact data
// only, no hard-coded numbers or names. Generalized over `offerId` rather
// than hardcoding "the" individual offer, so any future 1:1 program reuses
// this same page.
export const useIndividualProgramData = (offerId?: Identifier) => {
  const { data: offer, isPending: offerPending } = useGetOne<Offer>(
    "offers",
    { id: offerId! },
    { enabled: offerId != null },
  );

  const { data: deals, isPending: dealsPending } = useGetList<Deal>(
    "deals",
    {
      filter: { offer_id: offerId },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: offerId != null },
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
      { enabled: !dealsPending && offerId != null },
    );

  const contactIds = [...new Set((deals ?? []).map((deal) => deal.contact_id))];
  const { data: contacts, isPending: contactsPending } = useGetMany<Contact>(
    "contacts",
    { ids: contactIds },
    { enabled: contactIds.length > 0 },
  );

  const isPending =
    offerPending ||
    (offerId != null &&
      (dealsPending ||
        enrollmentsPending ||
        (contactIds.length > 0 && contactsPending)));

  if (isPending || !offer) {
    return {
      isPending,
      offer: offer ?? null,
      capacity: null,
      currentClients: [] as CurrentClient[],
      upcomingOpenings: [] as ReturnType<typeof computeUpcomingOpenings>,
    };
  }

  const dealById = new Map(
    (deals ?? []).map((deal) => [String(deal.id), deal]),
  );
  const contactById = new Map(
    (contacts ?? []).map((contact) => [String(contact.id), contact]),
  );

  const nameForDeal = (dealId: Identifier) => {
    const deal = dealById.get(String(dealId));
    const contact = deal ? contactById.get(String(deal.contact_id)) : null;
    return contact ? `${contact.first_name} ${contact.last_name}` : "";
  };
  const contactIdForDeal = (dealId: Identifier): Identifier => {
    const deal = dealById.get(String(dealId));
    return deal?.contact_id ?? "";
  };

  const activeEnrollments = (enrollments ?? []).filter((enrollment) =>
    ACTIVE_ENROLLMENT_STATUSES.has(enrollment.status),
  );

  const currentClients: CurrentClient[] = activeEnrollments
    .map((enrollment) => ({
      enrollmentId: enrollment.id,
      contactId: contactIdForDeal(enrollment.opportunity_id),
      name: nameForDeal(enrollment.opportunity_id),
      status: enrollment.status,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const upcomingOpenings = computeUpcomingOpenings(
    activeEnrollments.map((enrollment) => ({
      endDate: enrollment.end_date ?? null,
      contactId: contactIdForDeal(enrollment.opportunity_id),
      name: nameForDeal(enrollment.opportunity_id),
    })),
    new Date(),
  );

  return {
    isPending: false,
    offer,
    capacity: computeLivingExampleCapacity(
      enrollments ?? [],
      offer.max_active_clients ?? null,
    ),
    currentClients,
    upcomingOpenings,
  };
};
