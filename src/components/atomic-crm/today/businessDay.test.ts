import { describe, expect, it } from "vitest";

import { formatBusinessDate, getBusinessDay } from "./businessDay";

describe("business day", () => {
  it("starts at midnight Kyiv time (UTC+2 in winter)", () => {
    const day = getBusinessDay("Europe/Kyiv", new Date("2026-11-14T10:00:00Z"));
    expect(day.start.toISOString()).toBe("2026-11-13T22:00:00.000Z");
    expect(day.end.toISOString()).toBe("2026-11-14T22:00:00.000Z");
  });

  it("is already tomorrow in Kyiv when it is late evening in Warsaw", () => {
    // 23:30 in Warsaw is 00:30 the next day in Kyiv
    const day = getBusinessDay("Europe/Kyiv", new Date("2026-11-14T22:30:00Z"));
    expect(day.start.toISOString()).toBe("2026-11-14T22:00:00.000Z");
  });

  it("follows summer time (UTC+3 in Kyiv)", () => {
    const day = getBusinessDay("Europe/Kyiv", new Date("2026-07-01T12:00:00Z"));
    expect(day.start.toISOString()).toBe("2026-06-30T21:00:00.000Z");
  });

  it("has 23 hours on the day clocks go forward", () => {
    const day = getBusinessDay(
      "Europe/Warsaw",
      new Date("2026-03-29T12:00:00Z"),
    );
    expect(day.end.getTime() - day.start.getTime()).toBe(23 * 3_600_000);
  });

  it("writes the date in the interface language", () => {
    const { weekday, day } = formatBusinessDate(
      new Date("2026-11-14T10:00:00Z"),
      "Europe/Kyiv",
      "uk-UA",
    );
    expect(weekday).toBe("субота");
    expect(day).toBe("14 листопада");
  });
});
