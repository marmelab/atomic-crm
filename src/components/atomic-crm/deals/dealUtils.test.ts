import { commands } from "vitest/browser";

import {
  formatISODateString,
  isISODateString,
  validateClosingDate,
} from "./dealUtils";

describe("validateClosingDate", () => {
  it.each(["1900-01-01", "2026-09-30", "2900-12-31", "", null])(
    "accepts %j",
    (value) => {
      expect(validateClosingDate(value)).toBeUndefined();
    },
  );

  it.each(["1899-12-31", "2901-01-01", "20250-12-31"])(
    "rejects %s, which the database check refuses",
    (value) => {
      expect(validateClosingDate(value)).toBe("resources.deals.invalid_date");
    },
  );
});

describe("isISODateString", () => {
  it("accepts a YYYY-MM-DD date", () => {
    expect(isISODateString("2024-06-15")).toBe(true);
  });

  it.each([
    ["a 5-digit year Postgres accepts", "20250-12-31"],
    ["a BC date", "2025-12-31 BC"],
    ["infinity", "infinity"],
    ["null", null],
    ["undefined", undefined],
  ])("rejects %s, which formatISODateString would throw on", (_, value) => {
    expect(isISODateString(value)).toBe(false);
  });
});

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
