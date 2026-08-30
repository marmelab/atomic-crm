// Shared validation for the Offer <-> Cohort relationship on an Opportunity.
// Mirrors the Postgres trigger `handle_deal_saved()` (see
// supabase/schemas/02_functions.sql) so the rule is enforced identically in
// FakeRest/demo mode and in production — not just as a UI convention.
import type { Cohort, Offer } from "../types";

export class OfferCohortMismatchError extends Error {}

export const validateOfferCohort = (
  offer: Pick<Offer, "id" | "type">,
  cohort: Pick<Cohort, "id" | "offer_id"> | null | undefined,
): void => {
  if (!cohort) return;

  if (offer.type !== "group") {
    throw new OfferCohortMismatchError(
      "cohort_id can only be set on a group offer",
    );
  }

  if (cohort.offer_id != offer.id) {
    throw new OfferCohortMismatchError(
      `Cohort ${cohort.id} does not belong to offer ${offer.id}`,
    );
  }
};
