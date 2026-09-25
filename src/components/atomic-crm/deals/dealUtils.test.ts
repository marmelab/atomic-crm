import { commands } from "vitest/browser";

import {
  findDealCategoriesMatching,
  formatISODateString,
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
});

describe("mapLegacyCategoryFilter", () => {
  it("maps a stale single-category filter to the categories filter", () => {
    expect(
      mapLegacyCategoryFilter({ filter: { category: "copywriting", q: "x" } }),
    ).toEqual({ filter: { "categories@cs": "{copywriting}", q: "x" } });
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
