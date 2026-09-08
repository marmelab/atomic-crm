import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { memoryStore } from "ra-core";
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
import type { Deal, Enrollment, Offer, Task } from "../types";

// Manual Task UX repair, round 2 (§1): ClientShow now shows the
// underlying Contact's own operational Tasks directly (never restricted
// to enrollment_id — a manual/payment/onboarding Task all belong here
// alike), so Leif no longer has to bounce to ContactShow to see them.
// Same GYU-style fixture (no client_session_acuity_appointment_type_id,
// so SessionsCard never renders) as ClientShow.tasks.test.tsx, extended
// with a second, unrelated Contact/Enrollment to prove isolation (§D).
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
  status: "active",
  start_date: "2026-01-01",
  end_date: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

// A second, unrelated Contact/Deal/Enrollment — never rendered by
// ClientShow for enrollment 1, proving Task isolation (§D).
const otherContactDeal: Deal = {
  ...wonDeal,
  id: 2,
  name: "Jerry Otherperson",
  contact_id: 2,
};

const otherEnrollment: Enrollment = {
  ...activeEnrollment,
  id: 2,
  opportunity_id: 2,
};

const buildTask = (overrides: Partial<Task> & { id: number }): Task => ({
  contact_id: 1,
  type: "other",
  text: "Some task",
  due_date: "2026-01-05T12:00:00.000Z",
  status: "pending",
  sales_id: 0,
  ...overrides,
});

const buildTestCrm = (tasks: Task[]) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Maya", last_name: "Chen" }),
        buildContact({ id: 2, first_name: "Jerry", last_name: "Otherperson" }),
      ],
      offers: [gyuOffer],
      deals: [wonDeal, otherContactDeal],
      enrollments: [activeEnrollment, otherEnrollment],
      tasks,
    } as any),
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

describe("ClientShow — Tasks section (Manual Task UX repair, round 2)", () => {
  it("A: displays a pending Task associated with this Client's own Contact", async () => {
    const { element } = buildTestCrm([
      buildTask({ id: 1, text: "Ask Jerry about scheduling" }),
    ]);
    const screen = await render(element);

    await expect
      .element(screen.getByText("Ask Jerry about scheduling"))
      .toBeVisible();
  });

  it("B: displays a manual `other` Task with its instruction as the primary label", async () => {
    const { element } = buildTestCrm([
      buildTask({
        id: 1,
        type: "other",
        text: "Check in about GYU attendance",
      }),
    ]);
    const screen = await render(element);

    await expect
      .element(screen.getByText("Check in about GYU attendance"))
      .toBeVisible();
  });

  it("C: displays an onboarding/system Task for this Contact", async () => {
    const { element } = buildTestCrm([
      buildTask({
        id: 1,
        type: "onboarding_item",
        text: "Send contract to Maya Chen",
        enrollment_id: 1,
        onboarding_item_id: 1,
      }),
    ]);
    const screen = await render(element);

    await expect
      .element(screen.getByText("Send contract to Maya Chen"))
      .toBeVisible();
  });

  it("D: does not show a Task belonging to a different Contact", async () => {
    const { element } = buildTestCrm([
      buildTask({ id: 1, text: "Ask Jerry about scheduling" }),
      buildTask({
        id: 2,
        contact_id: 2,
        text: "This belongs to a different client entirely",
      }),
    ]);
    const screen = await render(element);

    await expect
      .element(screen.getByText("Ask Jerry about scheduling"))
      .toBeVisible();
    await expect
      .element(screen.getByText("This belongs to a different client entirely"))
      .not.toBeInTheDocument();
  });

  it("F: an old completed Task does not clutter the default view", async () => {
    const { element } = buildTestCrm([
      buildTask({ id: 1, text: "Ask Jerry about scheduling" }),
      buildTask({
        id: 2,
        text: "Long-finished follow-up",
        status: "completed",
        done_date: "2020-01-01T12:00:00.000Z",
      }),
    ]);
    const screen = await render(element);

    await expect
      .element(screen.getByText("Ask Jerry about scheduling"))
      .toBeVisible();
    await expect
      .element(screen.getByText("Long-finished follow-up"))
      .not.toBeInTheDocument();
  });
});
