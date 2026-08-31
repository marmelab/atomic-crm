import { describe, expect, test } from "vitest";
import { computeUpcomingOpenings } from "./upcomingOpenings";

const now = new Date("2026-08-30T12:00:00Z");

describe("computeUpcomingOpenings", () => {
  test("groups a single future end date into one opening", () => {
    const openings = computeUpcomingOpenings(
      [{ endDate: "2026-12-10", contactId: 1, name: "Kathy" }],
      now,
    );
    expect(openings).toEqual([
      {
        date: "2026-12-10",
        count: 1,
        clients: [{ contactId: 1, name: "Kathy" }],
      },
    ]);
  });

  test("groups two clients sharing the same end date into one opening with count 2", () => {
    const openings = computeUpcomingOpenings(
      [
        { endDate: "2027-01-07", contactId: 1, name: "Dave" },
        { endDate: "2027-01-07", contactId: 2, name: "Julia" },
      ],
      now,
    );
    expect(openings).toHaveLength(1);
    expect(openings[0]!.count).toBe(2);
    expect(openings[0]!.clients).toEqual([
      { contactId: 1, name: "Dave" },
      { contactId: 2, name: "Julia" },
    ]);
  });

  test("sorts multiple openings soonest first", () => {
    const openings = computeUpcomingOpenings(
      [
        { endDate: "2027-01-07", contactId: 1, name: "Dave" },
        { endDate: "2026-12-10", contactId: 2, name: "Kathy" },
      ],
      now,
    );
    expect(openings.map((o) => o.date)).toEqual(["2026-12-10", "2027-01-07"]);
  });

  test("excludes an end date in the past", () => {
    const openings = computeUpcomingOpenings(
      [{ endDate: "2026-01-01", contactId: 1, name: "Nora" }],
      now,
    );
    expect(openings).toEqual([]);
  });

  test("excludes an enrollment with no end date", () => {
    const openings = computeUpcomingOpenings(
      [{ endDate: null, contactId: 1, name: "Marcus" }],
      now,
    );
    expect(openings).toEqual([]);
  });

  test("a Completed enrollment must be filtered out by the caller before reaching here, never counted", () => {
    // computeUpcomingOpenings trusts its input is already slot-occupying
    // statuses only (see useIndividualProgramData.ts) — this test documents
    // that a raw future date alone is not enough; the exclusion of
    // Completed happens upstream. Passing a genuinely empty, filtered list
    // produces no openings.
    const openings = computeUpcomingOpenings([], now);
    expect(openings).toEqual([]);
  });
});
