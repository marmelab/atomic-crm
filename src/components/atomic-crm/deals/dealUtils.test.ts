import { commands } from "vitest/browser";

import { formatISODateString, isPastISODateString } from "./dealUtils";

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

describe("isPastISODateString", () => {
  let originalTimezone: string;

  beforeEach(() => {
    originalTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  });

  afterEach(async () => {
    vi.useRealTimers();
    await commands.setTimezone(originalTimezone);
  });

  it("is false on the day itself and true from the next day", () => {
    vi.setSystemTime(new Date(2026, 9, 31, 9, 0));
    expect(isPastISODateString("2026-10-30")).toBe(true);
    expect(isPastISODateString("2026-10-31")).toBe(false);
    expect(isPastISODateString("2026-11-01")).toBe(false);
  });

  it("does not flag the day as past in any timezone", async () => {
    // A date-only string parsed with new Date() is midnight UTC, which is already
    // in the past during the whole day east of UTC and the evening before west of it.
    for (const timezone of [
      "America/Los_Angeles",
      "UTC",
      "Europe/Istanbul",
      "Pacific/Auckland",
    ]) {
      await commands.setTimezone(timezone);
      vi.setSystemTime(new Date(2026, 9, 31, 0, 1));
      expect(isPastISODateString("2026-10-31")).toBe(false);
      vi.setSystemTime(new Date(2026, 9, 31, 23, 59));
      expect(isPastISODateString("2026-10-31")).toBe(false);
      vi.setSystemTime(new Date(2026, 10, 1, 0, 1));
      expect(isPastISODateString("2026-10-31")).toBe(true);
    }
  });

  it("is false for an invalid date string", () => {
    expect(isPastISODateString("")).toBe(false);
    expect(isPastISODateString("not-a-date")).toBe(false);
  });
});
