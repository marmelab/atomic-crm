import { describe, expect, test } from "vitest";

import { addMonths, projectedEndDate } from "./projectedEnd";

describe("projectedEndDate", () => {
  test("a recorded end date is authoritative and labelled as recorded", () => {
    expect(
      projectedEndDate({ start_date: "2026-06-14", end_date: "2026-12-31" }, 4),
    ).toEqual({ date: "2026-12-31", basis: "recorded" });
  });

  test("a recorded end date wins even when it disagrees with the arithmetic", () => {
    // A container that was extended or cut short is still the truth.
    const { date, basis } = projectedEndDate(
      { start_date: "2026-06-14", end_date: "2027-06-14" },
      4,
    );
    expect(date).toBe("2027-06-14");
    expect(basis).toBe("recorded");
  });

  test("four months after the start, when that is all there is", () => {
    expect(
      projectedEndDate({ start_date: "2026-06-14", end_date: null }, 4),
    ).toEqual({ date: "2026-10-14", basis: "projected" });
  });

  test("no start date produces unknown, never an invented date", () => {
    expect(projectedEndDate({ start_date: null, end_date: null }, 4)).toEqual({
      date: null,
      basis: "unknown",
    });
  });

  test("no recorded programme length produces unknown, never a guess", () => {
    // Growing Yourself Up runs to its Cohort's dates; the legacy 1:1
    // Offer's own duration reads "Varies (historical)". Neither is four
    // months, and neither may be treated as though it were.
    expect(
      projectedEndDate({ start_date: "2026-06-14", end_date: null }, null),
    ).toEqual({ date: null, basis: "unknown" });
  });

  test("a nonsensical programme length produces unknown rather than a date in the past", () => {
    expect(
      projectedEndDate({ start_date: "2026-06-14", end_date: null }, 0),
    ).toEqual({ date: null, basis: "unknown" });
  });
});

describe("addMonths", () => {
  test("crosses a year boundary", () => {
    expect(addMonths("2026-11-08", 4)).toBe("2027-03-08");
  });

  test("clamps to the last day of a shorter month instead of overflowing into the next", () => {
    // Plain Date arithmetic turns 31 October + 4 months into 3 March. A
    // capacity board that quietly moves somebody's finish into the next
    // month is worse than one that admits what it does not know.
    expect(addMonths("2026-10-31", 4)).toBe("2027-02-28");
    expect(addMonths("2027-10-31", 4)).toBe("2028-02-29");
  });

  test("keeps the day of month when the target month is long enough", () => {
    expect(addMonths("2026-08-17", 4)).toBe("2026-12-17");
  });

  test("a leap day projects onto a real date", () => {
    expect(addMonths("2028-02-29", 12)).toBe("2029-02-28");
  });
});
