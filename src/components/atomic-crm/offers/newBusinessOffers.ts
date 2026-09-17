// The ONE definition of "an Offer Leif can still sell", so the rule lives in
// a single place instead of being re-decided at each picker.
//
// offers.is_active existed from the start but nothing honoured it — it was
// rendered on the Offer admin screens and ignored everywhere else. That was
// harmless while every Offer was active, and stopped being harmless the
// moment "1:1 Coaching (Legacy)" existed to represent one-to-one work that
// predates both current programmes: without this, a retired Offer would sit
// in the Programs nav and in every new-Deal and waitlist picker, inviting
// Leif to start new business against it.
//
// The inverse is deliberately NOT done: nothing filters history by
// is_active. A historical Deal, Enrollment, Client page, Contact timeline or
// report still resolves its Offer and shows its real name, because hiding a
// client's own history because their programme was retired would be a
// worse lie than the one this fixes.
export const NEW_BUSINESS_OFFERS_FILTER = { is_active: true } as const;

export const isAvailableForNewBusiness = (offer: {
  is_active: boolean;
}): boolean => offer.is_active;
