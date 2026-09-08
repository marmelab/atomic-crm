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
import type {
  Deal,
  Enrollment,
  EnrollmentOnboardingItem,
  Offer,
} from "../types";

// ClientShow onboarding-hierarchy repair: while onboarding is still
// incomplete, the checklist stays expanded near the top (Payment ->
// Onboarding -> Tasks -> Sessions) — those actions are operationally
// important. Once every REQUIRED item is done, it moves below Sessions,
// collapsed by default, so Payment/Tasks/Sessions (the things that
// matter day-to-day for an active client) come first. GYU-style offer
// (no client_session_acuity_appointment_type_id) throughout, same as
// ClientShow.tasks.test.tsx, so SessionsCard never renders — isolates
// this from the unrelated, sealed cadence UI.
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

const buildItem = (
  overrides: Partial<EnrollmentOnboardingItem> & { id: number },
): EnrollmentOnboardingItem => ({
  enrollment_id: 1,
  requirement_key: `item-${overrides.id}`,
  label: `Item ${overrides.id}`,
  task_text_template: `Complete item ${overrides.id}`,
  is_required: true,
  sort_order: overrides.id,
  status: "pending",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

// These fixtures render <CRM/> with a bare passthrough `layout` (no nav
// chrome — same convention ClientShow.tasks.test.tsx/ClientShow.
// sessions.test.tsx already use), so container.textContent IS the page
// content. The specific strings searched for below are chosen to be
// unique within it: the plain word "Onboarding" alone would also match
// this page's own status Badge (enrollmentStatusLabels), which renders
// in the header, above Payment, whenever enrollment.status is literally
// "onboarding".
const pageText = (screen: { container: HTMLElement }): string =>
  screen.container.textContent ?? "";

// All four required items done — the accepted fixture's own shape
// ("Onboarding LE Test Monkey, whose onboarding is 4/4 complete").
const fourDoneItems: EnrollmentOnboardingItem[] = [1, 2, 3, 4].map((id) =>
  buildItem({ id, label: `Item ${id}`, status: "done" }),
);

const threeDoneOneOpenItems: EnrollmentOnboardingItem[] = [
  buildItem({ id: 1, status: "done" }),
  buildItem({ id: 2, status: "done" }),
  buildItem({ id: 3, status: "done" }),
  buildItem({ id: 4, status: "pending" }),
];

const buildTestCrm = ({
  enrollmentStatus,
  items,
}: {
  enrollmentStatus: Enrollment["status"];
  items: EnrollmentOnboardingItem[];
}) => {
  const enrollment: Enrollment = {
    id: 1,
    opportunity_id: 1,
    status: enrollmentStatus,
    start_date: "2026-01-01",
    end_date: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Maya", last_name: "Chen" }),
      ],
      offers: [gyuOffer],
      deals: [wonDeal],
      enrollments: [enrollment],
      enrollment_onboarding_items: items,
      tasks: [],
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

describe("ClientShow — onboarding-hierarchy repair", () => {
  it("A: incomplete onboarding renders Payment -> Onboarding -> Tasks -> Sessions", async () => {
    const { element } = buildTestCrm({
      enrollmentStatus: "onboarding",
      items: threeDoneOneOpenItems,
    });
    const screen = await render(element);

    // Waits for the LAST thing on the page to commit before reading raw
    // textContent — otherwise this reads the page mid-load.
    await expect.element(screen.getByText("Tasks")).toBeVisible();

    const text = pageText(screen);
    const paymentIndex = text.indexOf("Payment");
    // "Onboarding 3/4" (the incomplete-checklist header, WITH its own
    // count) is unique — the bare word "Onboarding" alone would also
    // match this fixture's own status Badge ("Onboarding"), which
    // renders even earlier, in the page header above Payment.
    const onboardingIndex = text.indexOf("Onboarding 3/4");
    const tasksIndex = text.indexOf("Tasks");

    expect(paymentIndex).toBeGreaterThan(-1);
    expect(onboardingIndex).toBeGreaterThan(-1);
    expect(tasksIndex).toBeGreaterThan(-1);
    expect(paymentIndex).toBeLessThan(onboardingIndex);
    expect(onboardingIndex).toBeLessThan(tasksIndex);
  });

  it("B: incomplete onboarding checklist is expanded/visible by default", async () => {
    const { element } = buildTestCrm({
      enrollmentStatus: "onboarding",
      items: threeDoneOneOpenItems,
    });
    const screen = await render(element);

    // Every item's own label is directly visible — no disclosure to open.
    await expect.element(screen.getByText("Item 1")).toBeVisible();
    await expect.element(screen.getByText("Item 4")).toBeVisible();
    await expect.element(screen.getByText("Onboarding 3/4")).toBeVisible();
  });

  it("C: fully completed onboarding renders Payment -> Tasks -> Sessions -> Onboarding", async () => {
    const { element } = buildTestCrm({
      enrollmentStatus: "active",
      items: fourDoneItems,
    });
    const screen = await render(element);
    await expect.element(screen.getByText("Payment")).toBeVisible();

    // The unique collapsed-summary string — see the comment on test A
    // for why the bare word "Onboarding" alone isn't safe to search for.
    // Waited for explicitly (not just "Payment") since it's the LAST
    // thing on the page to commit.
    await expect
      .element(screen.getByText("Onboarding · Complete 4/4"))
      .toBeVisible();

    const text = pageText(screen);
    const paymentIndex = text.indexOf("Payment");
    const tasksIndex = text.indexOf("Tasks");
    const onboardingIndex = text.indexOf("Onboarding · Complete");

    expect(paymentIndex).toBeGreaterThan(-1);
    expect(tasksIndex).toBeGreaterThan(-1);
    expect(onboardingIndex).toBeGreaterThan(-1);
    expect(paymentIndex).toBeLessThan(tasksIndex);
    expect(tasksIndex).toBeLessThan(onboardingIndex);
  });

  it("D/E: completed onboarding defaults collapsed, with a clear completion-count summary", async () => {
    const { element } = buildTestCrm({
      enrollmentStatus: "active",
      items: fourDoneItems,
    });
    const screen = await render(element);

    await expect
      .element(screen.getByText("Onboarding · Complete 4/4"))
      .toBeVisible();
    // The individual item labels stay technically present in the raw DOM
    // (native <details> semantics — same as Sessions' own History
    // disclosure), but are NOT VISIBLE/accessible until expanded — this
    // is exactly what makes it "collapsed by default". A plain
    // toBeInTheDocument() check would be a false negative here (it
    // ignores <details> closed-state rendering) — toBeVisible() is the
    // correct assertion, matching how the pre-existing History
    // disclosure test itself checks via getByRole rather than raw text
    // presence.
    await expect.element(screen.getByText("Item 1")).not.toBeVisible();
  });

  it("F: expanding completed onboarding reveals the existing checklist", async () => {
    const { element } = buildTestCrm({
      enrollmentStatus: "active",
      items: fourDoneItems,
    });
    const screen = await render(element);

    await screen.getByText("Onboarding · Complete 4/4").click();

    await expect.element(screen.getByText("Item 1")).toBeVisible();
    await expect.element(screen.getByText("Item 2")).toBeVisible();
    await expect.element(screen.getByText("Item 3")).toBeVisible();
    await expect.element(screen.getByText("Item 4")).toBeVisible();
  });

  it("G: collapse/expand never mutates onboarding item data", async () => {
    const { element, dataProvider } = buildTestCrm({
      enrollmentStatus: "active",
      items: fourDoneItems,
    });
    const screen = await render(element);

    const before = await dataProvider.getList("enrollment_onboarding_items", {
      filter: { enrollment_id: 1 },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });

    await screen.getByText("Onboarding · Complete 4/4").click();
    await expect.element(screen.getByText("Item 1")).toBeVisible();
    await screen.getByText("Onboarding · Complete 4/4").click();

    const after = await dataProvider.getList("enrollment_onboarding_items", {
      filter: { enrollment_id: 1 },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });

    expect(after.data).toEqual(before.data);
  });

  it("H/I: Tasks stays above Sessions, and Sessions renders exactly as before, for a completed-onboarding session-tracked Offer", async () => {
    // Sessions only renders for an ACTIVE Enrollment whose Offer has
    // client_session_acuity_appointment_type_id configured (Client +
    // Session Operations slice A) — a distinct LE-style fixture proves
    // Tasks stays above it even when Sessions genuinely renders too.
    const leOffer: Offer = {
      ...gyuOffer,
      id: 2,
      name: "The Living Example",
      type: "individual",
      client_session_acuity_appointment_type_id: "90522599",
    };
    const leDeal: Deal = { ...wonDeal, offer_id: 2 };
    const enrollment: Enrollment = {
      id: 1,
      opportunity_id: 1,
      status: "active",
      start_date: "2026-01-01",
      end_date: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [
          buildContact({ id: 1, first_name: "Maya", last_name: "Chen" }),
        ],
        offers: [leOffer],
        deals: [leDeal],
        enrollments: [enrollment],
        enrollment_onboarding_items: fourDoneItems,
        tasks: [],
      } as any),
      silent: true,
    });
    const screen = await render(
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
      </MemoryRouter>,
    );

    // I: also confirms Sessions renders its normal, unchanged content —
    // no cadence data seeded here, so its own "no start date" empty
    // state is the exact same copy SessionsCard already showed before
    // this repair (untouched cadence logic). Waiting for it doubles as
    // "content has finished loading" before reading raw textContent.
    await expect
      .element(screen.getByText("No expected sessions assigned yet."))
      .toBeVisible();

    const text = pageText(screen);
    const tasksIndex = text.indexOf("Tasks");
    const sessionsIndex = text.indexOf("Sessions");
    const onboardingIndex = text.indexOf("Onboarding · Complete");

    expect(tasksIndex).toBeGreaterThan(-1);
    expect(sessionsIndex).toBeGreaterThan(-1);
    expect(onboardingIndex).toBeGreaterThan(-1);
    expect(tasksIndex).toBeLessThan(sessionsIndex);
    expect(sessionsIndex).toBeLessThan(onboardingIndex);
  });

  it("J: this presentation behavior never changes Enrollment status", async () => {
    const { element, dataProvider } = buildTestCrm({
      enrollmentStatus: "active",
      items: fourDoneItems,
    });
    const screen = await render(element);

    await screen.getByText("Onboarding · Complete 4/4").click();

    const { data: enrollment } = await dataProvider.getOne("enrollments", {
      id: 1,
    });
    expect(enrollment.status).toBe("active");
  });
});
