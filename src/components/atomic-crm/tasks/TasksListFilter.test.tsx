import React from "react";
import { render } from "vitest-browser-react";
import { CoreAdminContext } from "ra-core";
import fakeDataProvider from "ra-data-fakerest";

import { TaskListFilter } from "./TasksListFilter";

const today = new Date();
const iso = (d: Date) => d.toISOString();

// Tasks information-hierarchy pass: the primary title is now
// "{Task Type}: {Person Name}" (or just the type when there's no contact
// context to show — see tasks/Task.tsx's own typeLabel helper), not
// task.text — so each task needs a distinguishable `type` (not `text`) to
// count how many are visibly rendered after "Load more".
const createTask = (id: number, dueDate: Date, doneDate?: Date) => ({
  id,
  due_date: iso(dueDate),
  done_date: doneDate ? iso(doneDate) : null,
  contact_id: null,
  sales_id: null,
  type: `call-${id}`,
  text: `Task ${id}`,
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <CoreAdminContext
    dataProvider={fakeDataProvider({ tasks: [], contacts: [], sales: [] })}
    i18nProvider={{
      translate: (key, options) => {
        if (key === "crm.common.load_more") {
          return "Load more";
        }
        if (key === "resources.tasks.unknown_contact") {
          return "Unknown contact";
        }
        if (typeof options?._ === "string") {
          return options._;
        }
        return key;
      },
      changeLocale: () => Promise.resolve(),
      getLocale: () => "en",
    }}
  >
    {children}
  </CoreAdminContext>
);

describe("TaskListFilter", () => {
  it("renders nothing when tasks array is empty", async () => {
    const { container } = await render(
      <TaskListFilter tasks={[]} title="Today" isMobile={false} />,
      { wrapper: Wrapper },
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders the section title", async () => {
    const tasks = [createTask(1, today)];
    const screen = await render(
      <TaskListFilter tasks={tasks} title="Today" isMobile={false} />,
      {
        wrapper: Wrapper,
      },
    );
    await expect.element(screen.getByText("Today")).toBeInTheDocument();
  });

  it("does not show Load more when tasks fit in one page", async () => {
    const tasks = Array.from({ length: 3 }, (_, i) => createTask(i + 1, today));
    const screen = await render(
      <TaskListFilter tasks={tasks} title="Today" isMobile={false} />,
      {
        wrapper: Wrapper,
      },
    );
    await expect.element(screen.getByText("Load more")).not.toBeInTheDocument();
  });

  it("shows Load more when tasks exceed page size", async () => {
    const tasks = Array.from({ length: 8 }, (_, i) => createTask(i + 1, today));
    const screen = await render(
      <TaskListFilter tasks={tasks} title="Today" isMobile={false} />,
      {
        wrapper: Wrapper,
      },
    );
    await expect.element(screen.getByText("Load more")).toBeInTheDocument();
  });

  it("Load more increases visible page size", async () => {
    const tasks = Array.from({ length: 8 }, (_, i) => createTask(i + 1, today));
    const { container, getByText } = await render(
      <TaskListFilter tasks={tasks} title="Today" isMobile={false} />,
      {
        wrapper: Wrapper,
      },
    );

    expect(container.textContent?.match(/call-\d+/g) ?? []).toHaveLength(5);
    const loadMore = getByText("Load more");

    await loadMore.click();

    expect(container.textContent?.match(/call-\d+/g) ?? []).toHaveLength(8);
    expect(container.textContent).not.toContain("Load more");
  });

  // ReferenceField short-circuits to its own `empty` prop BEFORE ever
  // calling `render` when the reference doesn't resolve (both for a null
  // id and for an id that fails to fetch) — a fallback written inside
  // `render` alone (the first version of this fix) never actually runs,
  // silently rendering nothing after the type label's trailing colon.
  // Regression coverage for exactly that (UX cleanup pass, §1: "graceful
  // fallback... rather than crashing or showing undefined").
  it("shows a graceful fallback, not a blank space, when a Task's Contact can't be resolved", async () => {
    const orphanTask = {
      id: 99,
      due_date: iso(today),
      done_date: null,
      contact_id: 12345, // no matching Contact in this fixture
      sales_id: null,
      type: "review_application",
      text: "Should not render",
    };
    const screen = await render(
      <TaskListFilter
        tasks={[orphanTask]}
        title="Today"
        isMobile={false}
        showContact
      />,
      { wrapper: Wrapper },
    );

    await expect
      .element(screen.getByText("Review Application: Unknown contact"))
      .toBeInTheDocument();
  });
});
