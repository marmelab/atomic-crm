import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { CoreAdminContext } from "ra-core";

import { Notification } from "@/components/admin/notification";
import { createDataProvider } from "../providers/fakerest";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import { testI18nProvider } from "../providers/commons/i18nProvider";
import type { Task } from "../types";
import { TasksListByDueDate } from "./TasksListByDueDate";

// Human-acceptance repair, §3: pending Tasks must always sort before
// completed ones within a bucket (never the other way around, regardless
// of due date), and a completed Task must actually leave the active list
// on its own — no page refresh, no growing pile of crossed-out rows.
const CONTACT_ID = 1;

const buildTask = (overrides: Partial<Task> & { id: number }): Task => ({
  contact_id: CONTACT_ID,
  type: "other",
  text: `Task ${overrides.id}`,
  due_date: "2026-01-01T09:00:00.000Z",
  status: "pending",
  ...overrides,
});

const buildFixtures = (tasks: Task[]) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [buildContact({ id: CONTACT_ID })],
      tasks,
    } as any),
    silent: true,
  });
  return { dataProvider };
};

describe("TasksListByDueDate — ordering and completion presentation (human-acceptance repair)", () => {
  it("sorts a just-completed Task after pending ones in the same bucket, regardless of its own due date", async () => {
    // "Completed, earliest due date" would normally sort FIRST by
    // due_date alone (08:00, ahead of 09:00 and 15:00) — completing it
    // must move it after both still-pending Tasks despite that, proving
    // the pending/completed split wins over due-date order, never the
    // other way around.
    const { dataProvider } = buildFixtures([
      buildTask({
        id: 1,
        text: "Pending, later due date",
        due_date: "2026-01-01T15:00:00.000Z",
        status: "pending",
      }),
      buildTask({
        id: 2,
        text: "Completed, earliest due date",
        due_date: "2026-01-01T08:00:00.000Z",
        status: "pending",
      }),
      buildTask({
        id: 3,
        text: "Pending, earliest due date",
        due_date: "2026-01-01T09:00:00.000Z",
        status: "pending",
      }),
    ]);

    const screen = await render(
      <CoreAdminContext
        dataProvider={dataProvider}
        i18nProvider={testI18nProvider}
      >
        <TasksListByDueDate filterByContact={CONTACT_ID} />
      </CoreAdminContext>,
    );

    await expect
      .element(screen.getByText("Pending, later due date"))
      .toBeVisible();

    // Before completion, the whole bucket is due-date sorted, so id 2
    // ("Completed, earliest due date", 08:00) renders as the FIRST
    // checkbox — same Locator-based `.click()` Task.test.tsx's own
    // checkbox suite already relies on (a raw DOM `.click()` does not
    // reliably trigger this Radix Checkbox + react-admin `useUpdate`
    // combination the way it does for ClientShow's own plain-dataProvider
    // checklist checkbox).
    await screen.getByRole("checkbox").nth(0).click();

    // Within the brief confirmation window, it's still visible (checked)
    // but must already have moved after both still-pending Tasks.
    await expect
      .element(screen.getByText("Completed, earliest due date"))
      .toBeVisible();

    await expect
      .poll(() => {
        const text = screen.container.textContent ?? "";
        const firstPendingIndex = text.indexOf("Pending, earliest due date");
        const secondPendingIndex = text.indexOf("Pending, later due date");
        const completedIndex = text.indexOf("Completed, earliest due date");
        return (
          firstPendingIndex > -1 &&
          secondPendingIndex > -1 &&
          completedIndex > -1 &&
          // Both pending Tasks (regardless of due date) come before the
          // completed one, and within the pending group, earliest due
          // date first.
          firstPendingIndex < secondPendingIndex &&
          secondPendingIndex < completedIndex
        );
      })
      .toBe(true);
  });

  it("a completed Task leaves the active list on its own shortly after completion — no page refresh required", async () => {
    const { dataProvider } = buildFixtures([
      buildTask({ id: 1, text: "Still pending" }),
      buildTask({ id: 2, text: "About to be completed" }),
    ]);

    const screen = await render(
      <CoreAdminContext
        dataProvider={dataProvider}
        i18nProvider={testI18nProvider}
      >
        <TasksListByDueDate filterByContact={CONTACT_ID} />
        {/* The checkbox's own mutation is "undoable" — the real
            dataProvider write only happens once react-admin's Notification
            dequeues it, so it must be mounted for the assertion below to
            observe a genuine, persisted completion rather than only the
            optimistic cache. */}
        <Notification />
      </CoreAdminContext>,
    );

    await expect
      .element(screen.getByText("About to be completed"))
      .toBeVisible();

    // Same due_date for both — stable sort preserves insertion order, so
    // task id 2 ("About to be completed") is the SECOND checkbox.
    await screen.getByRole("checkbox").nth(1).click();

    // Immediately after checking: still visible, crossed out (brief
    // confirmation window) — proves it doesn't vanish instantly either.
    await expect
      .element(screen.getByText("About to be completed"))
      .toBeVisible();

    // Then, within a bounded time and with no further action from the
    // test (no refresh(), no re-render trigger), it leaves the active
    // list on its own.
    await expect
      .element(screen.getByText("About to be completed"), { timeout: 5000 })
      .not.toBeVisible();

    // Pending work stays visible throughout, undisturbed.
    await expect.element(screen.getByText("Still pending")).toBeVisible();

    // The underlying data reflects the real completion — a genuine
    // write, not merely a client-side display trick. Allows for
    // react-admin's own undoable-mutation delay on top of this
    // component's own short confirmation window.
    await expect
      .poll(
        async () => {
          const { data } = await dataProvider.getOne("tasks", { id: 2 });
          return data.status;
        },
        { timeout: 8000 },
      )
      .toBe("completed");
  });

  it("preserves completed Task history behind a collapsed disclosure, never deleting it", async () => {
    const { dataProvider } = buildFixtures([
      buildTask({ id: 1, text: "Still pending" }),
      buildTask({
        id: 2,
        text: "Long since completed",
        status: "completed",
        done_date: "2020-01-01T00:00:00.000Z",
      }),
    ]);

    const screen = await render(
      <CoreAdminContext
        dataProvider={dataProvider}
        i18nProvider={testI18nProvider}
      >
        <TasksListByDueDate filterByContact={CONTACT_ID} />
      </CoreAdminContext>,
    );

    await expect.element(screen.getByText("Still pending")).toBeVisible();
    // Collapsed by default — not visible until expanded.
    await expect
      .element(screen.getByText("Long since completed"))
      .not.toBeVisible();

    await screen.getByText("Completed tasks (1)").click();
    await expect
      .element(screen.getByText("Long since completed"))
      .toBeVisible();

    const { data: task } = await dataProvider.getOne("tasks", { id: 2 });
    expect(task.status).toBe("completed");
  });
});
