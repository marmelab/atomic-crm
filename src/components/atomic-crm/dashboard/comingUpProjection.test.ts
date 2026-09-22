import { describe, expect, test } from "vitest";
import { buildComingUpItems } from "./comingUpProjection";
import type { CohortEvent } from "./cohortEvents";
import type { OpeningsMonth, SlotHolder } from "../capacity/individualCapacity";

const holder = (name: string, id: number): SlotHolder => ({
  enrollmentId: id,
  contactId: id,
  name,
  status: "active",
  startDate: "2026-06-30",
  startWeekConfirmed: true,
  startDateSource: "owner",
  extensions: 0,
  unresolvedCadenceWeeks: 0,
  end: {
    status: "known",
    finalWeek: { start: "2026-10-26", end: "2026-10-31" },
    lastDay: "2026-10-30",
    freesOn: "2026-10-31",
    weeksRequired: 12,
    extensions: 0,
  },
});

const openingsMonth = (
  month: string,
  freeing: SlotHolder[],
  openings: number,
  committing: SlotHolder[] = [],
): OpeningsMonth => ({
  month,
  freeing,
  committing,
  openings: { status: "known", openings, peakOccupancy: 12 - openings },
  earliestSafeStart: null,
  peakOccupancy: 12 - openings,
  overCapacityBy: 0,
  restsOnUnconfirmedDates: false,
});

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
    const openingsMonths: OpeningsMonth[] = [
      openingsMonth("2026-10", [holder("Kathy Reyes", 1)], 1),
    ];
    const cohortEvents: CohortEvent[] = [
      cohortEvent({ date: "2026-09-22", kind: "cohort_start" }),
      cohortEvent({ date: "2026-11-10", kind: "cohort_end" }),
    ];

    const items = buildComingUpItems({
      individualOfferId: 1,
      individualOfferName: "The Living Example",
      openingsMonths,
      cohortEvents,
      limit: 10,
    });

    expect(items.map((i) => i.date)).toEqual([
      "2026-09-22",
      "2026-10-01",
      "2026-11-10",
    ]);
  });

  test("one client completing produces exactly one Living Example event, not a separate opening row", () => {
    const items = buildComingUpItems({
      individualOfferId: 1,
      individualOfferName: "The Living Example",
      openingsMonths: [openingsMonth("2026-10", [holder("Kathy Reyes", 1)], 1)],
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

  test("two completions in one month stay grouped as one event with count 2", () => {
    const items = buildComingUpItems({
      individualOfferId: 1,
      individualOfferName: "The Living Example",
      openingsMonths: [
        openingsMonth(
          "2026-12",
          [holder("Dave Kim", 1), holder("Julia Chen", 2)],
          2,
        ),
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
      individualOfferId: null,
      individualOfferName: "The Living Example",
      openingsMonths: [openingsMonth("2026-10", [holder("Kathy Reyes", 1)], 1)],
      cohortEvents: [],
      limit: 10,
    });
    expect(items).toHaveLength(0);
  });

  test("Living Example destination points at the Program page's Upcoming Openings anchor", () => {
    const items = buildComingUpItems({
      individualOfferId: 7,
      individualOfferName: "The Living Example",
      openingsMonths: [openingsMonth("2026-10", [holder("Kathy Reyes", 1)], 1)],
      cohortEvents: [],
      limit: 10,
    });
    expect(items[0]!.destination).toBe(
      "/programs/individual/7#upcoming-openings",
    );
  });

  test("Cohort event destination points at that Cohort's own page", () => {
    const items = buildComingUpItems({
      individualOfferId: null,
      individualOfferName: "The Living Example",
      openingsMonths: [],
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
      individualOfferId: null,
      individualOfferName: "The Living Example",
      openingsMonths: [],
      cohortEvents,
      limit: 8,
    });

    expect(items).toHaveLength(8);
    expect(items[0]!.date).toBe("2026-09-01");
    expect(items[7]!.date).toBe("2026-09-08");
  });

  test("a month whose departures are already spoken for is not announced as an opening", () => {
    // Two clients finish in October and two already-agreed clients start
    // in October. Nothing is free, so nothing is offered — announcing it
    // would invite Leif to sell a slot he has already sold.
    const items = buildComingUpItems({
      individualOfferId: 1,
      individualOfferName: "The Living Example",
      openingsMonths: [
        openingsMonth("2026-10", [holder("Adriano", 1), holder("Jess", 2)], 0, [
          holder("Ava", 3),
          holder("Denise", 4),
        ]),
        openingsMonth("2026-11", [holder("Gigi", 5)], 1),
      ],
      cohortEvents: [],
      limit: 10,
    });

    expect(items).toHaveLength(1);
    const item = items[0]!;
    if (item.type !== "living_example_opening") throw new Error("unreachable");
    expect(item.month).toBe("2026-11");
  });

  test("an opening carries the month it belongs to, not a day nobody promised", () => {
    const items = buildComingUpItems({
      individualOfferId: 1,
      individualOfferName: "The Living Example",
      openingsMonths: [openingsMonth("2026-10", [holder("Kathy Reyes", 1)], 1)],
      cohortEvents: [],
      limit: 10,
    });
    const item = items[0]!;
    if (item.type !== "living_example_opening") throw new Error("unreachable");
    expect(item.month).toBe("2026-10");
    expect(item.date).toBe("2026-10-01");
  });

  test("each Cohort event kind maps to a distinct item type", () => {
    const items = buildComingUpItems({
      individualOfferId: null,
      individualOfferName: "The Living Example",
      openingsMonths: [],
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
