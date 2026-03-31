import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

describe("taskFilters", () => {
  it("builds task buckets using the Europe/Rome business day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T23:30:00.000Z"));

    const { taskFilters, isBeforeFriday } = await import("./taskFilters");

    expect(isBeforeFriday).toBe(true);
    expect(taskFilters.overdue).toEqual({
      "done_date@is": null,
      "due_date@lt": "2026-03-09T23:00:00.000Z",
    });
    expect(taskFilters.today).toEqual({
      "done_date@is": null,
      "due_date@gte": "2026-03-09T23:00:00.000Z",
      "due_date@lte": "2026-03-10T22:59:59.999Z",
    });
    expect(taskFilters.tomorrow).toEqual({
      "done_date@is": null,
      "due_date@gte": "2026-03-10T23:00:00.000Z",
      "due_date@lte": "2026-03-11T22:59:59.999Z",
    });
  });
});
