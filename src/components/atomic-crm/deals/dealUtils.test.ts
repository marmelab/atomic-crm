import { commands } from "vitest/browser";

import { toCategoryAmounts } from "../dataImport/parseCell";
import {
  findDealCategoriesMatching,
  formatCategoryAmounts,
  formatISODateString,
  getDealAmount,
  getDealCategories,
  mapLegacyCategoryFilter,
} from "./dealUtils";

describe("formatISODateString", () => {
  let originalTimezone: string;

  beforeEach(() => {
    originalTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  });

  afterEach(async () => {
    await commands.setTimezone(originalTimezone);
  });

  it("formats a valid ISO date string correctly", () => {
    const isoDate = "2024-06-15";
    const formattedDate = formatISODateString(isoDate);
    expect(formattedDate).toBe("Jun 15, 2024");
  });

  it("should not shift the date regardless of timezone", async () => {
    // Uses CDP (Emulation.setTimezoneOverride) to actually change the browser's
    // timezone at runtime so we can catch regressions where someone replaces the
    // manual date-component parse with new Date(isoString), which would shift
    // dates in negative-offset timezones like America/New_York.
    const isoDate = "2024-06-15";
    await commands.setTimezone("America/New_York");
    expect(formatISODateString(isoDate)).toBe("Jun 15, 2024");

    await commands.setTimezone("Asia/Tokyo");
    expect(formatISODateString(isoDate)).toBe("Jun 15, 2024");

    await commands.setTimezone("UTC");
    expect(formatISODateString(isoDate)).toBe("Jun 15, 2024");

    await commands.setTimezone("Pacific/Auckland");
    expect(formatISODateString(isoDate)).toBe("Jun 15, 2024");
  });

  it("throw for an invalid date string", () => {
    const invalidDate = "invalid-date";
    expect(() => formatISODateString(invalidDate)).toThrow(
      "Invalid date format. Expected YYYY-MM-DD.",
    );
  });

  it("throw for a date string with wrong format", () => {
    const invalidDate = "15-06-2024";
    expect(() => formatISODateString(invalidDate)).toThrow(
      "Invalid date format. Expected YYYY-MM-DD.",
    );
  });
});

describe("findDealCategoriesMatching", () => {
  const categories = [
    { value: "website-design", label: "Site building" },
    { value: "copywriting", label: "Copywriting" },
  ];

  it("matches a label, whatever its case", () => {
    expect(findDealCategoriesMatching(categories, "BUILDING")).toEqual([
      "website-design",
    ]);
  });

  it("matches the stored value too", () => {
    expect(findDealCategoriesMatching(categories, "design")).toEqual([
      "website-design",
    ]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(findDealCategoriesMatching(categories, "print")).toEqual([]);
  });

  it("matches any word of a multi-word search, like the other fields", () => {
    expect(
      findDealCategoriesMatching(categories, "copywriting launch"),
    ).toEqual(["copywriting"]);
  });
});

describe("mapLegacyCategoryFilter", () => {
  it("maps a stale single-category filter to the categories filter", () => {
    expect(
      mapLegacyCategoryFilter({ filter: { category: "copywriting", q: "x" } }),
    ).toEqual({ filter: { "categories@cs": "{copywriting}", q: "x" } });
  });

  it("keeps the categories filter the user picked over the stale one", () => {
    expect(
      mapLegacyCategoryFilter({
        filter: {
          category: "copywriting",
          "categories@cs": "{website-design}",
        },
      }),
    ).toEqual({ filter: { "categories@cs": "{website-design}" } });
  });

  it("drops an empty stale category filter", () => {
    expect(mapLegacyCategoryFilter({ filter: { category: "" } })).toEqual({
      filter: {},
    });
  });

  it("leaves params without a category filter untouched", () => {
    const params = { filter: { stage: "won" } };
    expect(mapLegacyCategoryFilter(params)).toBe(params);
  });
});

describe("getDealCategories and getDealAmount", () => {
  const lines = [
    { category: "sprint-0", amount: 5000 },
    { category: "license", amount: 1200 },
    { category: "sprint-0", amount: 3000 },
    { category: null, amount: 800 },
  ];

  it("lists each category once, in line order, skipping empty ones", () => {
    expect(getDealCategories(lines)).toEqual(["sprint-0", "license"]);
  });

  it("sums the amounts of every line", () => {
    expect(getDealAmount(lines)).toBe(10000);
  });

  it("returns no category and a zero amount when the deal has no lines", () => {
    expect(getDealCategories([])).toEqual([]);
    expect(getDealAmount([])).toBe(0);
  });
});

describe("formatCategoryAmounts", () => {
  const lines = [
    { category: "website-design", amount: 8000 },
    { category: null, amount: 500 },
  ];

  it("writes one category:amount part per line", () => {
    expect(formatCategoryAmounts(lines)).toBe("website-design:8000;:500");
  });

  it("is read back unchanged by the CSV import", () => {
    const options = [{ value: "website-design", label: "Website design" }];
    expect(
      toCategoryAmounts(formatCategoryAmounts(lines), "8500", options),
    ).toEqual(lines);
  });
});
