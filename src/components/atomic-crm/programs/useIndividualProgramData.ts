import { useGetList, useGetMany, useGetOne, type Identifier } from "ra-core";

import {
  computeFutureOpenings,
  computeIndividualCapacity,
  type SlotEnrollment,
} from "../capacity/individualCapacity";
import { useSessionWeeks } from "../capacity/useSessionWeeks";
import { contactDisplayName } from "../contacts/contactDisplayName";
import type {
  ClientSessionCadenceIssue,
  Contact,
  Deal,
  Enrollment,
  Offer,
} from "../types";

// Backs the Living Example / any 1:1 Offer's program page: real Offer/
// Deal/Enrollment/Contact data only, no hard-coded numbers or names.
//
// It used to keep its own copy of "which statuses are active", and its own
// openings calculation that read end_date — a column no Living Example
// Enrollment has ever carried. Both now come from capacity/, which is the
// one place either question is answered, and the end dates come from the
// Year Tracking calendar rather than from month arithmetic.
export const useIndividualProgramData = (offerId?: Identifier) => {
  const { data: offer, isPending: offerPending } = useGetOne<Offer>(
    "offers",
    { id: offerId! },
    { enabled: offerId != null },
  );

  const {
    isPending: weeksPending,
    weeks,
    lastSyncedAt,
  } = useSessionWeeks(offerId);

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

  // Cross-week reschedules, which are the only thing that lengthens a
  // container. A cadence issue exists only for an eligible week that
  // closed with no session inside it, so a same-week time change never
  // produces one — see capacity/sessionWeeks.ts.
  const { data: cadenceIssues, isPending: issuesPending } =
    useGetList<ClientSessionCadenceIssue>(
      "client_session_cadence_issues",
      {
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "id", order: "ASC" },
      },
      { enabled: offerId != null },
    );

  const { data: contacts, isPending: contactsPending } = useGetMany<Contact>(
    "contacts",
    { ids: [...new Set((deals ?? []).map((deal) => deal.contact_id))] },
    { enabled: (deals ?? []).length > 0 },
  );

  const isPending =
    offerPending ||
    (offerId != null &&
      (weeksPending ||
        dealsPending ||
        enrollmentsPending ||
        issuesPending ||
        ((deals ?? []).length > 0 && contactsPending)));

  if (isPending || !offer) {
    return {
      isPending,
      offer: offer ?? null,
      capacity: null,
      ifAllRescheduled: null,
      futureOpenings: null,
      lastSyncedAt: null,
    };
  }

  const dealById = new Map(
    (deals ?? []).map((deal) => [String(deal.id), deal]),
  );
  const contactById = new Map(
    (contacts ?? []).map((contact) => [String(contact.id), contact]),
  );
  const classificationsByEnrollment = new Map<string, (string | null)[]>();
  for (const issue of cadenceIssues ?? []) {
    const key = String(issue.enrollment_id);
    classificationsByEnrollment.set(key, [
      ...(classificationsByEnrollment.get(key) ?? []),
      issue.classification ?? null,
    ]);
  }

  const withPerson = (enrollment: Enrollment): SlotEnrollment => {
    const deal = dealById.get(String(enrollment.opportunity_id));
    const contact = deal ? contactById.get(String(deal.contact_id)) : null;
    return {
      ...enrollment,
      contactId: deal?.contact_id ?? null,
      name: contactDisplayName(contact ?? null) ?? "",
      cadenceClassifications:
        classificationsByEnrollment.get(String(enrollment.id)) ?? [],
    };
  };

  const people = (enrollments ?? []).map(withPerson);
  const capacity = computeIndividualCapacity(
    people,
    offer.max_active_clients ?? null,
    weeks,
  );

  // The same practice, evaluated a second time with every week still
  // owing a decision counted as a cross-week reschedule.
  //
  // Not a second engine and not a forecast — it is the same function asked
  // the worst case, so the board can tell an opening nothing outstanding
  // can take away from one that unresolved history could still move. See
  // openingsNarrative.ts's describeConfidence.
  const ifAllRescheduled = computeIndividualCapacity(
    people,
    offer.max_active_clients ?? null,
    weeks,
    undefined,
    true,
  );

  return {
    isPending: false,
    offer,
    capacity,
    ifAllRescheduled,
    futureOpenings: computeFutureOpenings(capacity),
    lastSyncedAt,
  };
};
