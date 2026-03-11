import { describe, expect, it } from "vitest";

import { filterTasksByView, getTasksFilter } from "./tasksListView";

describe("TasksListByDueDate helpers", () => {
  it("filters my tasks by assignee (sales_id)", () => {
    expect(getTasksFilter({ identityId: 7 })).toEqual({ sales_id: 7 });
  });

  it("filters contact tasks by contact_id", () => {
    expect(getTasksFilter({ filterByContact: 42, identityId: 7 })).toEqual({
      contact_id: 42,
    });
  });

  it("keeps recently done tasks in active view only when explicitly enabled", () => {
    const openTask = { due_date: "2026-03-10T10:00:00.000Z", done_date: null };
    const recentDoneTask = {
      due_date: "2026-03-10T10:00:00.000Z",
      done_date: new Date().toISOString(),
    };
    const oldDoneTask = {
      due_date: "2026-03-10T10:00:00.000Z",
      done_date: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    };

    expect(
      filterTasksByView([openTask, recentDoneTask, oldDoneTask], {
        view: "active",
        keepRecentlyDone: true,
      }),
    ).toEqual([openTask, recentDoneTask]);

    expect(
      filterTasksByView([openTask, recentDoneTask, oldDoneTask], {
        view: "active",
        keepRecentlyDone: false,
      }),
    ).toEqual([openTask]);
  });

  it("keeps only done tasks in archived view", () => {
    const openTask = { due_date: "2026-03-10T10:00:00.000Z", done_date: null };
    const doneTask = {
      due_date: "2026-03-10T10:00:00.000Z",
      done_date: new Date().toISOString(),
    };

    expect(
      filterTasksByView([openTask, doneTask], {
        view: "archived",
        keepRecentlyDone: false,
      }),
    ).toEqual([doneTask]);
  });
});
