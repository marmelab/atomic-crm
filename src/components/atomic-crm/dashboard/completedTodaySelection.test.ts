import { describe, expect, it } from "vitest";

import type { Task } from "../types";
import { selectCompletedToday } from "./completedTodaySelection";

const buildTask = (overrides: Partial<Task> & Pick<Task, "id">): Task => ({
  contact_id: 1,
  type: "follow_up",
  text: "",
  due_date: "2026-06-01T00:00:00.000Z",
  done_date: null,
  ...overrides,
});

describe("selectCompletedToday", () => {
  // 2026-06-15T20:00:00.000Z is 2026-06-15 14:00 in Denver (MDT, UTC-6 in
  // June) — a fixed reference "now" (injected, never vi.useFakeTimers —
  // see this module's own header for why).
  const now = new Date("2026-06-15T20:00:00.000Z");

  it("includes a task completed earlier the same Denver day", () => {
    const task = buildTask({
      id: 1,
      done_date: "2026-06-15T14:00:00.000Z", // 08:00 Denver, same day
    });
    expect(selectCompletedToday([task], now)).toEqual([task]);
  });

  it("excludes a task completed yesterday in Denver", () => {
    const task = buildTask({
      id: 1,
      done_date: "2026-06-14T20:00:00.000Z", // 2026-06-14 14:00 Denver
    });
    expect(selectCompletedToday([task], now)).toEqual([]);
  });

  it("America/Denver boundary: includes a task completed late in the Denver evening even though its UTC calendar date is already tomorrow", () => {
    const task = buildTask({
      id: 1,
      // 2026-06-16T04:00:00.000Z is 2026-06-15 22:00 Denver — still
      // "today" in Denver, despite being a different UTC calendar date. A
      // naive UTC-date-string comparison would wrongly exclude this.
      done_date: "2026-06-16T04:00:00.000Z",
    });
    expect(selectCompletedToday([task], now)).toEqual([task]);
  });

  it("America/Denver boundary: excludes a task completed just after Denver midnight tomorrow", () => {
    const task = buildTask({
      id: 1,
      // 2026-06-16T07:00:00.000Z is 2026-06-16 01:00 Denver — already
      // tomorrow in Denver.
      done_date: "2026-06-16T07:00:00.000Z",
    });
    expect(selectCompletedToday([task], now)).toEqual([]);
  });

  it("excludes a pending (not yet completed) task", () => {
    const task = buildTask({ id: 1, done_date: null });
    expect(selectCompletedToday([task], now)).toEqual([]);
  });
});
