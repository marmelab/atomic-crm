import type { Identifier } from "ra-core";

// Scholarship Pricing + Capacity slice, stale-Checkout-Session invariant:
// "old commercial terms must not remain payable after Leif changes a
// Deal's pricing mode" (Leif's own explicit decision). The Postgres
// pricing_mode UPDATE and an external Stripe API call can never share one
// database transaction, so this is a deliberately BEST-EFFORT, non-
// blocking side effect — never a gate on the grant/release itself
// succeeding (that would let an unrelated Stripe outage block a purely
// commercial CRM decision). The real, bulletproof backstop that does NOT
// depend on this call ever succeeding is reactive: stripe_webhook/index.ts
// re-validates a Checkout Session's own pricing_mode against the Deal's
// CURRENT pricing_mode at the moment a payment actually succeeds, and
// refuses to mark Won on a stale-terms match. This invalidator only
// removes the (rare, narrow) window where a bored/curious prospect could
// still see a stale, already-superseded payment link — see
// grantScholarshipPricing.ts/releaseScholarshipReservation.ts for how its
// outcome is surfaced (never silently swallowed) rather than pretended
// consistent.
export type InvalidateStaleCheckoutResult =
  | { status: "not-applicable" }
  | { status: "invalidated" }
  | { status: "failed" };

export type ScholarshipCheckoutInvalidator = (
  dealId: Identifier,
) => Promise<InvalidateStaleCheckoutResult>;

// Demo/FakeRest default: no real Stripe integration exists in demo mode, so
// there is never a live Checkout Session to invalidate.
export const noopScholarshipCheckoutInvalidator: ScholarshipCheckoutInvalidator =
  async () => ({ status: "not-applicable" });
