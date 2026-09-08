import { ResourceContextProvider, ShowBase } from "ra-core";
import { render } from "vitest-browser-react";
import { buildContact, StoryWrapper } from "@/test/StoryWrapper";
import type { Task } from "../types";
import { ContactTasksList } from "./ContactTasksList";

// Manual Task UX repair, mobile ContactShow: the previous "Add task"
// button lived ONLY inside TasksListByDueDate's own emptyPlaceholder —
// available for the one moment a Contact had zero tasks, gone the
// instant a first task existed, with no replacement anywhere on mobile.
// These prove the fix holds across 0 / 1 / completed-only tasks — the
// exact matrix the repair was scoped against.
const buildTask = (overrides: Partial<Task> & { id: number }): Task => ({
  contact_id: 1,
  type: "other",
  text: "Some task",
  due_date: "2026-01-05T09:00:00.000Z",
  status: "pending",
  sales_id: 0,
  ...overrides,
});

const renderContactTasksList = async (tasks: Task[]) => {
  const contact = buildContact({
    id: 1,
    first_name: "Maya",
    last_name: "Chen",
  });
  return render(
    <StoryWrapper data={{ contacts: [contact], tasks }}>
      <ResourceContextProvider value="contacts">
        <ShowBase id={contact.id}>
          <ContactTasksList />
        </ShowBase>
      </ResourceContextProvider>
    </StoryWrapper>,
  );
};

describe("ContactTasksList (mobile Manual Task UX repair)", () => {
  it("F: exposes Add Task with zero existing Tasks", async () => {
    const screen = await renderContactTasksList([]);

    await expect
      .element(screen.getByRole("button", { name: "Add task" }))
      .toBeVisible();
  });

  it("G: still exposes Add Task once a Task exists", async () => {
    const screen = await renderContactTasksList([
      buildTask({ id: 1, text: "Ask about scheduling" }),
    ]);

    await expect
      .element(screen.getByRole("button", { name: "Add task" }))
      .toBeVisible();
  });

  it("G: still exposes Add Task when every existing Task is already completed", async () => {
    const screen = await renderContactTasksList([
      buildTask({
        id: 1,
        text: "Old task",
        status: "completed",
        done_date: "2020-01-01T00:00:00.000Z",
      }),
    ]);

    await expect
      .element(screen.getByRole("button", { name: "Add task" }))
      .toBeVisible();
  });
});
