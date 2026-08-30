import { describe, expect, test } from "vitest";
import { computeLivingExampleCapacity } from "./livingExampleCapacity";

const now = new Date("2026-08-30T12:00:00Z");

describe("computeLivingExampleCapacity", () => {
  test("counts Onboarding/Active/Offboarding as active", () => {
    const { active } = computeLivingExampleCapacity(
      [
        { status: "onboarding", end_date: null },
        { status: "active", end_date: null },
        { status: "offboarding", end_date: null },
      ],
      12,
      now,
    );
    expect(active).toBe(3);
  });

  test("does not count Completed enrollments as active", () => {
    const { active } = computeLivingExampleCapacity(
      [
        { status: "active", end_date: null },
        { status: "completed", end_date: null },
      ],
      12,
      now,
    );
    expect(active).toBe(1);
  });

  test("computes openings as max minus active", () => {
    const { openings } = computeLivingExampleCapacity(
      [
        { status: "active", end_date: null },
        { status: "active", end_date: null },
      ],
      12,
      now,
    );
    expect(openings).toBe(10);
  });

  test("openings is null when max is unknown", () => {
    const { openings } = computeLivingExampleCapacity(
      [{ status: "active", end_date: null }],
      null,
      now,
    );
    expect(openings).toBeNull();
  });

  test("derives the next opening from the earliest future active end_date", () => {
    const { nextOpening } = computeLivingExampleCapacity(
      [
        { status: "active", end_date: "2026-09-18" },
        { status: "active", end_date: "2026-10-01" },
      ],
      12,
      now,
    );
    expect(nextOpening?.date).toBe("2026-09-18");
    expect(nextOpening?.countInMonth).toBe(1);
  });

  test("counts multiple openings sharing the same month", () => {
    const { nextOpening } = computeLivingExampleCapacity(
      [
        { status: "active", end_date: "2026-09-05" },
        { status: "active", end_date: "2026-09-18" },
        { status: "active", end_date: "2026-11-01" },
      ],
      12,
      now,
    );
    expect(nextOpening?.date).toBe("2026-09-05");
    expect(nextOpening?.countInMonth).toBe(2);
  });

  test("ignores past end_dates and Completed enrollments for next opening", () => {
    const { nextOpening } = computeLivingExampleCapacity(
      [
        { status: "active", end_date: "2026-01-01" }, // past
        { status: "completed", end_date: "2026-09-01" }, // not occupying capacity
      ],
      12,
      now,
    );
    expect(nextOpening).toBeNull();
  });

  test("nextOpening is null when nothing is ending", () => {
    const { nextOpening } = computeLivingExampleCapacity(
      [{ status: "active", end_date: null }],
      12,
      now,
    );
    expect(nextOpening).toBeNull();
  });
});
