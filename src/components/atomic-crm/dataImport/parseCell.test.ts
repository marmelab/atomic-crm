import { describe, expect, it } from "vitest";

import {
  toCategoryAmounts,
  toConfiguredValue,
  toIsoDate,
  toLegacyCategoryAmounts,
  toNumber,
  toText,
} from "./parseCell";

const stages = [
  { value: "opportunity", label: "Opportunity" },
  { value: "proposal-sent", label: "Proposal Sent" },
];

describe("toText", () => {
  it("trims the cell content", () => {
    expect(toText("  Acme  ")).toBe("Acme");
  });

  it("returns undefined for an empty or blank cell", () => {
    expect(toText(null)).toBeUndefined();
    expect(toText("")).toBeUndefined();
    expect(toText("   ")).toBeUndefined();
  });

  it("stringifies cells Papa Parse already converted", () => {
    expect(toText(10001)).toBe("10001");
  });
});

describe("toNumber", () => {
  it("converts a numeric cell", () => {
    expect(toNumber("12000")).toBe(12000);
    expect(toNumber(250)).toBe(250);
  });

  it("returns undefined for an empty or non-numeric cell", () => {
    expect(toNumber(null)).toBeUndefined();
    expect(toNumber("a lot")).toBeUndefined();
  });
});

describe("toIsoDate", () => {
  it("converts a date cell to an ISO string", () => {
    expect(toIsoDate("2026-09-30")).toBe("2026-09-30T00:00:00.000Z");
  });

  it("reads the date as UTC, whatever the timezone of the browser", () => {
    // A local-midnight date shifts to the previous day in any timezone ahead
    // of UTC, and a date column then stores the wrong day
    expect(toIsoDate("2026-01-01")).toBe("2026-01-01T00:00:00.000Z");
    expect(toIsoDate("2026-12-31")).toBe("2026-12-31T00:00:00.000Z");
  });

  it("returns undefined for a cell that is not a plain YYYY-MM-DD date", () => {
    expect(toIsoDate(null)).toBeUndefined();
    expect(toIsoDate("next quarter")).toBeUndefined();
    // Ambiguous or locale-dependent formats are refused rather than guessed
    expect(toIsoDate("09/30/2026")).toBeUndefined();
    expect(toIsoDate("30/09/2026")).toBeUndefined();
    // An impossible day rolls over to the next month rather than failing
    expect(toIsoDate("2026-02-31")).toBeUndefined();
    expect(toIsoDate("2026-13-01")).toBeUndefined();
  });
});

describe("toConfiguredValue", () => {
  it("matches a configured value", () => {
    expect(toConfiguredValue("proposal-sent", stages)).toBe("proposal-sent");
  });

  it("matches a configured label, whatever its case", () => {
    expect(toConfiguredValue("Proposal Sent", stages)).toBe("proposal-sent");
    expect(toConfiguredValue("proposal sent", stages)).toBe("proposal-sent");
  });

  it("returns undefined when no option matches", () => {
    expect(toConfiguredValue("Archived", stages)).toBeUndefined();
    expect(toConfiguredValue(null, stages)).toBeUndefined();
  });
});

