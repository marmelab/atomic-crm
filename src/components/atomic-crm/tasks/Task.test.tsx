import { render } from "vitest-browser-react";
import { CoreAdminContext, useGetList } from "ra-core";
import fakeDataProvider from "ra-data-fakerest";

import { Task } from "./Task";
import { formatTimestampString } from "../deals/dealUtils";
import type { Task as TaskType } from "../types";
import { computePostponeDueDate } from "./postponeTaskDate";

// Dashboard task completion UX repair pass: the checkbox itself (shared by
// every task list, not just the Dashboard — the cursor bug and undoable
// completion live here in Task.tsx) must never show a disabled/prohibited
// cursor, must reflect a click immediately, and must call onCompleted
// exactly once per genuine completion (never on reopen) so a Dashboard-
// level "stay visible briefly" delay only ever fires for a real
// completion. The undo toast's own text and the actual persisted write
// (deferred by ra-core's undoable mode) are adversarial-browser-tested
// rather than re-verified here — this framework behavior isn't ours to
// re-test.
//
// Renders through useGetList — same as every real caller (DashboardTasks,
// CompletedTodayTasks) — rather than passing a Task record as a bare prop:
// the optimistic cache patch useUpdate's undoable mode relies on only
// reaches the UI through the list query it patches, not a prop untouched
// by react-query.
const TestTaskRow = ({
  onCompleted,
}: {
  onCompleted?: (task: TaskType) => void;
}) => {
  const { data } = useGetList<TaskType>("tasks", {
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  if (!data?.[0]) return null;
  return <Task task={data[0]} onCompleted={onCompleted} />;
};

const buildTask = (overrides: Partial<TaskType> = {}): TaskType => ({
  id: 1,
  contact_id: null as unknown as TaskType["contact_id"],
  type: "follow_up",
  text: "",
  due_date: "2026-06-01T00:00:00.000Z",
  done_date: null,
  status: "pending",
  ...overrides,
});

const renderTask = async (
  task: TaskType,
  onCompleted?: (task: TaskType) => void,
) => {
  const dataProvider = fakeDataProvider(
    { tasks: [task], contacts: [], sales: [] },
    false,
    0,
  );
  return render(
    <CoreAdminContext
      dataProvider={dataProvider}
      i18nProvider={{
        translate: (key, options) => {
          if (typeof options?._ === "string") {
            return options._.replace(
              /%\{(\w+)\}/g,
              (_match: string, name: string) => String(options?.[name] ?? ""),
            );
          }
          return key;
        },
        changeLocale: () => Promise.resolve(),
        getLocale: () => "en",
      }}
    >
      <TestTaskRow onCompleted={onCompleted} />
    </CoreAdminContext>,
  );
};

describe("Task checkbox", () => {
  it("has no disabled attribute — never shows a prohibited cursor", async () => {
    const screen = await renderTask(buildTask());
    const checkbox = screen.getByRole("checkbox");
    await expect.element(checkbox).not.toHaveAttribute("disabled");
  });

  // Human-acceptance repair (Contracts + Onboarding slice): the assertion
  // above alone let a real bug through — the checkbox was never disabled,
  // but the shared Checkbox component (src/components/ui/checkbox.tsx)
  // never declared `cursor-pointer` for its enabled state at all, so a
  // plain <button>'s browser default read as "you can't click this." This
  // test harness doesn't load the app's real Tailwind-processed stylesheet
  // (only main.tsx does, which no test renders through), so computed style
  // can't be asserted meaningfully here — asserting the class itself is
  // present is the accurate, environment-independent regression guard.
  it("declares the interactive pointer cursor class, not just the disabled-state one", async () => {
    const screen = await renderTask(buildTask());
    const checkboxLocator = screen.getByRole("checkbox");
    await expect.element(checkboxLocator).toBeInTheDocument();
    const checkbox = checkboxLocator.element() as HTMLElement;
    expect(checkbox.classList.contains("cursor-pointer")).toBe(true);
  });

  it("checks immediately on click", async () => {
    const screen = await renderTask(buildTask());
    const checkbox = screen.getByRole("checkbox");
    await expect.element(checkbox).toHaveAttribute("data-state", "unchecked");

    await checkbox.click();

    await expect.element(checkbox).toHaveAttribute("data-state", "checked");
  });

  it("calls onCompleted exactly once when completing, never on reopen", async () => {
    const completed: TaskType[] = [];
    const screen = await renderTask(buildTask(), (t) => completed.push(t));
    const checkbox = screen.getByRole("checkbox");

    await checkbox.click();
    await expect.element(checkbox).toHaveAttribute("data-state", "checked");
    expect(completed).toHaveLength(1);

    await checkbox.click();
    await expect.element(checkbox).toHaveAttribute("data-state", "unchecked");
    expect(completed).toHaveLength(1);
  });

  it("repeated clicks toggle safely and end back at the original state", async () => {
    const screen = await renderTask(buildTask());
    const checkbox = screen.getByRole("checkbox");

    await checkbox.click();
    await expect.element(checkbox).toHaveAttribute("data-state", "checked");
    await checkbox.click();
    await expect.element(checkbox).toHaveAttribute("data-state", "unchecked");
    await checkbox.click();
    await expect.element(checkbox).toHaveAttribute("data-state", "checked");

    // A single row throughout — never duplicated.
    await expect.element(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("reopening an already-completed task via its checkbox clears done_date visually", async () => {
    const task = buildTask({
      done_date: "2026-06-02T00:00:00.000Z",
      status: "completed",
    });
    const screen = await renderTask(task);
    const checkbox = screen.getByRole("checkbox");
    await expect.element(checkbox).toHaveAttribute("data-state", "checked");

    await checkbox.click();

    await expect.element(checkbox).toHaveAttribute("data-state", "unchecked");
  });
});

// Small polish/cleanup slice: end-to-end wiring check that the "Postpone"
// menu items actually reach the Dashboard-visible due date without a day
// shift — postponeTaskDate.test.ts covers the date math itself (and the
// America/Denver boundary specifically) in isolation; this confirms
// Task.tsx's own dropdown wires computePostponeDueDate(new Date(), ...)
// through correctly. Expectations are derived from the same functions
// Task.tsx itself uses, rather than a hardcoded future date, since
// "tomorrow" is always relative to whenever the test actually runs.
describe("Task postpone actions", () => {
  it("postpone tomorrow advances the displayed due date by exactly one day", async () => {
    const task = buildTask({ due_date: "2026-01-01T18:00:00.000Z" });
    const screen = await renderTask(task);
    const expected = formatTimestampString(
      computePostponeDueDate(new Date(), 1),
    );

    await screen
      .getByRole("button", { name: "resources.tasks.actions.title" })
      .click();
    await screen.getByText("resources.tasks.actions.postpone_tomorrow").click();

    await expect.element(screen.getByText(expected)).toBeInTheDocument();
  });

  it("postpone next week advances the displayed due date by exactly seven days", async () => {
    const task = buildTask({ due_date: "2026-01-01T18:00:00.000Z" });
    const screen = await renderTask(task);
    const expected = formatTimestampString(
      computePostponeDueDate(new Date(), 7),
    );

    await screen
      .getByRole("button", { name: "resources.tasks.actions.title" })
      .click();
    await screen
      .getByText("resources.tasks.actions.postpone_next_week")
      .click();

    await expect.element(screen.getByText(expected)).toBeInTheDocument();
  });
});
