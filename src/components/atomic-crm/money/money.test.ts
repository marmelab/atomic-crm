import { describe, expect, it } from "vitest";

import { formatMoney, fromMinor, getMinorDigits, toMinor } from "./money";

// Intl separates thousands with (narrow) no-break spaces in uk-UA and pl-PL
const NO_BREAK_SPACES = new RegExp("[\u00a0\u202f]", "g");
const plainSpaces = (value: string) => value.replace(NO_BREAK_SPACES, " ");

describe("money", () => {
  it("knows how many minor units a currency has", () => {
    expect(getMinorDigits("UAH")).toBe(2);
    expect(getMinorDigits("PLN")).toBe(2);
    expect(getMinorDigits("JPY")).toBe(0);
    expect(getMinorDigits("KWD")).toBe(3);
  });

  it("converts what people type into minor units and back", () => {
    expect(toMinor(12400, "UAH")).toBe(1240000);
    expect(toMinor(19.99, "PLN")).toBe(1999);
    expect(toMinor(0.1 + 0.2, "UAH")).toBe(30);
    expect(toMinor(1500, "JPY")).toBe(1500);
    expect(fromMinor(1240000, "UAH")).toBe(12400);
    expect(fromMinor(1999, "PLN")).toBe(19.99);
  });

  it("shows hryvnias the Ukrainian way", () => {
    expect(plainSpaces(formatMoney(1240000, "UAH", "uk-UA"))).toBe(
      "12 400,00 ₴",
    );
  });

  it("shows zlotys the Polish way", () => {
    expect(plainSpaces(formatMoney(1240000, "PLN", "pl-PL"))).toBe(
      "12 400,00 zł",
    );
  });

  it("shows compact and signed amounts", () => {
    expect(
      plainSpaces(formatMoney(1240000, "UAH", "en-US", { compact: true })),
    ).toBe("₴12.4K");
    expect(
      plainSpaces(formatMoney(120000, "PLN", "pl-PL", { signed: true })),
    ).toBe("+1200,00 zł");
  });
});
