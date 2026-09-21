import { describe, expect, test } from "vitest";

import {
  cohortDateRange,
  cohortSchedule,
  durationLabel,
  endDateFor,
} from "./cohortDates";

describe("Start + Duration produces an End", () => {
  test("Fall 2026: 22 September plus 8 weeks is 10 November", () => {
    // The owner-confirmed round, and the arithmetic that has to land on it.
    // Eight weeks means eight weekly sessions, so the last one begins
    // seven weeks after the first. Counting eight would put the cohort a
    // week out in front of ten people.
    expect(endDateFor("2026-09-22", { value: 8, unit: "weeks" })).toBe(
      "2026-11-10",
    );
  });

  test("a one-week round starts and ends in the same week", () => {
    expect(endDateFor("2026-09-22", { value: 1, unit: "weeks" })).toBe(
      "2026-09-22",
    );
  });

  test("months clamp to a real day rather than overflowing", () => {
    expect(endDateFor("2026-01-31", { value: 1, unit: "months" })).toBe(
      "2026-02-28",
    );
  });

  test("nothing is derived without both halves", () => {
    expect(endDateFor(null, { value: 8, unit: "weeks" })).toBeNull();
    expect(endDateFor("2026-09-22", null)).toBeNull();
    expect(endDateFor("2026-09-22", { value: 0, unit: "weeks" })).toBeNull();
  });
});

describe("a recorded End date is authoritative", () => {
  test("an explicit end wins over the arithmetic", () => {
    // A round that overran, or took a week off in the middle, is a fact
    // about that round. The CRM does not correct it back to the formula.
    const schedule = cohortSchedule({
      program_start_at: "2026-09-22",
      program_end_at: "2026-11-24",
      duration_value: 8,
      duration_unit: "weeks",
    });
    expect(schedule.endDate).toBe("2026-11-24");
    expect(schedule.endIsExplicit).toBe(true);
  });

  test("without an explicit end, the duration fills it in", () => {
    const schedule = cohortSchedule({
      program_start_at: "2026-09-22",
      program_end_at: null,
      duration_value: 8,
      duration_unit: "weeks",
    });
    expect(schedule.endDate).toBe("2026-11-10");
    expect(schedule.endIsExplicit).toBe(false);
  });

  test("changing the duration moves a derived end, and not an explicit one", () => {
    const base = {
      program_start_at: "2026-09-22",
      duration_unit: "weeks" as const,
    };
    expect(
      cohortSchedule({ ...base, program_end_at: null, duration_value: 10 })
        .endDate,
    ).toBe("2026-11-24");
    expect(
      cohortSchedule({
        ...base,
        program_end_at: "2026-11-10",
        duration_value: 10,
      }).endDate,
    ).toBe("2026-11-10");
  });

  test("a cohort with no dates at all says so rather than guessing", () => {
    // January 2027 today: 51 people waiting and nothing scheduled.
    const schedule = cohortSchedule({
      program_start_at: null,
      program_end_at: null,
      duration_value: 8,
      duration_unit: "weeks",
    });
    expect(schedule.startDate).toBeNull();
    expect(schedule.endDate).toBeNull();
    expect(cohortDateRange(schedule)).toBeNull();
  });
});

describe("what a card shows", () => {
  test("the range reads the way Leif writes it", () => {
    const schedule = cohortSchedule({
      program_start_at: "2026-09-22",
      program_end_at: "2026-11-10",
      duration_value: 8,
      duration_unit: "weeks",
    });
    expect(cohortDateRange(schedule)).toBe("Sep 22 – Nov 10");
  });

  test("a start with no end shows the start alone", () => {
    expect(
      cohortDateRange(
        cohortSchedule({
          program_start_at: "2026-09-22",
          program_end_at: null,
          duration_value: null,
          duration_unit: null,
        }),
      ),
    ).toBe("Sep 22");
  });

  test("the duration label is derived, never stored beside the number", () => {
    expect(durationLabel({ value: 8, unit: "weeks" })).toBe("8 weeks");
    expect(durationLabel({ value: 1, unit: "week" as "weeks" })).toBe("1 week");
    expect(durationLabel({ value: 4, unit: "months" })).toBe("4 months");
    expect(durationLabel(null)).toBeNull();
  });
});
