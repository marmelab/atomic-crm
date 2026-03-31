import { describe, it, expect, vi, afterEach } from "vitest";
import { BUSINESS_TIMEZONE, todayISODate, toISODate } from "./dateTimezone";

afterEach(() => {
  vi.useRealTimers();
});

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
    // 2026-03-31 22:30 UTC = 2026-04-01 00:30 CEST
    const date = new Date("2026-03-31T22:30:00Z");
    expect(toISODate(date)).toBe("2026-04-01");
  });

  it("returns Italian day when UTC is still previous day (winter CET)", () => {
    // 2026-11-15 23:30 UTC = 2026-11-16 00:30 CET
    const date = new Date("2026-11-15T23:30:00Z");
    expect(toISODate(date)).toBe("2026-11-16");
  });

  it("returns same day when no ambiguity", () => {
    const date = new Date("2026-06-15T12:00:00Z");
    expect(toISODate(date)).toBe("2026-06-15");
  });

  it("handles DST transition day — last Sunday of March", () => {
    // 2026-03-29 is last Sunday of March. Clocks go forward at 02:00 CET → 03:00 CEST.
    // 2026-03-29 00:30 UTC = 2026-03-29 01:30 CET (still before transition)
    expect(toISODate(new Date("2026-03-29T00:30:00Z"))).toBe("2026-03-29");
    // 2026-03-29 02:30 UTC = 2026-03-29 04:30 CEST (after transition)
    expect(toISODate(new Date("2026-03-29T02:30:00Z"))).toBe("2026-03-29");
  });

  it("handles DST transition day — last Sunday of October", () => {
    // 2026-10-25 is last Sunday of October. Clocks go back at 03:00 CEST → 02:00 CET.
    // 2026-10-25 00:30 UTC = 2026-10-25 02:30 CEST (before transition)
    expect(toISODate(new Date("2026-10-25T00:30:00Z"))).toBe("2026-10-25");
    // 2026-10-25 02:30 UTC = 2026-10-25 03:30 CET (after transition)
    expect(toISODate(new Date("2026-10-25T02:30:00Z"))).toBe("2026-10-25");
  });

  it("keeps June 30 as June 30 in summer", () => {
    // 2026-06-30 00:00 UTC = 2026-06-30 02:00 CEST
    expect(toISODate(new Date("2026-06-30T00:00:00Z"))).toBe("2026-06-30");
  });
});

describe("todayISODate", () => {
  it("uses toISODate with current date", () => {
    vi.useFakeTimers();
    // Set fake time to 2026-03-31 22:30 UTC = 2026-04-01 00:30 CEST
    vi.setSystemTime(new Date("2026-03-31T22:30:00Z"));
    expect(todayISODate()).toBe("2026-04-01");
    vi.useRealTimers();
  });
});
