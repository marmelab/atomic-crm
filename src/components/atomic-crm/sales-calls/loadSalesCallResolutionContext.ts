import type { DataProvider, Identifier } from "ra-core";

import type { Contact, Deal, Offer, Cohort, SalesCall } from "../types";
import { findCompatibleActiveOpportunities } from "./matchAcuityBooking";
import { resolveOfferCohortForAppointmentType } from "./offerCohortAcuityMapping";

// Unmatched Sales Call Resolution slice: everything the dedicated
// resolution page (/sales-calls/:id/resolve) needs to render and act,
// loaded imperatively (not via useGetOne/useQuery) so it can be re-run
// after an action completes — same "async context + manual refetch"
// pattern OfferPage.tsx already established, not React Query's automatic
// invalidation, since this page's whole lifecycle is short (load once,
// act once, done).
export type SalesCallResolutionContext =
  | { kind: "not-found" }
  | {
      kind: "already-resolved";
      contact: Contact;
      salesCall: SalesCall;
      opportunity: Deal | null;
    }
  // The appointment type itself has no Offer/Cohort mapping at all yet —
  // a configuration gap (see matchAcuityBooking.ts's own comment), not a
  // Contact/booking problem. Only Dismiss is offered — there's nothing
  // authoritative to create or attach against.
  | { kind: "unknown-appointment-type"; contact: Contact; salesCall: SalesCall }
  | {
      kind: "resolvable";
      contact: Contact;
      salesCall: SalesCall;
      offer: Offer;
      cohort: Cohort | null;
      compatibleOpportunities: Deal[];
    };

export const loadSalesCallResolutionContext = async (
  dataProvider: DataProvider,
  salesCallId: Identifier,
): Promise<SalesCallResolutionContext> => {
  const salesCall = await dataProvider
    .getOne<SalesCall>("sales_calls", { id: salesCallId })
    .then(({ data }) => data)
    .catch(() => null);
  if (!salesCall) return { kind: "not-found" };

  const contact = await dataProvider
    .getOne<Contact>("contacts", { id: salesCall.contact_id })
    .then(({ data }) => data)
    .catch(() => null);
  if (!contact) return { kind: "not-found" };

  if (salesCall.opportunity_id != null || salesCall.dismissed_at != null) {
    const opportunity =
      salesCall.opportunity_id != null
        ? await dataProvider
            .getOne<Deal>("deals", { id: salesCall.opportunity_id })
            .then(({ data }) => data)
            .catch(() => null)
        : null;
    return { kind: "already-resolved", contact, salesCall, opportunity };
  }

  if (!salesCall.acuity_appointment_type_id) {
    return { kind: "unknown-appointment-type", contact, salesCall };
  }
  const mapping = await resolveOfferCohortForAppointmentType(
    dataProvider,
    salesCall.acuity_appointment_type_id,
  );
  if (!mapping) {
    return { kind: "unknown-appointment-type", contact, salesCall };
  }
  const cohort = mapping.kind === "group" ? mapping.cohort : null;

  const compatibleOpportunities = await findCompatibleActiveOpportunities(
    dataProvider,
    {
      contactId: contact.id,
      offerId: mapping.offer.id,
      cohortId: cohort?.id ?? null,
    },
  );

  return {
    kind: "resolvable",
    contact,
    salesCall,
    offer: mapping.offer,
    cohort,
    compatibleOpportunities,
  };
};
