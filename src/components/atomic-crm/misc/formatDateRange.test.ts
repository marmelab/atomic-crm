import { describe, expect, it } from "vitest";

import { formatDateLong, formatDateRange } from "./formatDateRange";

describe("formatDateRange", () => {
  it("formats all-day timestamps on the Rome business date", () => {
    expect(formatDateRange("2026-03-09T23:00:00.000Z", undefined, true)).toBe(
      "10/03/2026",
    );
  });

  it("formats all-day ranges without browser-timezone drift", () => {
    expect(
      formatDateRange(
        "2026-03-09T23:00:00.000Z",
        "2026-03-10T23:00:00.000Z",
        true,
      ),
    ).toBe("10/03/2026 – 11/03/2026");
  });
});

describe("formatDateLong", () => {
  it("formats long all-day dates on the Rome business day", () => {
    expect(formatDateLong("2026-03-09T23:00:00.000Z", undefined, true)).toBe(
      "10 marzo 2026",
    );
  });
});
