import type { Offer, OfferPaymentOption } from "../types";

// The Opportunity's "Potential Value" should never be something the user
// types when it's already encoded elsewhere (§3 of the Programs +
// Opportunity UX slice): a selected payment option's total wins, falling
// back to the Offer's current list price when no option is selected yet.
// Returns null when neither is known (nothing to auto-fill).
export const resolveOpportunityAmount = (
  paymentOption: Pick<OfferPaymentOption, "total"> | null | undefined,
  offer: Pick<Offer, "current_price"> | null | undefined,
): number | null => {
  if (paymentOption) return paymentOption.total;
  if (offer) return offer.current_price;
  return null;
};
