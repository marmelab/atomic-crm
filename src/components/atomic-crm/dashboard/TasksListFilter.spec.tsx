import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CoreAdminContext } from "ra-core";
import fakeDataProvider from "ra-data-fakerest";
import { TaskListFilter } from "./TasksListFilter";
import React from "react";

const today = new Date();
const iso = (d: Date) => d.toISOString();

const makeTask = (id: number, dueDate: Date, doneDate?: Date) => ({
  id,
  due_date: iso(dueDate),
  done_date: doneDate ? iso(doneDate) : null,
  contact_id: null,
  sales_id: null,
  type: "Call",
  text: `Task ${id}`,
});

const makeWrapper =
  (tasks: ReturnType<typeof makeTask>[]) =>
  ({ children }: { children: React.ReactNode }) => (
    <CoreAdminContext
      dataProvider={fakeDataProvider({ tasks, contacts: [], sales: [] })}
    >
      {children}
    </CoreAdminContext>
  );

describe("TaskListFilter", () => {
  it("renders nothing when tasks array is empty", () => {
    const Wrapper = makeWrapper([]);
    const { container } = render(
      <TaskListFilter
        tasks={[]}
        taskPredicate={() => true}
        title="Today"
        isMobile={false}
      />,
      { wrapper: Wrapper },
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when no task passes the predicate", () => {
    const tasks = [makeTask(1, today), makeTask(2, today)];
    const Wrapper = makeWrapper(tasks);
    const { container } = render(
      <TaskListFilter
        tasks={tasks}
        taskPredicate={() => false}
        title="Today"
        isMobile={false}
      />,
      { wrapper: Wrapper },
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the section title when tasks pass the predicate", () => {
    const tasks = [makeTask(1, today)];
    const Wrapper = makeWrapper(tasks);
    render(
      <TaskListFilter
        tasks={tasks}
        taskPredicate={() => true}
        title="Today"
        isMobile={false}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("renders the section title for overdue tasks", () => {
    const yesterday = new Date(today.getTime() - 86400000);
    const tasks = [makeTask(1, yesterday)];
    const Wrapper = makeWrapper(tasks);
    render(
      <TaskListFilter
        tasks={tasks}
        taskPredicate={() => true}
        title="Overdue"
        isMobile={false}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("does not show Load more when tasks fit in one page", () => {
    const tasks = Array.from({ length: 3 }, (_, i) => makeTask(i + 1, today));
    const Wrapper = makeWrapper(tasks);
    render(
      <TaskListFilter
        tasks={tasks}
        taskPredicate={() => true}
        title="Today"
        isMobile={false}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.queryByText("Load more")).not.toBeInTheDocument();
  });

  it("shows Load more when tasks exceed page size", () => {
    const tasks = Array.from({ length: 8 }, (_, i) => makeTask(i + 1, today));
    const Wrapper = makeWrapper(tasks);
    render(
      <TaskListFilter
        tasks={tasks}
        taskPredicate={() => true}
        title="Today"
        isMobile={false}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText("Load more")).toBeInTheDocument();
  });

  it("Load more increases visible page size", () => {
    const tasks = Array.from({ length: 8 }, (_, i) => makeTask(i + 1, today));
    const Wrapper = makeWrapper(tasks);
    render(
      <TaskListFilter
        tasks={tasks}
        taskPredicate={() => true}
        title="Today"
        isMobile={false}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getAllByText(/Task \d+/)).toHaveLength(5);
    const loadMore = screen.getByText("Load more");

    fireEvent.click(loadMore);

    // check the number of rendered tasks after clicking Load more
    expect(screen.getAllByText(/Task \d+/)).toHaveLength(8);
    // After clicking, all 8 tasks fit in one page (5 + 10 = 15), so Load more disappears
    expect(screen.queryByText("Load more")).not.toBeInTheDocument();
  });
});
