import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { memoryStore } from "ra-core";
import { MemoryRouter } from "react-router";

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

// Human-acceptance repair, round 2: Leif's product decision is that a
// sales-call matching exception has NO meaningful due date at all — it is
// not overdue, not due today, not due later, so it must not appear in ANY
// of the three date-bucketed views (an earlier pass forced it into Today,
// which was still semantically wrong). It gets its own small "Needs
// Attention" section instead (DashboardTasks.tsx), backed by the exact
// same Task record — no new domain/table.
const FAR_PAST = "2020-01-01T00:00:00.000Z";
const PORSCHE_TEXT =
  "Porsche Brown · The Living Example · Sep 10, 2026, 6:00 PM";

const buildTestCrm = (tasks: Task[]) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Porsche", last_name: "Brown" }),
      ],
      offers: [],
      cohorts: [],
      enrollments: [],
      tasks,
    } as any),
    silent: true,
  });
  return {
    element: (
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
    ),
  };
};

const buildResolveTask = (overrides: Partial<Task> = {}): Task => ({
  id: 1,
  contact_id: 1,
  type: "resolve_sales_call",
  text: PORSCHE_TEXT,
  due_date: FAR_PAST,
  done_date: null,
  status: "pending",
  sales_id: 0,
  sales_call_id: 1,
  ...overrides,
});

describe("DashboardTasks — resolve_sales_call bucketing", () => {
  it("excludes an unresolved resolve_sales_call task from Overdue/Today/Next 7 Days and shows it in Needs Attention instead", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm([buildResolveTask()]);
    const screen = await render(element);

    await expect
      .element(screen.getByText("Needs Attention"))
      .toBeInTheDocument();
    await expect.element(screen.getByText(PORSCHE_TEXT)).toBeInTheDocument();

    const needsAttentionCard = screen
      .getByText("Needs Attention")
      .element()
      .closest('[class*="rounded-xl"]');
    expect(needsAttentionCard?.textContent).toContain(PORSCHE_TEXT);
    // No due date rendered for this type (Task.tsx's own exemption) —
    // confirmed by exact absence of the "Due " prefix anywhere on the row.
    expect(needsAttentionCard?.textContent).not.toContain("Due ");

    for (const bucketTitle of ["Overdue", "Today", "Next 7 Days"]) {
      const bucketCard = screen
        .getByText(bucketTitle, { exact: true })
        .element()
        .closest('[class*="rounded-xl"]');
      expect(bucketCard?.textContent).toContain("0");
      expect(bucketCard?.textContent).not.toContain(PORSCHE_TEXT);
    }
  });

  it("still buckets an ordinary task type with the same far-past due_date as Overdue — the exemption is type-specific, not a blanket suppression", async () => {
    await page.viewport(1280, 900);
    const task: Task = {
      id: 2,
      contact_id: 1,
      type: "follow_up",
      text: "Check in",
      due_date: FAR_PAST,
      done_date: null,
      status: "pending",
      sales_id: 0,
    };
    const { element } = buildTestCrm([task]);
    const screen = await render(element);

    // "follow_up" isn't self-describing (Task.tsx), so the row shows the
    // configured type label + Contact name, not the raw task.text —
    // "Porsche Brown" is what actually renders here.
    await expect
      .element(screen.getByText("Porsche Brown", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Needs Attention"))
      .not.toBeInTheDocument();

    const overdueCard = screen
      .getByText("Overdue")
      .element()
      .closest('[class*="rounded-xl"]');
    expect(overdueCard?.textContent).toContain("Porsche Brown");
  });

  it("disappears from Needs Attention once the underlying sales call is resolved (the Task is marked done)", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm([
      buildResolveTask({
        done_date: "2026-09-06T00:00:00.000Z",
        status: "completed",
      }),
    ]);
    const screen = await render(element);

    // Give the Dashboard's own empty-state text a chance to render first,
    // proving the section is gone rather than just not yet loaded.
    await expect
      .element(screen.getByText("Nothing here.").first())
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Needs Attention"))
      .not.toBeInTheDocument();
  });
});
