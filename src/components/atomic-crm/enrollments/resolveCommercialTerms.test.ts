import { describe, expect, it } from "vitest";

import { resolveCommercialTerms } from "./resolveCommercialTerms";
import type { DealPaymentScheduleItem } from "../types";

// The bug these guard: production showed imported clients as
// "$1,400 Paid in full" because the Offer's list price stood in for terms
// nobody had recorded, and `installment_count ?? 1` turned "unknown" into
// "one payment, settled".
const noTerms = {
  selected_payment_total: null,
  selected_installment_count: null,
  selected_installment_amount: null,
};

const item = (
  over: Partial<DealPaymentScheduleItem>,
): DealPaymentScheduleItem =>
  ({
    id: 1,
    deal_id: 149,
    amount: 400,
    sequence: 1,
    due_date: null,
    status: "scheduled",
    paid_on: null,
    source: "owner_stated",
    stripe_payment_intent_id: null,
    notes: null,
    created_at: "2026-09-17T00:00:00.000Z",
    updated_at: "2026-09-17T00:00:00.000Z",
    ...over,
  }) as DealPaymentScheduleItem;

describe("resolveCommercialTerms", () => {
  it("reports UNKNOWN when nothing was recorded, rather than inventing a total", () => {
    expect(resolveCommercialTerms(noTerms, [])).toEqual({ kind: "unknown" });
  });

  // Mel, Sam and Gigi must keep rendering from the Deal's own snapshot.
  it("keeps a simple single-payment plan working (Mel: $700, one payment)", () => {
    const terms = resolveCommercialTerms(
      {
        selected_payment_total: 700,
        selected_installment_count: 1,
        selected_installment_amount: 700,
      },
      [],
    );
    expect(terms).toMatchObject({
      kind: "simple",
      total: 700,
      installments: 1,
    });
  });

  it("keeps a simple installment plan working (Gigi: $3,000 as 4 x $750)", () => {
    const terms = resolveCommercialTerms(
      {
        selected_payment_total: 3000,
        selected_installment_count: 4,
        selected_installment_amount: 750,
      },
      [],
    );
    expect(terms).toMatchObject({
      kind: "simple",
      total: 3000,
      installments: 4,
      installmentAmount: 750,
    });
  });

  // Lara: the arrangement the Deal snapshot structurally cannot express.
  it("represents a deposit plus a later balance exactly, without averaging them", () => {
    const terms = resolveCommercialTerms(
      { ...noTerms, selected_payment_total: 1400 },
      [
        item({ id: 1, sequence: 1, amount: 400, status: "paid" }),
        item({
          id: 2,
          sequence: 2,
          amount: 1000,
          status: "scheduled",
          due_date: "2027-01-01",
        }),
      ],
    );
    if (terms.kind !== "schedule") throw new Error("expected a schedule");

    expect(terms.total).toBe(1400);
    expect(terms.paidTotal).toBe(400);
    expect(terms.outstandingTotal).toBe(1000);
    // Two unequal payments, in order — never 2 x $700.
    expect(terms.items.map((i) => i.amount)).toEqual([400, 1000]);
    // And emphatically not settled.
    expect(terms.fullySettled).toBe(false);
  });

  it("does not claim Stripe verified a payment Leif merely told us about", () => {
    const terms = resolveCommercialTerms(noTerms, [
      item({ status: "paid", source: "owner_stated" }),
    ]);
    if (terms.kind !== "schedule") throw new Error("expected a schedule");
    expect(terms.paidTotal).toBe(400);
    // Paid, yes. Confirmed by a payment processor, no.
    expect(terms.hasVerifiedPayment).toBe(false);
  });

  it("does report a verified payment when one genuinely came from Stripe", () => {
    const terms = resolveCommercialTerms(noTerms, [
      item({
        status: "paid",
        source: "stripe",
        stripe_payment_intent_id: "pi_123",
      }),
    ]);
    if (terms.kind !== "schedule") throw new Error("expected a schedule");
    expect(terms.hasVerifiedPayment).toBe(true);
  });

  it("lets the schedule win outright rather than blending two totals", () => {
    // A snapshot saying $1,400 in one payment and a schedule saying
    // $400 + $1,000 are two stories; only one may be shown.
    const terms = resolveCommercialTerms(
      {
        selected_payment_total: 1400,
        selected_installment_count: 1,
        selected_installment_amount: 1400,
      },
      [
        item({ id: 1, sequence: 1, amount: 400, status: "paid" }),
        item({ id: 2, sequence: 2, amount: 1000 }),
      ],
    );
    expect(terms.kind).toBe("schedule");
    if (terms.kind !== "schedule") return;
    expect(terms.total).toBe(1400);
    expect(terms.items).toHaveLength(2);
  });

  it("ignores voided items so a cancelled instalment never inflates the total", () => {
    const terms = resolveCommercialTerms(noTerms, [
      item({ id: 1, sequence: 1, amount: 400, status: "paid" }),
      item({ id: 2, sequence: 2, amount: 9999, status: "void" }),
    ]);
    if (terms.kind !== "schedule") throw new Error("expected a schedule");
    expect(terms.total).toBe(400);
    expect(terms.fullySettled).toBe(true);
  });

  it("falls back to the Deal snapshot when every schedule item is voided", () => {
    const terms = resolveCommercialTerms(
      {
        selected_payment_total: 700,
        selected_installment_count: 1,
        selected_installment_amount: 700,
      },
      [item({ status: "void" })],
    );
    expect(terms).toMatchObject({ kind: "simple", total: 700 });
  });
});
