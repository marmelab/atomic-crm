import type { PaymentTruth } from "./paymentTruth";

// What a person can actually do about a payment review.
//
// "Mark reviewed" used to be offered for every review, and for the
// commonest one it could not work. Emma Wijns is the case: Won, no agreed
// total recorded, so paymentTruth derives `terms_unknown` — a condition
// about MISSING DATA, not about an unacknowledged flag. The button writes
// payment_review_reason = null, and the derivation reads
//
//   won && !termsKnown && storedReason == null
//
// so clearing the reason is precisely what keeps the review raised. Click
// it and the same warning returns immediately, forever.
//
// The rule below is the fix, and it is about honesty rather than about
// buttons: a review can be acknowledged when acknowledging IS the
// resolution, and it cannot when the thing it is telling you is that a
// fact is missing. Then the only real resolution is to supply the fact —
// or for Stripe to prove it on the next sync.

export type ReviewResolution =
  // Somebody looked, and looking was the whole job. The reason was raised
  // by a human or by reconciliation; a human closing it is truthful.
  | { kind: "acknowledge" }
  // The CRM does not know the agreed total. Nothing is resolved by saying
  // it has been read: the number has to come from Leif, or from a finite
  // Stripe plan on a later sync.
  | { kind: "needs_agreed_terms" }
  // Nothing to resolve.
  | { kind: "none" };

/**
 * Which resolution a review actually has.
 *
 * `terms_unknown` is the derived one and is never acknowledgeable. Every
 * other code is a stored reason somebody raised deliberately, and those
 * are exactly the ones a human can close.
 */
export const reviewResolution = (truth: PaymentTruth): ReviewResolution => {
  if (truth.reviewCode == null && truth.reviewReason == null) {
    return { kind: "none" };
  }
  if (!truth.termsKnown) return { kind: "needs_agreed_terms" };
  return { kind: "acknowledge" };
};

/**
 * May this review be closed by saying it has been reviewed?
 *
 * Used by the UI to choose what to offer, and by the action itself to
 * refuse — so a stale render, a second tab or a direct call cannot
 * suppress a warning that is still materially true.
 */
export const canMarkReviewed = (truth: PaymentTruth): boolean =>
  reviewResolution(truth).kind === "acknowledge";

/** What the panel invites Leif to do about it. */
export const REVIEW_ACTION_LABELS: Record<
  ReviewResolution["kind"],
  string | null
> = {
  acknowledge: "Mark reviewed",
  needs_agreed_terms: "Record agreed terms",
  none: null,
};
