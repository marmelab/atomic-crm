import type { Identifier } from "ra-core";

import type { Deal, Enrollment, EnrollmentStatus, Offer } from "../types";

// Mirrors dashboard/livingExampleCapacity.ts's ACTIVE_ENROLLMENT_STATUSES —
// "Completed" never reads as a currently-active relationship, here or there.
const ACTIVE_ENROLLMENT_STATUSES: ReadonlySet<EnrollmentStatus> = new Set([
  "onboarding",
  "active",
  "offboarding",
]);

export type PersonContextInput = {
  contactId: Identifier;
  deals: Pick<
    Deal,
    "id" | "contact_id" | "offer_id" | "outcome" | "archived_at"
  >[];
  offersById: Map<string, Pick<Offer, "id" | "name">>;
  enrollmentsByOpportunity: Map<string, Pick<Enrollment, "status">>;
};

// A small, optional contextual label next to a search result in the
// Opportunity "Person" field — e.g. "Past GYU client", "Active opportunity"
// — so a returning client is recognizable before selection. Pure/testable:
// never fetches, only reads already-loaded deals/offers/enrollments.
// Priority: an active Enrollment beats an open Opportunity beats a
// completed (past) Enrollment.
export const derivePersonContextLabel = ({
  contactId,
  deals,
  offersById,
  enrollmentsByOpportunity,
}: PersonContextInput): string | null => {
  const contactDeals = deals.filter(
    (deal) => String(deal.contact_id) === String(contactId),
  );
  if (contactDeals.length === 0) return null;

  let activeLabel: string | null = null;
  let openOpportunityLabel: string | null = null;
  let pastLabel: string | null = null;

  for (const deal of contactDeals) {
    const offerName = offersById.get(String(deal.offer_id))?.name ?? null;
    const enrollment = enrollmentsByOpportunity.get(String(deal.id));

    if (enrollment && ACTIVE_ENROLLMENT_STATUSES.has(enrollment.status)) {
      activeLabel = offerName ? `Active ${offerName} client` : "Active client";
    } else if (enrollment && enrollment.status === "completed") {
      pastLabel = offerName ? `Past ${offerName} client` : "Past client";
    } else if (!enrollment && !deal.archived_at && deal.outcome == null) {
      openOpportunityLabel = offerName
        ? `Active ${offerName} opportunity`
        : "Active opportunity";
    }
  }

  return activeLabel ?? openOpportunityLabel ?? pastLabel ?? null;
};
