import { describe, it, expect } from "vitest";
import {
  BUSINESS_TIMEZONE,
  toISODate,
  formatDateInTimezone,
} from "./dateTimezone.ts";

describe("BUSINESS_TIMEZONE", () => {
  it("is Europe/Rome", () => {
    expect(BUSINESS_TIMEZONE).toBe("Europe/Rome");
  });
});

describe("toISODate", () => {
  it("returns YYYY-MM-DD format", () => {
    const date = new Date("2026-06-15T12:00:00Z");
    expect(toISODate(date)).toBe("2026-06-15");
  });

  it("returns Italian day when UTC is still previous day (summer CEST)", () => {
    const date = new Date("2026-03-31T22:30:00Z");
    expect(toISODate(date)).toBe("2026-04-01");
  });

  it("returns Italian day when UTC is still previous day (winter CET)", () => {
    const date = new Date("2026-11-15T23:30:00Z");
    expect(toISODate(date)).toBe("2026-11-16");
  });

  it("handles DST transition — last Sunday of March", () => {
    expect(toISODate(new Date("2026-03-29T00:30:00Z"))).toBe("2026-03-29");
    expect(toISODate(new Date("2026-03-29T02:30:00Z"))).toBe("2026-03-29");
  });

  it("handles DST transition — last Sunday of October", () => {
    expect(toISODate(new Date("2026-10-25T00:30:00Z"))).toBe("2026-10-25");
    expect(toISODate(new Date("2026-10-25T02:30:00Z"))).toBe("2026-10-25");
  });

  it("keeps June 30 as June 30 in summer", () => {
    expect(toISODate(new Date("2026-06-30T00:00:00Z"))).toBe("2026-06-30");
  });
});

describe("formatDateInTimezone", () => {
  it("formats in specified timezone", () => {
    const date = new Date("2026-03-31T22:30:00Z");
    expect(formatDateInTimezone(date, "Europe/Rome")).toBe("2026-04-01");
    expect(formatDateInTimezone(date, "UTC")).toBe("2026-03-31");
  });

  it("returns null for invalid timezone gracefully", () => {
    const date = new Date("2026-06-15T12:00:00Z");
    expect(formatDateInTimezone(date, "Europe/Rome")).toBe("2026-06-15");
  });
});
