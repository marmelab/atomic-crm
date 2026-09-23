import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { CoreAdminContext, memoryStore } from "ra-core";
import { MemoryRouter } from "react-router";

import { Notification } from "@/components/admin/notification";
import { CRM } from "../root/CRM";
import { testI18nProvider } from "../providers/commons/i18nProvider";
import { createDataProvider } from "../providers/fakerest";
import {
  buildContact,
  createCrmDb,
  createTestAuthProvider,
} from "@/test/StoryWrapper";
import { isDueToday } from "../tasks/tasksPredicate";
import { TasksListByDueDate } from "../tasks/TasksListByDueDate";
import type { Deal, Enrollment, Offer } from "../types";

// Manual Task UX repair: ClientShow's own record context is the
// Enrollment (verified directly, not assumed), so this fixture is a
// GYU-style group Offer — no client_session_acuity_appointment_type_id,
// so SessionsCard never renders — proving the Add Task control works on
// its own, independent of the (unrelated, sealed) Client + Session
// Operations cadence UI. Builds the dataProvider explicitly (same
// pattern as ClientShow.sessions.test.tsx's own buildTestCrm) rather
// than through StoryWrapper — StoryWrapper's `children` only render as
// the `/` dashboard route, never at a deep-linked `/enrollments/:id/show`
// entry, so a listener component to capture the dataProvider would
// silently never mount there.
const gyuOffer: Offer = {
  id: 1,
  name: "Growing Yourself Up",
  type: "group",
  duration: "8 weeks",
  current_price: 2000,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const wonDeal: Deal = {
  id: 1,
  name: "Maya Chen",
  contact_id: 1,
  offer_id: 1,
  stage: "won",
  outcome: null,
  amount: 2000,
  offer_name_snapshot: "Growing Yourself Up",
  offer_price_snapshot: 2000,
  sales_id: 0,
  index: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  stage_entered_at: "2026-01-01T00:00:00.000Z",
};

const activeEnrollment: Enrollment = {
  id: 1,
  opportunity_id: 1,
  onboarding_tracking: "tracked" as const,
  status: "active",
  start_date: "2026-01-01",
  end_date: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const buildTestCrm = () => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Maya", last_name: "Chen" }),
      ],
      offers: [gyuOffer],
      deals: [wonDeal],
      enrollments: [activeEnrollment],
      tasks: [],
    } as any),
    // The simulated network delay, off — the same `latency: 0` the rest
    // of the suite uses whenever a test reads the provider directly.
    //
    // This is why the file kept timing out in CI and never here. The fake
    // provider defaults to 300ms of pretend latency on EVERY call, and
    // the assertions below wait for the created Task with expect.poll,
    // whose default budget is 1000ms — five times shorter than
    // expect.element's. So each poll attempt spent 300ms of a 1s budget
    // inside the harness's own artificial delay: measured, the row became
    // visible 301ms after Save on an idle machine and 300ms under a
    // deliberately saturated one, because it is a fixed timer rather than
    // work. Two round trips do not fit in a second, and the runner needs
    // roughly twice this machine's wall clock. With the delay off the
    // same measurement reads 0ms.
    //
    // Note what this is NOT: not a longer timeout, and not the product
    // being slow. Nothing about ClientShow or Task creation changed — the
    // test was asking a deliberately slowed provider to answer inside a
    // budget that never allowed for it.
    latency: 0,
    silent: true,
  });
  return {
    dataProvider,
    element: (
      <MemoryRouter initialEntries={["/enrollments/1/show"]}>
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

describe("ClientShow — manual Task creation (Manual Task UX repair)", () => {
  it("A: exposes an Add Task control", async () => {
    const { element } = buildTestCrm();
    const screen = await render(element);

    await expect
      .element(screen.getByRole("button", { name: "Create task" }))
      .toBeVisible();
  });

  it("B/C: creates a Task from ClientShow, correctly associated with the underlying Contact (never the Enrollment id), as a plain 'other' Task", async () => {
    const { element, dataProvider } = buildTestCrm();
    const screen = await render(element);

    // Let the page settle before reaching into it.
    //
    // The test above already waits for this button; this one used to click
    // the instant render() returned. .click() waits only for the element to
    // EXIST, and the button appears as soon as the Contact resolves — while
    // ClientShow is still mounting the rest of a large tree. The dialog then
    // mounts and animates in against that, and on a two-core runner the 5s
    // matcher for the title lost the race: green on every machine fast
    // enough, red on GitHub's.
    //
    // Waiting for the button to be VISIBLE, not merely present, is the same
    // readiness the sibling test uses, and it costs nothing when the page is
    // quick.
    await expect
      .element(screen.getByRole("button", { name: "Create task" }))
      .toBeVisible();

    await screen.getByRole("button", { name: "Create task" }).click();
    await expect
      .element(screen.getByText("Create task for Maya Chen"))
      .toBeVisible();

    await screen
      .getByRole("textbox")
      .first()
      .fill("Check in with Maya about GYU attendance");
    await screen.getByRole("button", { name: "Save" }).click();

    await expect
      .poll(async () => {
        const { data } = await dataProvider.getList("tasks", {
          filter: { contact_id: 1 },
          pagination: { page: 1, perPage: 10 },
          sort: { field: "id", order: "ASC" },
        });
        return data.length;
      })
      .toBe(1);

    const { data: tasks } = await dataProvider.getList("tasks", {
      filter: { contact_id: 1 },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    const created = tasks[0];

    // The Contact's real id (1) — not the Enrollment's own id, which is
    // also 1 in this fixture on purpose (a same-valued but semantically
    // different id is exactly the bug a naive useRecordContext() read
    // inside ClientShow would produce undetected).
    expect(created.contact_id).toBe(1);
    expect(created.type).toBe("other");
    expect(created.text).toBe("Check in with Maya about GYU attendance");
    expect(created.status).toBe("pending");
    // No enrollment/onboarding/cadence linkage — a plain manual Task,
    // never a system-only association.
    expect(created.enrollment_id ?? null).toBeNull();
    expect(created.onboarding_item_id ?? null).toBeNull();
    expect(created.cadence_issue_id ?? null).toBeNull();
  });

  it("D: the created Task enters the normal due-date workflow (defaults to Today)", async () => {
    const { element, dataProvider } = buildTestCrm();
    const screen = await render(element);

    // Same readiness wait as B above: .click() only waits for the element
    // to EXIST, and the button appears as soon as the Contact resolves.
    await expect
      .element(screen.getByRole("button", { name: "Create task" }))
      .toBeVisible();
    await screen.getByRole("button", { name: "Create task" }).click();
    await screen
      .getByRole("textbox")
      .first()
      .fill("Ask Jerry about scheduling");
    await screen.getByRole("button", { name: "Save" }).click();

    await expect
      .poll(async () => {
        const { data } = await dataProvider.getList("tasks", {
          filter: { contact_id: 1 },
          pagination: { page: 1, perPage: 10 },
          sort: { field: "id", order: "ASC" },
        });
        return data.length;
      })
      .toBe(1);

    const { data: tasks } = await dataProvider.getList("tasks", {
      filter: { contact_id: 1 },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    const created = tasks[0];

    expect(isDueToday(created.due_date)).toBe(true);

    // Same generic bucketed list every other Task uses (Dashboard/
    // Contact page) — proves the created Task isn't just a row in the
    // database, it actually shows up where Leif looks for it. Reuses the
    // SAME dataProvider instance ClientShow just wrote through, wrapped
    // in the minimal context TasksListByDueDate needs on its own.
    const listScreen = await render(
      <CoreAdminContext
        dataProvider={dataProvider}
        i18nProvider={testI18nProvider}
      >
        <TasksListByDueDate filterByContact={1} />
      </CoreAdminContext>,
    );
    await expect.element(listScreen.getByText("Today")).toBeVisible();
    // Manual Task UX repair, round 2 (§3): the compact row now shows the
    // Task's own free-text instruction as its primary label for `other`
    // Tasks — "Other" alone told Leif nothing.
    await expect
      .element(listScreen.getByText("Ask Jerry about scheduling"))
      .toBeVisible();
  });

  it("E: creating a Task from ClientShow never mutates Enrollment lifecycle, sales stage, or cadence state", async () => {
    const { element, dataProvider } = buildTestCrm();
    const screen = await render(element);

    await expect
      .element(screen.getByRole("button", { name: "Create task" }))
      .toBeVisible();
    await screen.getByRole("button", { name: "Create task" }).click();
    await screen
      .getByRole("textbox")
      .first()
      .fill("Follow up about payment plan");
    await screen.getByRole("button", { name: "Save" }).click();

    await expect
      .poll(async () => {
        const { data } = await dataProvider.getList("tasks", {
          filter: { contact_id: 1 },
          pagination: { page: 1, perPage: 10 },
          sort: { field: "id", order: "ASC" },
        });
        return data.length;
      })
      .toBe(1);

    const { data: enrollment } = await dataProvider.getOne("enrollments", {
      id: 1,
    });
    expect(enrollment.status).toBe("active");
    expect(enrollment.start_date).toBe("2026-01-01");
    expect(enrollment.end_date).toBeNull();

    const { data: deal } = await dataProvider.getOne("deals", { id: 1 });
    expect(deal.stage).toBe("won");
    expect(deal.outcome).toBeNull();

    // No cadence machinery exists for this GYU fixture at all, and
    // manual Task creation never creates any — no GYU participation
    // subsystem, by design.
    const { total: cadenceIssueCount } = await dataProvider.getList(
      "client_session_cadence_issues",
      {
        filter: {},
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(cadenceIssueCount).toBe(0);
  });
});
