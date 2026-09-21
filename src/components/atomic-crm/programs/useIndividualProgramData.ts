import { useGetList, useGetMany, useGetOne, type Identifier } from "ra-core";

import {
  computeFutureOpenings,
  computeIndividualCapacity,
  type SlotEnrollment,
} from "../capacity/individualCapacity";
import { contactDisplayName } from "../contacts/contactDisplayName";
import type { Contact, Deal, Enrollment, Offer } from "../types";

// Backs the Living Example / any 1:1 Offer's program page: real Offer/
// Deal/Enrollment/Contact data only, no hard-coded numbers or names.
// Generalized over `offerId` rather than hardcoding "the" individual
// offer, so any future 1:1 program reuses this same page.
//
// It used to keep its own third copy of "which statuses are active",
// status-only, and its own openings calculation that read end_date — a
// column no Living Example Enrollment has ever carried, so the Upcoming
// Openings section was permanently empty while six people were in fact
// due to finish before Christmas. Both now come from capacity/, which is
// the one place either question is answered.
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
      futureOpenings: null,
    };
  }

  const dealById = new Map(
    (deals ?? []).map((deal) => [String(deal.id), deal]),
  );
  const contactById = new Map(
    (contacts ?? []).map((contact) => [String(contact.id), contact]),
  );

  const withPerson = (enrollment: Enrollment): SlotEnrollment => {
    const deal = dealById.get(String(enrollment.opportunity_id));
    const contact = deal ? contactById.get(String(deal.contact_id)) : null;
    return {
      ...enrollment,
      contactId: deal?.contact_id ?? null,
      // contactDisplayName never invents a name; an unnamed Contact shows
      // as blank rather than as "#212" or a job title.
      name: contactDisplayName(contact ?? null) ?? "",
    };
  };

  const capacity = computeIndividualCapacity(
    (enrollments ?? []).map(withPerson),
    offer.max_active_clients ?? null,
    offer.duration_months ?? null,
  );

  return {
    isPending: false,
    offer,
    capacity,
    futureOpenings: computeFutureOpenings(capacity),
  };
};
