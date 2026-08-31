import { describe, expect, test } from "vitest";
import { resolveOpportunityAmount } from "./dealAmount";

describe("resolveOpportunityAmount", () => {
  test("uses the selected payment option's total when one is selected", () => {
    const amount = resolveOpportunityAmount(
      { total: 1400 },
      { current_price: 4000 },
    );
    expect(amount).toBe(1400);
  });

  test("falls back to the offer's current price with no payment option", () => {
    const amount = resolveOpportunityAmount(null, { current_price: 4000 });
    expect(amount).toBe(4000);
  });

  test("an installment plan's total drives the amount, not the installment count", () => {
    // GYU Financial Need: 4 installments of $350 = $1,400 total, same as
    // the Pay in Full option — installment count must never leak into the
    // amount (Programs + Opportunity UX slice, §3).
    const amount = resolveOpportunityAmount(
      { total: 1400 },
      { current_price: 1400 },
    );
    expect(amount).toBe(1400);
  });

  test("returns null when neither a payment option nor an offer is known", () => {
    expect(resolveOpportunityAmount(null, null)).toBeNull();
  });
});
