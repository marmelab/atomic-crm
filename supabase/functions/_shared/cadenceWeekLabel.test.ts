import { describe, expect, it } from "vitest";

import {
  formatCadenceWeekLabel,
  formatWindowWeekLabel,
} from "./cadenceWeekLabel.ts";

// The DENO half — the calendar sync, which is what actually wrote the
// ugly labels into Task text. Deliberately the same cases and the same
// expected strings as the app-side file, because two implementations
// that agree today are two implementations that can drift tomorrow, and
// this is what catches it.
//
// Pete Bassett's Task read "No session booked for week of
// 2026-09-13–2026-09-16". That is a machine talking, and the CRM is read
// by a person.
//
// window_end is EXCLUSIVE, so a window ending 2026-09-17 covers up to
// the 16th. Every case below states the window as it is stored and the
// sentence a human should get.

// A fixed "now" so the year rules are tested rather than the calendar.
const IN_2026 = new Date("2026-09-20T12:00:00.000Z");

const label = (start: string, endExclusive: string, now = IN_2026) =>
  formatCadenceWeekLabel(start, endExclusive, { now });

describe("a week inside one month", () => {
  it("says the month once — Pete's case", () => {
    expect(label("2026-09-13", "2026-09-17")).toBe("Sep 13–16");
  });

  it("does the same at the edges of a month", () => {
    expect(label("2026-09-01", "2026-09-08")).toBe("Sep 1–7");
    expect(label("2026-09-24", "2026-10-01")).toBe("Sep 24–30");
  });
});

describe("a week that crosses a month", () => {
  it("names both months — Jules's case", () => {
    expect(label("2026-06-28", "2026-07-02")).toBe("Jun 28–Jul 1");
  });

  it("handles the example from the brief", () => {
    expect(label("2026-09-28", "2026-10-03")).toBe("Sep 28–Oct 2");
  });

  it("crosses February without inventing a day", () => {
    // 2027 is not a leap year: February has 28 days.
    expect(label("2027-02-22", "2027-03-01", IN_2026)).toBe("Feb 22–28, 2027");
    // 2028 is: the 29th exists.
    expect(label("2028-02-23", "2028-03-01", IN_2026)).toBe("Feb 23–29, 2028");
  });
});

describe("the year, only when it earns its place", () => {
  it("is left off for the year being read in", () => {
    expect(label("2026-09-13", "2026-09-17")).toBe("Sep 13–16");
  });

  it("is added once for another year", () => {
    expect(label("2027-01-30", "2027-02-04")).toBe("Jan 30–Feb 3, 2027");
  });

  it("is added to both ends when the range crosses one", () => {
    expect(label("2026-12-30", "2027-01-03")).toBe("Dec 30, 2026–Jan 2, 2027");
  });

  it("follows the CRM's own clock, not the server's", () => {
    // 2027-01-01T04:00Z is still 2026 in America/Denver, so a January
    // 2027 window is NOT yet "this year" and keeps its year.
    const stillLastYear = new Date("2027-01-01T04:00:00.000Z");
    expect(label("2027-01-04", "2027-01-09", stillLastYear)).toBe(
      "Jan 4–8, 2027",
    );
    // Six hours later it is 2027 there, and the year becomes noise.
    const nowThisYear = new Date("2027-01-01T12:00:00.000Z");
    expect(label("2027-01-04", "2027-01-09", nowThisYear)).toBe("Jan 4–8");
  });
});

describe("windows that are not really ranges", () => {
  it("prints a single day once, never Sep 13–13", () => {
    expect(label("2026-09-13", "2026-09-14")).toBe("Sep 13");
  });

  it("treats an end at or before the start as that one day", () => {
    expect(label("2026-09-13", "2026-09-13")).toBe("Sep 13");
    expect(label("2026-09-13", "2026-09-10")).toBe("Sep 13");
  });
});

describe("missing or unusable values", () => {
  it("says nothing rather than Invalid Date", () => {
    expect(formatCadenceWeekLabel(null, null, { now: IN_2026 })).toBe("");
    expect(formatCadenceWeekLabel(undefined, undefined, { now: IN_2026 })).toBe(
      "",
    );
    expect(
      formatCadenceWeekLabel("not-a-date", "also-not", { now: IN_2026 }),
    ).toBe("");
  });

  it("uses the half it has", () => {
    expect(formatCadenceWeekLabel("2026-09-13", null, { now: IN_2026 })).toBe(
      "Sep 13",
    );
    expect(formatCadenceWeekLabel(null, "2026-09-17", { now: IN_2026 })).toBe(
      "Sep 16",
    );
  });
});

describe("the window shape callers actually hold", () => {
  it("reads window_start and window_end", () => {
    expect(
      formatWindowWeekLabel(
        { window_start: "2026-09-13", window_end: "2026-09-17" },
        { now: IN_2026 },
      ),
    ).toBe("Sep 13–16");
  });
});

describe("no ISO leaks into anything it produces", () => {
  it("never returns a YYYY-MM-DD", () => {
    const cases: [string, string][] = [
      ["2026-09-13", "2026-09-17"],
      ["2026-06-28", "2026-07-02"],
      ["2026-12-30", "2027-01-03"],
      ["2027-01-30", "2027-02-04"],
      ["2026-09-13", "2026-09-14"],
    ];
    for (const [start, end] of cases) {
      expect(label(start, end)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    }
  });
});
