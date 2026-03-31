import { describe, expect, it } from "vitest";

import {
  normalizeTaskDueDateForMutation,
  postponeTaskDueDate,
} from "./taskDueDate";

describe("normalizeTaskDueDateForMutation", () => {
  it("stores all-day task dates at the start of the Rome business day", () => {
    expect(normalizeTaskDueDateForMutation("2026-03-10", true)).toBe(
      "2026-03-09T23:00:00.000Z",
    );
  });

  it("preserves datetime tasks as-is", () => {
    expect(
      normalizeTaskDueDateForMutation("2026-03-10T14:30:00.000Z", false),
    ).toBe("2026-03-10T14:30:00.000Z");
  });
});

describe("postponeTaskDueDate", () => {
  it("postpones all-day tasks by business days without drifting timezone", () => {
    expect(
      postponeTaskDueDate("2026-03-09T23:00:00.000Z", 1, true),
    ).toBe("2026-03-10T23:00:00.000Z");
  });

  it("handles DST boundary for all-day tasks", () => {
    expect(
      postponeTaskDueDate("2026-03-28T23:00:00.000Z", 1, true),
    ).toBe("2026-03-29T22:00:00.000Z");
  });

  it("preserves time of day for datetime tasks", () => {
    expect(
      postponeTaskDueDate("2026-03-10T14:30:00.000Z", 7, false),
    ).toBe("2026-03-17T14:30:00.000Z");
  });
});
