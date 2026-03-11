import React from "react";
import { render } from "vitest-browser-react";
import { CoreAdminContext } from "ra-core";
import fakeDataProvider from "ra-data-fakerest";

import { TaskListFilter } from "./TasksListFilter";

const today = new Date();
const iso = (d: Date) => d.toISOString();

const createTask = (id: number, dueDate: Date, doneDate?: Date) => ({
  id,
  due_date: iso(dueDate),
  done_date: doneDate ? iso(doneDate) : null,
  contact_id: null,
  sales_id: null,
  type: "Call",
  text: `Task ${id}`,
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <CoreAdminContext
    dataProvider={fakeDataProvider({ tasks: [], contacts: [], sales: [] })}
    i18nProvider={{
      translate: (key, options) => {
        if (typeof options?._ === "string") {
          return options._;
        }
        if (key === "crm.common.load_more") {
          return "Load more";
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

    expect(container.textContent?.match(/Task \d+/g) ?? []).toHaveLength(5);
    const loadMore = getByText("Load more");

    await loadMore.click();

    expect(container.textContent?.match(/Task \d+/g) ?? []).toHaveLength(8);
    expect(container.textContent).not.toContain("Load more");
  });
});
