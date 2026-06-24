import { describe, expect, it } from "vitest";
import {
  previousCalendarMonth,
  resolveVisibilityPeriod,
  rolling28Days,
} from "./visibilityPeriods.ts";

describe("visibility periods", () => {
  it("handles year boundaries for the previous calendar month", () => {
    expect(previousCalendarMonth(new Date("2026-01-04T06:00:00Z"))).toEqual({
      kind: "calendar_month",
      startDate: "2025-12-01",
      endDate: "2025-12-31",
    });
  });

  it("handles leap-year month lengths", () => {
    expect(previousCalendarMonth(new Date("2024-03-04T06:00:00Z"))).toEqual({
      kind: "calendar_month",
      startDate: "2024-02-01",
      endDate: "2024-02-29",
    });
  });

  it("creates an inclusive 28 day rolling window", () => {
    expect(rolling28Days(new Date("2026-06-23T12:00:00Z"))).toEqual({
      kind: "rolling_28d",
      startDate: "2026-05-27",
      endDate: "2026-06-23",
    });
  });

  it("defaults to the previous calendar month when no kind is given", () => {
    expect(
      resolveVisibilityPeriod({ now: new Date("2026-06-24T06:00:00Z") }),
    ).toEqual({
      kind: "calendar_month",
      startDate: "2026-05-01",
      endDate: "2026-05-31",
    });
  });

  it("accepts an explicit validated date range", () => {
    expect(
      resolveVisibilityPeriod({
        kind: "calendar_month",
        startDate: "2026-05-01",
        endDate: "2026-05-31",
      }),
    ).toEqual({
      kind: "calendar_month",
      startDate: "2026-05-01",
      endDate: "2026-05-31",
    });
  });
});
