import { describe, it, expect, vi, afterEach } from "vitest";
import {
  addDaysToISODate,
  BUSINESS_TIMEZONE,
  diffBusinessDays,
  endOfBusinessDayISOString,
  formatBusinessDate,
  getBusinessMonthIndex,
  getBusinessMonthKey,
  getBusinessYear,
  startOfBusinessDayISOString,
  todayISODate,
  toBusinessISODate,
  toISODate,
} from "./dateTimezone";

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

describe("toBusinessISODate", () => {
  it("keeps date-only strings unchanged", () => {
    expect(toBusinessISODate("2026-03-10")).toBe("2026-03-10");
  });

  it("normalizes timestamp strings to the business date", () => {
    expect(toBusinessISODate("2026-03-09T23:30:00Z")).toBe("2026-03-10");
  });
});

describe("business date parts", () => {
  it("extracts year and month from the business date", () => {
    expect(getBusinessYear("2026-12-31T23:30:00Z")).toBe(2027);
    expect(getBusinessMonthIndex("2026-03-31T22:30:00Z")).toBe(3);
    expect(getBusinessMonthKey("2026-03-31T22:30:00Z")).toBe("2026-04");
  });
});

describe("addDaysToISODate", () => {
  it("adds calendar days without leaking timezone", () => {
    expect(addDaysToISODate("2026-03-05", 7)).toBe("2026-03-12");
  });
});

describe("startOfBusinessDayISOString", () => {
  it("returns the UTC instant for Rome midnight in winter", () => {
    expect(startOfBusinessDayISOString("2026-03-10")).toBe(
      "2026-03-09T23:00:00.000Z",
    );
  });

  it("handles the DST start day using the midnight offset", () => {
    expect(startOfBusinessDayISOString("2026-03-29")).toBe(
      "2026-03-28T23:00:00.000Z",
    );
  });

  it("handles the DST end day using the midnight offset", () => {
    expect(startOfBusinessDayISOString("2026-10-25")).toBe(
      "2026-10-24T22:00:00.000Z",
    );
  });
});

describe("endOfBusinessDayISOString", () => {
  it("returns the UTC instant for the end of a Rome day", () => {
    expect(endOfBusinessDayISOString("2026-03-10")).toBe(
      "2026-03-10T22:59:59.999Z",
    );
  });

  it("handles the short DST spring day", () => {
    expect(endOfBusinessDayISOString("2026-03-29")).toBe(
      "2026-03-29T21:59:59.999Z",
    );
  });

  it("handles the long DST autumn day", () => {
    expect(endOfBusinessDayISOString("2026-10-25")).toBe(
      "2026-10-25T22:59:59.999Z",
    );
  });
});

describe("diffBusinessDays", () => {
  it("calculates day deltas from business dates", () => {
    expect(diffBusinessDays("2026-03-05", "2026-03-10")).toBe(5);
  });

  it("handles timestamp strings in business timezone", () => {
    expect(diffBusinessDays("2026-03-05", "2026-03-09T23:30:00Z")).toBe(5);
  });
});

describe("formatBusinessDate", () => {
  it("formats date-only strings without browser-timezone drift", () => {
    expect(
      formatBusinessDate("2026-03-10", {
        day: "2-digit",
        month: "2-digit",
      }),
    ).toBe("10/03");
  });

  it("formats timestamp strings on the business date", () => {
    expect(
      formatBusinessDate("2026-03-09T23:30:00Z", {
        day: "2-digit",
        month: "2-digit",
      }),
    ).toBe("10/03");
  });
});
