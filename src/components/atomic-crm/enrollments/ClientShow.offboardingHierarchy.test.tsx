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
  EnrollmentOffboardingItem,
  EnrollmentOnboardingItem,
  Offer,
} from "../types";

// Client Offboarding slice: mirrors ClientShow.onboardingHierarchy.test.tsx's
// own approach exactly — a GYU-style offer (no
// client_session_acuity_appointment_type_id) throughout, so SessionsCard
// never renders and this stays isolated from the sealed cadence UI. The
// onboarding checklist is fixture-seeded already-complete (4/4 done) in
// every test here, so onboardingCollapsed is always true — these tests are
// about the OFFBOARDING section's own hierarchy/visibility/actions, not a
// re-test of the onboarding repair.
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

const doneOnboardingItems: EnrollmentOnboardingItem[] = [1, 2].map((id) => ({
  id,
  enrollment_id: 1,
  requirement_key: `onboard-${id}`,
  label: `Onboarding item ${id}`,
  task_text_template: `Complete onboarding item ${id}`,
  is_required: true,
  sort_order: id,
  status: "done",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
}));

const buildOffboardingItem = (
  overrides: Partial<EnrollmentOffboardingItem> & { id: number },
): EnrollmentOffboardingItem => ({
  enrollment_id: 1,
  requirement_key: `req-${overrides.id}`,
  label: `Requirement ${overrides.id}`,
  task_text_template: `Handle requirement ${overrides.id}`,
  is_required: true,
  sort_order: overrides.id,
  status: "pending",
  completed_at: null,
  external_ref: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const twoPendingItems: EnrollmentOffboardingItem[] = [
  buildOffboardingItem({ id: 1, label: "Session notes archived" }),
  buildOffboardingItem({ id: 2, label: "Slack access removed" }),
];

const twoDoneItems: EnrollmentOffboardingItem[] = [
  buildOffboardingItem({
    id: 1,
    label: "Session notes archived",
    status: "done",
  }),
  buildOffboardingItem({
    id: 2,
    label: "Slack access removed",
    status: "done",
  }),
];

const pageText = (screen: { container: HTMLElement }): string =>
  screen.container.textContent ?? "";

// Client Offboarding slice: each test gets its own unique Enrollment/Deal/
// Contact id (never a shared id=1 the way earlier ClientShow test files
// happen to get away with) — this file's own tests deliberately flip
// between different lifecycle statuses back and forth across adjacent
// tests (active -> offboarding -> completed -> offboarding -> ...), which
// surfaced a real cross-test staleness hazard sharing one id: even with
// vitest-browser-react's own automatic between-test unmount and a brand
// new dataProvider/QueryClient/Store per render, some caching layer still
// served a PRIOR test's data for the same resource+id once a test file's
// status sequence stopped being monotonic. Distinct ids per test route
// around it entirely, regardless of the exact cause.
let nextId = 1;

const buildTestCrm = ({
  enrollmentStatus,
  offboardingItems,
}: {
  enrollmentStatus: Enrollment["status"];
  offboardingItems: EnrollmentOffboardingItem[];
}) => {
  const id = nextId++;
  const enrollment: Enrollment = {
    id,
    opportunity_id: id,
    status: enrollmentStatus,
    start_date: "2026-01-01",
    end_date: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const deal: Deal = { ...wonDeal, id, contact_id: id };

  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [buildContact({ id, first_name: "Maya", last_name: "Chen" })],
      offers: [gyuOffer],
      deals: [deal],
      enrollments: [enrollment],
      enrollment_onboarding_items: doneOnboardingItems.map((item) => ({
        ...item,
        enrollment_id: id,
      })),
      enrollment_offboarding_items: offboardingItems.map((item) => ({
        ...item,
        enrollment_id: id,
      })),
      offboarding_requirement_templates: [],
      tasks: [],
    } as any),
    silent: true,
  });

  return {
    id,
    dataProvider,
    element: (
      <MemoryRouter initialEntries={[`/enrollments/${id}/show`]}>
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

describe("ClientShow — offboarding hierarchy", () => {
  it("A: Start offboarding is shown only on an ACTIVE Enrollment", async () => {
    const { element } = buildTestCrm({
      enrollmentStatus: "active",
      offboardingItems: [],
    });
    const screen = await render(element);

    await expect.element(screen.getByText("Tasks")).toBeVisible();
    await expect.element(screen.getByText("Start offboarding")).toBeVisible();
  });

  it("B1: Start offboarding is never shown while onboarding", async () => {
    const { element } = buildTestCrm({
      enrollmentStatus: "onboarding",
      offboardingItems: [],
    });
    const screen = await render(element);
    await expect.element(screen.getByText("Payment")).toBeVisible();
    expect(pageText(screen).includes("Start offboarding")).toBe(false);
  });

  it("B2: Start offboarding is never shown while offboarding", async () => {
    const { element } = buildTestCrm({
      enrollmentStatus: "offboarding",
      offboardingItems: twoPendingItems,
    });
    const screen = await render(element);
    await expect.element(screen.getByText("Payment")).toBeVisible();
    await expect
      .element(screen.getByText("Session notes archived"))
      .toBeVisible();
    expect(pageText(screen).includes("Start offboarding")).toBe(false);
  });

  it("B3: Start offboarding is never shown while completed", async () => {
    const { element } = buildTestCrm({
      enrollmentStatus: "completed",
      offboardingItems: twoPendingItems,
    });
    const screen = await render(element);
    await expect.element(screen.getByText("Payment")).toBeVisible();
    await expect
      .element(screen.getByText("Offboarding · Complete 0/2"))
      .toBeVisible();
    expect(pageText(screen).includes("Start offboarding")).toBe(false);
  });

  it("C: no Offboarding section renders for an active Enrollment that never started offboarding", async () => {
    const { element } = buildTestCrm({
      enrollmentStatus: "active",
      offboardingItems: [],
    });
    const screen = await render(element);

    await expect.element(screen.getByText("Tasks")).toBeVisible();
    expect(pageText(screen).includes("Offboarding")).toBe(false);
  });

  it("D: an in-progress offboarding checklist renders expanded, with no Complete client button yet", async () => {
    const { element } = buildTestCrm({
      enrollmentStatus: "offboarding",
      offboardingItems: twoPendingItems,
    });
    const screen = await render(element);

    await expect
      .element(screen.getByText("Session notes archived"))
      .toBeVisible();
    await expect
      .element(screen.getByText("Slack access removed"))
      .toBeVisible();
    await expect.element(screen.getByText("Offboarding 0/2")).toBeVisible();
    expect(pageText(screen).includes("Complete client")).toBe(false);
  });

  it("E: Payment -> Offboarding -> Tasks order while offboarding is in progress (human-acceptance repair: Offboarding is the primary lifecycle action, never buried below Tasks)", async () => {
    const { element } = buildTestCrm({
      enrollmentStatus: "offboarding",
      offboardingItems: twoPendingItems,
    });
    const screen = await render(element);
    await expect.element(screen.getByText("Offboarding 0/2")).toBeVisible();

    const text = pageText(screen);
    const paymentIndex = text.indexOf("Payment");
    const offboardingIndex = text.indexOf("Offboarding 0/2");
    const tasksIndex = text.indexOf("Tasks");

    expect(paymentIndex).toBeGreaterThan(-1);
    expect(offboardingIndex).toBeGreaterThan(-1);
    expect(tasksIndex).toBeGreaterThan(-1);
    expect(paymentIndex).toBeLessThan(offboardingIndex);
    expect(offboardingIndex).toBeLessThan(tasksIndex);
  });

  it("F: Complete client appears once every required offboarding item is done, and completes the Enrollment on click", async () => {
    const { id, element, dataProvider } = buildTestCrm({
      enrollmentStatus: "offboarding",
      offboardingItems: twoDoneItems,
    });
    const screen = await render(element);

    await expect.element(screen.getByText("Complete client")).toBeVisible();
    await screen.getByText("Complete client").click();

    await expect.element(screen.getByText("Completed")).toBeVisible();
    const { data: enrollment } = await dataProvider.getOne("enrollments", {
      id,
    });
    expect(enrollment.status).toBe("completed");
  });

  // Human-acceptance repair, §1: the completion toast used to read
  // "Enrollment completed." — implementation/database language Leif
  // never uses. Never "Enrollment " anywhere in this same toast either.
  it("F2: the completion toast reads 'Offboarding complete', never database language like 'Enrollment'", async () => {
    const { element } = buildTestCrm({
      enrollmentStatus: "offboarding",
      offboardingItems: twoDoneItems,
    });
    const screen = await render(element);

    await screen.getByText("Complete client").click();

    await expect
      .element(screen.getByText("Offboarding complete"))
      .toBeVisible();
    expect(
      (screen.container.textContent ?? "").includes("Enrollment completed"),
    ).toBe(false);
  });

  it("G: a completed Enrollment renders the offboarding checklist collapsed, with a clear completion-count summary", async () => {
    const { element } = buildTestCrm({
      enrollmentStatus: "completed",
      offboardingItems: twoDoneItems,
    });
    const screen = await render(element);

    await expect
      .element(screen.getByText("Offboarding · Complete 2/2"))
      .toBeVisible();
    await expect
      .element(screen.getByText("Session notes archived"))
      .not.toBeVisible();
  });

  it("H: expanding the collapsed, completed offboarding checklist reveals the existing items", async () => {
    const { element } = buildTestCrm({
      enrollmentStatus: "completed",
      offboardingItems: twoDoneItems,
    });
    const screen = await render(element);

    await screen.getByText("Offboarding · Complete 2/2").click();

    await expect
      .element(screen.getByText("Session notes archived"))
      .toBeVisible();
    await expect
      .element(screen.getByText("Slack access removed"))
      .toBeVisible();
  });

  it("I: Payment -> Tasks -> Onboarding · Complete -> Offboarding · Complete order for a completed client (§9)", async () => {
    const { element } = buildTestCrm({
      enrollmentStatus: "completed",
      offboardingItems: twoDoneItems,
    });
    const screen = await render(element);
    await expect
      .element(screen.getByText("Offboarding · Complete 2/2"))
      .toBeVisible();

    const text = pageText(screen);
    const paymentIndex = text.indexOf("Payment");
    const tasksIndex = text.indexOf("Tasks");
    const onboardingIndex = text.indexOf("Onboarding · Complete");
    const offboardingIndex = text.indexOf("Offboarding · Complete");

    expect(paymentIndex).toBeGreaterThan(-1);
    expect(tasksIndex).toBeGreaterThan(-1);
    expect(onboardingIndex).toBeGreaterThan(-1);
    expect(offboardingIndex).toBeGreaterThan(-1);
    expect(paymentIndex).toBeLessThan(tasksIndex);
    expect(tasksIndex).toBeLessThan(onboardingIndex);
    expect(onboardingIndex).toBeLessThan(offboardingIndex);
  });

  it("J: checking an offboarding item's checkbox completes it via the same checklist -> Task sync", async () => {
    const { element, dataProvider } = buildTestCrm({
      enrollmentStatus: "offboarding",
      offboardingItems: twoPendingItems,
    });
    const screen = await render(element);

    await expect
      .element(screen.getByText("Session notes archived"))
      .toBeVisible();
    // The onboarding checklist (already 4/4 done) renders collapsed just
    // above this section, still present in the raw DOM inside its closed
    // <details> — so the checkbox is targeted via the row that actually
    // contains this label, not by position among every checkbox on the
    // page (see OffboardingItemRow: the row is a flex container with the
    // Checkbox as its first child).
    const row = Array.from(screen.container.querySelectorAll("div")).find(
      (el) =>
        Array.from(el.children).some(
          (child) => child.textContent === "Session notes archived",
        ),
    );
    expect(row).toBeTruthy();
    const checkbox = row!.querySelector('button[role="checkbox"]');
    expect(checkbox).toBeTruthy();
    (checkbox as HTMLElement).click();

    await expect.element(screen.getByText("Offboarding 1/2")).toBeVisible();
    const { data: item } = await dataProvider.getOne(
      "enrollment_offboarding_items",
      { id: 1 },
    );
    expect(item.status).toBe("done");
  });

  it("K: collapse/expand never mutates offboarding item data", async () => {
    const { id, element, dataProvider } = buildTestCrm({
      enrollmentStatus: "completed",
      offboardingItems: twoDoneItems,
    });
    const screen = await render(element);

    const before = await dataProvider.getList("enrollment_offboarding_items", {
      filter: { enrollment_id: id },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });

    await screen.getByText("Offboarding · Complete 2/2").click();
    await expect
      .element(screen.getByText("Session notes archived"))
      .toBeVisible();
    await screen.getByText("Offboarding · Complete 2/2").click();

    const after = await dataProvider.getList("enrollment_offboarding_items", {
      filter: { enrollment_id: id },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(after.data).toEqual(before.data);
  });
});
