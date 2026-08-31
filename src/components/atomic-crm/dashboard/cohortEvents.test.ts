import { describe, expect, test } from "vitest";
import {
  computeCohortEvents,
  computeEnrolledCountByCohort,
} from "./cohortEvents";

const today = "2026-08-31";

const baseCohort = {
  id: 1,
  name: "September GYU Cohort",
  applications_open_at: null as string | null,
  applications_close_at: null as string | null,
  program_start_at: null as string | null,
  program_end_at: null as string | null,
  maximum_capacity: 10 as number | null,
};

describe("computeCohortEvents", () => {
  test("produces one event per set structured date, never inferred", () => {
    const events = computeCohortEvents(
      [
        {
          ...baseCohort,
          applications_open_at: "2026-08-15", // past — excluded
          applications_close_at: "2026-09-19",
          program_start_at: "2026-09-22",
          program_end_at: "2026-11-10",
        },
      ],
      new Map(),
      today,
    );

    expect(events.map((e) => e.kind)).toEqual([
      "applications_close",
      "cohort_start",
      "cohort_end",
    ]);
  });

  test("excludes a date column that is null — never fabricates a date", () => {
    const events = computeCohortEvents(
      [{ ...baseCohort, program_start_at: "2026-09-22" }],
      new Map(),
      today,
    );
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe("cohort_start");
  });

  test("excludes a date strictly before today", () => {
    const events = computeCohortEvents(
      [{ ...baseCohort, program_start_at: "2026-08-30" }],
      new Map(),
      today,
    );
    expect(events).toHaveLength(0);
  });

  test("includes a date that is exactly today", () => {
    const events = computeCohortEvents(
      [{ ...baseCohort, program_start_at: today }],
      new Map(),
      today,
    );
    expect(events).toHaveLength(1);
  });

  test("sorts events chronologically across multiple Cohorts", () => {
    const events = computeCohortEvents(
      [
        {
          ...baseCohort,
          id: 1,
          name: "November",
          program_start_at: "2026-11-17",
        },
        {
          ...baseCohort,
          id: 2,
          name: "September",
          program_start_at: "2026-09-22",
        },
      ],
      new Map(),
      today,
    );
    expect(events.map((e) => e.cohortName)).toEqual(["September", "November"]);
  });

  test("carries the enrolled count and max capacity for each Cohort", () => {
    const events = computeCohortEvents(
      [{ ...baseCohort, program_start_at: "2026-09-22", maximum_capacity: 10 }],
      new Map([["1", 4]]),
      today,
    );
    expect(events[0]!.enrolledCount).toBe(4);
    expect(events[0]!.maxCapacity).toBe(10);
  });

  test("defaults to zero enrolled when the Cohort has no active enrollments", () => {
    const events = computeCohortEvents(
      [{ ...baseCohort, program_start_at: "2026-09-22" }],
      new Map(),
      today,
    );
    expect(events[0]!.enrolledCount).toBe(0);
  });
});

describe("computeEnrolledCountByCohort", () => {
  test("counts only Onboarding/Active/Offboarding enrollments, grouped by Cohort via the Deal", () => {
    const counts = computeEnrolledCountByCohort(
      [
        { id: 10, cohort_id: 1 },
        { id: 11, cohort_id: 1 },
        { id: 12, cohort_id: 2 },
      ],
      [
        { opportunity_id: 10, status: "active" },
        { opportunity_id: 11, status: "onboarding" },
        { opportunity_id: 12, status: "active" },
      ],
    );
    expect(counts.get("1")).toBe(2);
    expect(counts.get("2")).toBe(1);
  });

  test("excludes Completed enrollments — they no longer occupy a seat", () => {
    const counts = computeEnrolledCountByCohort(
      [{ id: 10, cohort_id: 1 }],
      [{ opportunity_id: 10, status: "completed" }],
    );
    expect(counts.get("1")).toBeUndefined();
  });

  test("ignores a Deal with no Cohort (an individual-Offer Opportunity)", () => {
    const counts = computeEnrolledCountByCohort(
      [{ id: 10, cohort_id: null }],
      [{ opportunity_id: 10, status: "active" }],
    );
    expect(counts.size).toBe(0);
  });
});
