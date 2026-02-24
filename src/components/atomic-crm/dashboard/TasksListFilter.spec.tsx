import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CoreAdminContext } from "ra-core";
import fakeDataProvider from "ra-data-fakerest";
import { TaskListFilter } from "./TasksListFilter";
import React from "react";

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
  >
    {children}
  </CoreAdminContext>
);

describe("TaskListFilter", () => {
  it("renders nothing when tasks array is empty", () => {
    const { container } = render(
      <TaskListFilter tasks={[]} title="Today" isMobile={false} />,
      { wrapper: Wrapper },
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the section title", () => {
    const tasks = [createTask(1, today)];
    render(<TaskListFilter tasks={tasks} title="Today" isMobile={false} />, {
      wrapper: Wrapper,
    });
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("does not show Load more when tasks fit in one page", () => {
    const tasks = Array.from({ length: 3 }, (_, i) => createTask(i + 1, today));
    render(<TaskListFilter tasks={tasks} title="Today" isMobile={false} />, {
      wrapper: Wrapper,
    });
    expect(screen.queryByText("Load more")).not.toBeInTheDocument();
  });

  it("shows Load more when tasks exceed page size", () => {
    const tasks = Array.from({ length: 8 }, (_, i) => createTask(i + 1, today));
    render(<TaskListFilter tasks={tasks} title="Today" isMobile={false} />, {
      wrapper: Wrapper,
    });
    expect(screen.getByText("Load more")).toBeInTheDocument();
  });

  it("Load more increases visible page size", () => {
    const tasks = Array.from({ length: 8 }, (_, i) => createTask(i + 1, today));
    render(<TaskListFilter tasks={tasks} title="Today" isMobile={false} />, {
      wrapper: Wrapper,
    });

    expect(screen.getAllByText(/Task \d+/)).toHaveLength(5);
    const loadMore = screen.getByText("Load more");

    fireEvent.click(loadMore);

    // check the number of rendered tasks after clicking Load more
    expect(screen.getAllByText(/Task \d+/)).toHaveLength(8);
    // After clicking, all 8 tasks fit in one page (5 + 10 = 15), so Load more disappears
    expect(screen.queryByText("Load more")).not.toBeInTheDocument();
  });
});