describe("toCategoryAmounts", () => {
  const categories = [
    { value: "website-design", label: "Website design" },
    { value: "copywriting", label: "Copywriting" },
  ];

  it("reads amounts with currency symbols and decimal commas", () => {
    expect(
      toCategoryAmounts(
        "Website design:$8000;Copywriting:8 000,50",
        null,
        categories,
      ),
    ).toEqual([
      { category: "website-design", amount: 8000 },
      { category: "copywriting", amount: 8000.5 },
    ]);
  });

  it("keeps a category whose amount is empty", () => {
    expect(toCategoryAmounts("Website design:", "500", categories)).toEqual([
      { category: "website-design", amount: 500 },
    ]);
  });

  it("reads dots as thousands separators before three digits", () => {
    expect(
      toCategoryAmounts(
        "Website design:8.000;Copywriting:12.500,50;Print:4,500.25",
        null,
        categories,
      ),
    ).toEqual([
      { category: "website-design", amount: 8000 },
      { category: "copywriting", amount: 12500.5 },
      { category: null, amount: 4500.25 },
    ]);
  });

  it("ignores the single-amount column when parts carry amounts", () => {
    expect(toCategoryAmounts("Website design:8000", "N/A", categories)).toEqual(
      [{ category: "website-design", amount: 8000 }],
    );
  });

  it("keeps a bare amount as an uncategorized line", () => {
    expect(
      toCategoryAmounts("8000;Copywriting:4000", null, categories),
    ).toEqual([
      { category: null, amount: 8000 },
      { category: "copywriting", amount: 4000 },
    ]);
  });

  it("throws rather than dropping a part with a forgotten colon", () => {
    expect(() =>
      toCategoryAmounts("Website design 8000", null, categories),
    ).toThrow('Cannot read the amount of "Website design 8000"');
  });

  it("reads an unknown label containing a digit as a name", () => {
    expect(
      toCategoryAmounts("Phase 2;Copywriting:4000", null, categories),
    ).toEqual([{ category: "copywriting", amount: 4000 }]);
  });

  it("reads an unknown label containing a colon as a name", () => {
    expect(
      toCategoryAmounts(
        "Phase 1: Discovery;Copywriting:4000",
        null,
        categories,
      ),
    ).toEqual([{ category: "copywriting", amount: 4000 }]);
  });

  it("reads a formatted amount in the single-amount column", () => {
    expect(toCategoryAmounts("Website design", "$12,000", categories)).toEqual([
      { category: "website-design", amount: 12000 },
    ]);
  });

  it("throws rather than dropping an unreadable single amount", () => {
    expect(() =>
      toCategoryAmounts("Website design", "12k", categories),
    ).toThrow('Cannot read the amount of "12k"');
  });

  it("throws rather than dropping an unreadable amount", () => {
    expect(() =>
      toCategoryAmounts("Website design:8k;Copywriting:4000", null, categories),
    ).toThrow('Cannot read the amount of "Website design:8k"');
  });

  it("reads amounts written with thousands separators", () => {
    expect(
      toCategoryAmounts(
        "Website design:8 000;Copywriting:4,000",
        null,
        categories,
      ),
    ).toEqual([
      { category: "website-design", amount: 8000 },
      { category: "copywriting", amount: 4000 },
    ]);
  });

  it("reads the category:amount parts the deals export writes", () => {
    expect(
      toCategoryAmounts(
        "Website design:8000;copywriting:4000",
        "12000",
        categories,
      ),
    ).toEqual([
      { category: "website-design", amount: 8000 },
      { category: "copywriting", amount: 4000 },
    ]);
  });

  it("gives the amount column to the first category of older files", () => {
    expect(
      toCategoryAmounts("Website design;Copywriting", "12000", categories),
    ).toEqual([
      { category: "website-design", amount: 12000 },
      { category: "copywriting", amount: 0 },
    ]);
  });

  it("keeps the amount of an unknown or missing category, uncategorized", () => {
    expect(toCategoryAmounts("Print:500;:300", null, categories)).toEqual([
      { category: null, amount: 500 },
      { category: null, amount: 300 },
    ]);
    expect(toCategoryAmounts(null, "700", categories)).toEqual([
      { category: null, amount: 700 },
    ]);
  });

  it("drops unknown categories that carry no amount", () => {
    expect(toCategoryAmounts("Print;Copywriting", null, categories)).toEqual([
      { category: "copywriting", amount: 0 },
    ]);
  });
});

describe("toLegacyCategoryAmounts", () => {
  const categories = [{ value: "website-design", label: "Website design" }];

  it("puts the amount column on the single category", () => {
    expect(
      toLegacyCategoryAmounts("Website design", "$5,000", categories),
    ).toEqual([{ category: "website-design", amount: 5000 }]);
  });

  it("never reads a colon in the category as an amount", () => {
    expect(toLegacyCategoryAmounts("Q3: 2026", "5000", categories)).toEqual([
      { category: null, amount: 5000 },
    ]);
    expect(toLegacyCategoryAmounts("Retainer: 2k", "5000", categories)).toEqual(
      [{ category: null, amount: 5000 }],
    );
  });

  it("returns no line when both columns are empty", () => {
    expect(toLegacyCategoryAmounts("", "", categories)).toEqual([]);
  });
});
