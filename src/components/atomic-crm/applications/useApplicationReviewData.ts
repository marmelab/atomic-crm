import { useGetOne } from "ra-core";

import type { Application, Cohort, Contact, Deal, Offer } from "../types";

// Backs the Application review page (Native Applications slice, §2/§3):
// the Application's linked Opportunity, and that Opportunity's Contact/
// Offer/Cohort — everything the page needs to show "Rosalind Park — The
// Living Example · Submitted Aug 31, 2026 · Pending" instead of a raw
// "Application #4" title, and to know what to write when a review
// decision is made.
export const useApplicationReviewData = (application?: Application) => {
  const { data: deal, isPending: dealPending } = useGetOne<Deal>(
    "deals",
    { id: application?.opportunity_id as Deal["id"] },
    { enabled: application != null },
  );

  const { data: contact, isPending: contactPending } = useGetOne<Contact>(
    "contacts",
    { id: deal?.contact_id as Contact["id"] },
    { enabled: deal != null },
  );

  const { data: offer, isPending: offerPending } = useGetOne<Offer>(
    "offers",
    { id: deal?.offer_id as Offer["id"] },
    { enabled: deal != null },
  );

  const { data: cohort, isPending: cohortPending } = useGetOne<Cohort>(
    "cohorts",
    { id: deal?.cohort_id as Cohort["id"] },
    { enabled: deal?.cohort_id != null },
  );

  const isPending =
    application == null ||
    dealPending ||
    contactPending ||
    offerPending ||
    (deal?.cohort_id != null && cohortPending);

  return {
    isPending,
    deal: isPending ? undefined : deal,
    contact: isPending ? undefined : contact,
    offer: isPending ? undefined : offer,
    cohort: deal?.cohort_id != null && !cohortPending ? cohort : undefined,
  };
};
