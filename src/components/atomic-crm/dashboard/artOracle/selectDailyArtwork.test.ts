import { describe, expect, test } from "vitest";
import { getDenverDateString, selectDailyArtwork } from "./selectDailyArtwork";

describe("getDenverDateString", () => {
  test("formats as YYYY-MM-DD in America/Denver regardless of instant given", () => {
    // 06:00 UTC on Jan 15 is still Jan 14 evening in Denver (UTC-7 in winter).
    expect(getDenverDateString(new Date("2026-01-15T06:00:00Z"))).toBe(
      "2026-01-14",
    );
  });

  test("a later instant on the same Denver day returns the same string", () => {
    const a = getDenverDateString(new Date("2026-08-15T20:00:00Z"));
    const b = getDenverDateString(new Date("2026-08-15T23:59:00Z"));
    expect(a).toBe(b);
  });
});

describe("selectDailyArtwork", () => {
  const items = ["a", "b", "c", "d", "e", "f", "g", "h"];

  test("is deterministic for the same date string", () => {
    const first = selectDailyArtwork(items, "2026-08-30");
    const second = selectDailyArtwork(items, "2026-08-30");
    expect(second).toBe(first);
  });

  test("refreshing within the same day does not change the pick", () => {
    // Same Denver calendar date computed from two different instants.
    const date1 = getDenverDateString(new Date("2026-08-30T14:00:00Z"));
    const date2 = getDenverDateString(new Date("2026-08-30T23:00:00Z"));
    expect(selectDailyArtwork(items, date1)).toBe(
      selectDailyArtwork(items, date2),
    );
  });

  test("a different date can select a different artwork", () => {
    const picks = new Set(
      Array.from({ length: 30 }, (_, i) =>
        selectDailyArtwork(items, `2026-01-${String(i + 1).padStart(2, "0")}`),
      ),
    );
    // With 8 items and 30 distinct dates, we should see more than one pick.
    expect(picks.size).toBeGreaterThan(1);
  });

  test("throws on an empty list rather than silently breaking the Dashboard caller", () => {
    expect(() => selectDailyArtwork([], "2026-08-30")).toThrow();
  });
});
