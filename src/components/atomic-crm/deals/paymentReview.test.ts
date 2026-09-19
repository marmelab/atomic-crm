import { describe, expect, it } from "vitest";

import { assessPaymentTruth } from "./paymentTruth";
import { canMarkReviewed, reviewResolution } from "./paymentReview";
import type { Deal, DealPaymentScheduleItem } from "../types";

// A review action has to mean something durable.
//
// Emma Wijns clicked "Mark reviewed", the CRM said "Payment reviewed",
// and the identical warning came straight back. It always would: her
// review is DERIVED from a missing agreed total, and the button writes
// payment_review_reason = null — which is one of the three conditions the
// derivation requires. Clicking it was the thing keeping it raised.

const deal = (over: Partial<Deal> = {}): Deal =>
  ({
    id: 1,
    name: "Zz Payment",
    contact_id: 1,
    offer_id: 1,
    stage: "won",
    outcome: null,
    archived_at: null,
    sales_id: 0,
    index: 0,
    pricing_mode: "standard",
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    stage_entered_at: "2026-05-01T00:00:00.000Z",
    ...over,
  }) as Deal;

const paid = (amount: number): DealPaymentScheduleItem =>
  ({
    id: 1,
    deal_id: 1,
    amount,
    sequence: 1,
    status: "paid",
    source: "stripe",
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
  }) as DealPaymentScheduleItem;

const truthFor = (
  over: Partial<Deal> = {},
  items: DealPaymentScheduleItem[] = [],
) =>
  assessPaymentTruth({
    deal: deal(over),
    scheduleItems: items,
    planObjects: [],
  });

describe("a missing agreed total cannot be resolved by reading it", () => {
  it("offers the number, not an acknowledgement", () => {
    // Arrange — Emma: Won, no agreed total, nothing collected.
    const truth = truthFor();

    // Assert
    expect(truth.state).toBe("needs_review");
    expect(truth.reviewCode).toBe("terms_unknown");
    expect(reviewResolution(truth)).toEqual({ kind: "needs_agreed_terms" });
    expect(canMarkReviewed(truth)).toBe(false);
  });

  it("stays unresolvable however much was collected", () => {
    // Daniel: money in, terms still unknown. Still not acknowledgeable —
    // the open question is the total, and it has not been answered.
    const truth = truthFor({}, [paid(500)]);
    expect(canMarkReviewed(truth)).toBe(false);
    expect(reviewResolution(truth).kind).toBe("needs_agreed_terms");
  });

  it("clears the moment the total is recorded", () => {
    // Act — what "Record agreed terms" writes.
    const truth = truthFor({
      selected_payment_total: 4000,
      selected_payment_total_source: "owner_confirmed",
    } as Partial<Deal>);

    // Assert — the review is gone, and gone because the fact arrived.
    expect(truth.termsKnown).toBe(true);
    expect(truth.reviewCode).toBeNull();
    expect(truth.state).not.toBe("needs_review");
    expect(reviewResolution(truth)).toEqual({ kind: "none" });
  });

  it("clears the same way when Stripe proves it instead", () => {
    // The sync path: same columns, different provenance, same outcome.
    const truth = truthFor({
      selected_payment_total: 3996,
      selected_payment_total_source: "stripe_derived",
      selected_installment_count: 6,
      selected_installment_amount: 666,
    } as Partial<Deal>);

    expect(truth.termsKnown).toBe(true);
    expect(truth.state).not.toBe("needs_review");
  });
});

describe("a review somebody raised can be closed by somebody reading it", () => {
  it("is acknowledgeable once the terms are known", () => {
    const truth = truthFor({
      selected_payment_total: 4000,
      payment_review_reason: "Leif flagged this to look at.",
      payment_review_code: "owner_flagged",
    } as Partial<Deal>);

    expect(truth.state).toBe("needs_review");
    expect(reviewResolution(truth)).toEqual({ kind: "acknowledge" });
    expect(canMarkReviewed(truth)).toBe(true);
  });

  it("is NOT acknowledgeable while the agreed total is still missing", () => {
    // Kerri and Samantha are this shape: a stored "collected exceeds
    // agreed" against no agreed figure at all. Acknowledging that would
    // close a question nobody has answered.
    const truth = truthFor(
      {
        payment_review_reason: "More collected than agreed.",
        payment_review_code: "collected_exceeds_agreed",
      } as Partial<Deal>,
      [paid(9620)],
    );

    expect(truth.state).toBe("needs_review");
    expect(canMarkReviewed(truth)).toBe(false);
    expect(reviewResolution(truth).kind).toBe("needs_agreed_terms");
  });
});

describe("no review at all", () => {
  it("has nothing to resolve", () => {
    const truth = truthFor({ selected_payment_total: 4000 } as Partial<Deal>);
    expect(reviewResolution(truth)).toEqual({ kind: "none" });
    expect(canMarkReviewed(truth)).toBe(false);
  });
});
