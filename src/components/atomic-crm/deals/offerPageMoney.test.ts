import { describe, expect, it } from "vitest";

import { formatOfferPageAmount } from "./offerPageMoney";

describe("formatOfferPageAmount", () => {
  it("formats a USD amount with the currency code explicit, no cents", () => {
    expect(formatOfferPageAmount(1400, "USD")).toBe("$1,400 USD");
  });

  it("formats generically from whatever currency is passed in — never hardcoded to USD", () => {
    expect(formatOfferPageAmount(1400, "EUR")).toBe("€1,400 EUR");
    expect(formatOfferPageAmount(1400, "CAD")).toBe("CA$1,400 CAD");
  });

  it("never shows cents, matching this app's own real (always whole-dollar) data", () => {
    expect(formatOfferPageAmount(700, "USD")).toBe("$700 USD");
  });
});
