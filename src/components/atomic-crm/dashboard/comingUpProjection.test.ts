import { describe, expect, test } from "vitest";
import { buildComingUpItems } from "./comingUpProjection";
import type { CohortEvent } from "./cohortEvents";
import type { UpcomingOpening } from "../programs/upcomingOpenings";

const cohortEvent = (overrides: Partial<CohortEvent> = {}): CohortEvent => ({
  cohortId: 1,
  cohortName: "September GYU Cohort",
  kind: "cohort_start",
  date: "2026-09-22",
  enrolledCount: 1,
  maxCapacity: 10,
  ...overrides,
});

describe("buildComingUpItems", () => {
  test("sorts Living Example and Cohort events into one chronological list", () => {
    const upcomingOpenings: UpcomingOpening[] = [
      {
        date: "2026-10-31",
        count: 1,
        clients: [{ contactId: 1, name: "Kathy Reyes" }],
      },
    ];
    const cohortEvents: CohortEvent[] = [
      cohortEvent({ date: "2026-09-22", kind: "cohort_start" }),
      cohortEvent({ date: "2026-11-10", kind: "cohort_end" }),
    ];

    const items = buildComingUpItems({
      leOfferId: 1,
      upcomingOpenings,
      cohortEvents,
      limit: 10,
    });

    expect(items.map((i) => i.date)).toEqual([
      "2026-09-22",
      "2026-10-31",
      "2026-11-10",
    ]);
  });

  test("one client completing produces exactly one Living Example event, not a separate opening row", () => {
    const items = buildComingUpItems({
      leOfferId: 1,
      upcomingOpenings: [
        {
          date: "2026-10-31",
          count: 1,
          clients: [{ contactId: 1, name: "Kathy Reyes" }],
        },
      ],
      cohortEvents: [],
      limit: 10,
    });

    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.type).toBe("living_example_opening");
    if (item.type !== "living_example_opening") throw new Error("unreachable");
    expect(item.clientNames).toEqual(["Kathy Reyes"]);
    expect(item.openingCount).toBe(1);
  });

  test("two same-date completions stay grouped as one event with count 2", () => {
    const items = buildComingUpItems({
      leOfferId: 1,
      upcomingOpenings: [
        {
          date: "2026-12-01",
          count: 2,
          clients: [
            { contactId: 1, name: "Dave Kim" },
            { contactId: 2, name: "Julia Chen" },
          ],
        },
      ],
      cohortEvents: [],
      limit: 10,
    });

    expect(items).toHaveLength(1);
    const item = items[0]!;
    if (item.type !== "living_example_opening") throw new Error("unreachable");
    expect(item.clientNames).toEqual(["Dave Kim", "Julia Chen"]);
    expect(item.openingCount).toBe(2);
  });

  test("no Living Example events are produced when there is no LE Offer", () => {
    const items = buildComingUpItems({
      leOfferId: null,
      upcomingOpenings: [
        {
          date: "2026-10-31",
          count: 1,
          clients: [{ contactId: 1, name: "Kathy Reyes" }],
        },
      ],
      cohortEvents: [],
      limit: 10,
    });
    expect(items).toHaveLength(0);
  });

  test("Living Example destination points at the Program page's Upcoming Openings anchor", () => {
    const items = buildComingUpItems({
      leOfferId: 7,
      upcomingOpenings: [
        {
          date: "2026-10-31",
          count: 1,
          clients: [{ contactId: 1, name: "Kathy Reyes" }],
        },
      ],
      cohortEvents: [],
      limit: 10,
    });
    expect(items[0]!.destination).toBe(
      "/programs/individual/7#upcoming-openings",
    );
  });

  test("Cohort event destination points at that Cohort's own page", () => {
    const items = buildComingUpItems({
      leOfferId: null,
      upcomingOpenings: [],
      cohortEvents: [cohortEvent({ cohortId: 5 })],
      limit: 10,
    });
    expect(items[0]!.destination).toBe("/cohorts/5/show");
  });

  test("caps the combined list at the given limit, keeping the nearest events", () => {
    const cohortEvents: CohortEvent[] = Array.from({ length: 12 }, (_, i) =>
      cohortEvent({
        cohortId: i,
        date: `2026-09-${String(i + 1).padStart(2, "0")}`,
        kind: "cohort_start",
      }),
    );

    const items = buildComingUpItems({
      leOfferId: null,
      upcomingOpenings: [],
      cohortEvents,
      limit: 8,
    });

    expect(items).toHaveLength(8);
    expect(items[0]!.date).toBe("2026-09-01");
    expect(items[7]!.date).toBe("2026-09-08");
  });

  test("each Cohort event kind maps to a distinct item type", () => {
    const items = buildComingUpItems({
      leOfferId: null,
      upcomingOpenings: [],
      cohortEvents: [
        cohortEvent({ kind: "applications_open", date: "2026-09-01" }),
        cohortEvent({ kind: "applications_close", date: "2026-09-02" }),
        cohortEvent({ kind: "cohort_start", date: "2026-09-03" }),
        cohortEvent({ kind: "cohort_end", date: "2026-09-04" }),
      ],
      limit: 10,
    });
    expect(items.map((i) => i.type)).toEqual([
      "cohort_applications_open",
      "cohort_applications_close",
      "cohort_start",
      "cohort_end",
    ]);
  });
});
