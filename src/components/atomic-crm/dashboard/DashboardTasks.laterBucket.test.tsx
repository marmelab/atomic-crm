import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { memoryStore } from "ra-core";
import { MemoryRouter } from "react-router";
import { addDays } from "date-fns";

import { CRM } from "../root/CRM";
import { Notification } from "@/components/admin/notification";
import { testI18nProvider } from "@/components/atomic-crm/providers/commons/i18nProvider";
import { createDataProvider } from "@/components/atomic-crm/providers/fakerest";
import {
  buildContact,
  createCrmDb,
  createTestAuthProvider,
} from "@/test/StoryWrapper";
import type { Task } from "@/components/atomic-crm/types";

// A future commitment must not disappear for being far away.
//
// The Dashboard had four places a Task could land — Needs Attention,
// Overdue, Today, Next 7 Days — and nothing beyond a week. A dated Task
// further out matched none of them and was simply not rendered anywhere.
// Sarah Henke's sales call on 15 October is the live case: a real
// appointment, on a real date, invisible.

const FAR_FUTURE = addDays(new Date(), 30).toISOString();
const SOON = addDays(new Date(), 3).toISOString();
const FUTURE_CALL_TEXT = "Call Sarah Henke back in October";
const SOON_CALL_TEXT = "Something sooner this week";

const buildTestCrm = (tasks: Task[]) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Sarah", last_name: "Henke" }),
      ],
      offers: [],
      cohorts: [],
      enrollments: [],
      tasks,
    } as never),
    silent: true,
  });
  return (
    <MemoryRouter initialEntries={["/"]}>
      <CRM
        dataProvider={dataProvider}
        authProvider={createTestAuthProvider()}
        i18nProvider={testI18nProvider}
        store={memoryStore()}
        disableTelemetry
        layout={({ children }) => (
          <>
            {children}
            <Notification />
          </>
        )}
      />
    </MemoryRouter>
  );
};

const buildTask = (overrides: Partial<Task> = {}): Task => ({
  id: 1,
  contact_id: 1,
  // "other" renders its own text; most types render their type label
  // instead (Task.tsx). The bucket logic under test is the same either
  // way, and this keeps the assertions about dates, not display rules.
  type: "other",
  text: FUTURE_CALL_TEXT,
  due_date: FAR_FUTURE,
  done_date: null,
  status: "pending",
  sales_id: 0,
  ...overrides,
});

describe("DashboardTasks — the Later bucket", () => {
  it("shows a Task due beyond seven days instead of dropping it", async () => {
    // Arrange
    await page.viewport(1280, 900);

    // Act
    const screen = await render(buildTestCrm([buildTask()]));

    // Assert — it exists, and it is under Later.
    await expect.element(screen.getByText("Later")).toBeInTheDocument();
    await expect
      .element(screen.getByText(FUTURE_CALL_TEXT))
      .toBeInTheDocument();

    const laterCard = screen
      .getByText("Later", { exact: true })
      .element()
      .closest('[class*="rounded-xl"]');
    expect(laterCard?.textContent).toContain(FUTURE_CALL_TEXT);
  });

  it("does not put a far-future Task in any nearer bucket", async () => {
    // Arrange
    await page.viewport(1280, 900);

    // Act
    const screen = await render(buildTestCrm([buildTask()]));
    await expect.element(screen.getByText("Later")).toBeInTheDocument();

    // Assert
    for (const bucket of ["Overdue", "Today", "Next 7 Days"]) {
      const card = screen
        .getByText(bucket, { exact: true })
        .element()
        .closest('[class*="rounded-xl"]');
      expect(card?.textContent).not.toContain(FUTURE_CALL_TEXT);
    }
  });

  it("keeps a nearer Task in Next 7 Days rather than sweeping it into Later", async () => {
    // Arrange — the boundary matters in both directions.
    await page.viewport(1280, 900);

    // Act
    const screen = await render(
      buildTestCrm([
        buildTask(),
        buildTask({ id: 2, text: SOON_CALL_TEXT, due_date: SOON }),
      ]),
    );
    await expect.element(screen.getByText("Later")).toBeInTheDocument();

    // Assert
    const next7 = screen
      .getByText("Next 7 Days", { exact: true })
      .element()
      .closest('[class*="rounded-xl"]');
    expect(next7?.textContent).toContain(SOON_CALL_TEXT);

    const laterCard = screen
      .getByText("Later", { exact: true })
      .element()
      .closest('[class*="rounded-xl"]');
    expect(laterCard?.textContent).not.toContain(SOON_CALL_TEXT);
  });

  it("stays absent when nothing is that far out", async () => {
    // Arrange — no empty fourth column for the common case.
    await page.viewport(1280, 900);

    // Act
    const screen = await render(
      buildTestCrm([buildTask({ text: SOON_CALL_TEXT, due_date: SOON })]),
    );
    await expect.element(screen.getByText(SOON_CALL_TEXT)).toBeInTheDocument();

    // Assert
    expect(screen.container.textContent).not.toContain("Later");
  });
});
