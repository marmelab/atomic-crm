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
import type {
  Deal,
  Enrollment,
  EnrollmentOnboardingItem,
  Offer,
  Task,
} from "@/components/atomic-crm/types";

// Contracts + Onboarding slice: the Enrollment/Client page as the real
// onboarding operational home (architecture review, §2/§9) — payment
// context, checklist, linked Tasks, and the explicit Activate action.
const gyuOffer: Offer = {
  id: 2,
  name: "Growing Yourself Up",
  type: "group",
  duration: "8 weeks",
  current_price: 1400,
  is_active: true,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

const wonDeal: Deal = {
  id: 1,
  name: "Ada Lovelace — Growing Yourself Up",
  contact_id: 1,
  offer_id: 2,
  stage: "won",
  outcome: null,
  amount: 1400,
  offer_name_snapshot: "Growing Yourself Up",
  offer_price_snapshot: 1400,
  selected_payment_option_id: 5,
  selected_payment_total: 1400,
  selected_installment_count: 2,
  selected_installment_amount: 700,
  sales_id: 0,
  index: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  stage_entered_at: "2026-01-01T00:00:00.000Z",
};

const enrollment: Enrollment = {
  id: 1,
  opportunity_id: 1,
  status: "onboarding",
  start_date: null,
  end_date: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const buildItem = (
  overrides: Partial<EnrollmentOnboardingItem>,
): EnrollmentOnboardingItem => ({
  id: overrides.id ?? 1,
  enrollment_id: 1,
  requirement_key: "contract",
  label: "Contract signed",
  task_text_template: "Send contract to {name}",
  is_required: true,
  sort_order: 1,
  status: "pending",
  completed_at: null,
  external_ref: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildTask = (overrides: Partial<Task>): Task => ({
  id: overrides.id ?? 1,
  contact_id: 1,
  type: "onboarding_item",
  text: "Send contract to Ada Lovelace",
  due_date: "2026-01-04T00:00:00.000Z",
  status: "pending",
  enrollment_id: 1,
  onboarding_item_id: 1,
  ...overrides,
});

const buildTestCrm = ({
  items,
  tasks = [],
  enrollmentOverrides = {},
}: {
  items: EnrollmentOnboardingItem[];
  tasks?: Task[];
  enrollmentOverrides?: Partial<Enrollment>;
}) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Ada", last_name: "Lovelace" }),
      ],
      offers: [gyuOffer],
      deals: [wonDeal],
      enrollments: [{ ...enrollment, ...enrollmentOverrides }],
      enrollment_onboarding_items: items,
      tasks,
    }),
    silent: true,
  });
  const authProvider = createTestAuthProvider();
  const store = memoryStore();

  return {
    dataProvider,
    element: (
      <MemoryRouter initialEntries={[`/enrollments/1/show`]}>
        <CRM
          dataProvider={dataProvider}
          authProvider={authProvider}
          i18nProvider={testI18nProvider}
          store={store}
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

describe("ClientShow (Enrollment operational home)", () => {
  it("shows the authoritative payment context — first installment received, not the whole plan implied paid", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm({ items: [buildItem({})] });
    const screen = await render(element);

    await expect
      .element(
        screen.getByText(
          "First payment of $700 USD received — 1 more payment of $700 USD remaining.",
        ),
      )
      .toBeInTheDocument();
  });

  it("renders the checklist with required items and their progress count", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm({
      items: [
        buildItem({
          id: 1,
          requirement_key: "contract",
          label: "Contract signed",
        }),
        buildItem({
          id: 2,
          requirement_key: "slack_access",
          label: "Slack access",
          status: "done",
          completed_at: "2026-01-02T00:00:00.000Z",
        }),
      ],
    });
    const screen = await render(element);

    await expect
      .element(screen.getByText("Contract signed"))
      .toBeInTheDocument();
    await expect.element(screen.getByText("Slack access")).toBeInTheDocument();
    await expect
      .element(screen.getByText(/Onboarding 1\/2/))
      .toBeInTheDocument();
  });

  it("checking an incomplete item marks it done, completes its linked Task, and advances the progress count", async () => {
    await page.viewport(1280, 900);
    // Two required items so the progress count stays visible after
    // checking one (checking the only one instead transitions straight to
    // "Onboarding complete" — covered by its own test below).
    const item = buildItem({ id: 1 });
    const secondItem = buildItem({
      id: 2,
      requirement_key: "slack_access",
      label: "Slack access",
    });
    const task = buildTask({ id: 1, onboarding_item_id: 1 });
    const { dataProvider, element } = buildTestCrm({
      items: [item, secondItem],
      tasks: [task],
    });
    const screen = await render(element);

    await expect
      .element(screen.getByText(/Onboarding 0\/2/))
      .toBeInTheDocument();

    const checkbox = screen.getByRole("checkbox").first();
    await checkbox.click();

    await expect
      .element(screen.getByText(/Onboarding 1\/2/))
      .toBeInTheDocument();

    const { data: syncedTask } = await dataProvider.getOne<Task>("tasks", {
      id: 1,
    });
    expect(syncedTask.status).toBe("completed");
    expect(syncedTask.done_date).toBeTruthy();
  });

  it("shows plain progress and no Activate button at all while required items remain incomplete — never a mysterious disabled control", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm({
      items: [buildItem({ id: 1, status: "pending" })],
    });
    const screen = await render(element);

    await expect
      .element(screen.getByText(/Onboarding 0\/1/))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: /Activate/ }))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByText("Onboarding complete"))
      .not.toBeInTheDocument();
  });

  it("reveals 'Onboarding complete' and an enabled 'Activate client' button once every required item is done, then activates exactly once", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm({
      items: [buildItem({ id: 1, status: "pending" })],
    });
    const screen = await render(element);

    await screen.getByRole("checkbox").first().click();

    await expect
      .element(screen.getByText("Onboarding complete"))
      .toBeInTheDocument();
    const activateButton = screen.getByRole("button", {
      name: "Activate client",
    });
    await expect.element(activateButton).toBeInTheDocument();
    await expect.element(activateButton).not.toBeDisabled();

    await activateButton.click();

    await expect
      .element(screen.getByText("Enrollment activated."))
      .toBeInTheDocument();
    // Activate button disappears once the Enrollment is no longer
    // onboarding — never a lingering control that could double-activate.
    await expect
      .element(screen.getByRole("button", { name: /Activate/ }))
      .not.toBeInTheDocument();
  });

  it("never renders a separate Tasks list on the Enrollment page — the checklist is already the human-facing representation of that work", async () => {
    await page.viewport(1280, 900);
    const item = buildItem({ id: 1 });
    const task = buildTask({
      id: 1,
      onboarding_item_id: 1,
      text: "Send contract to Ada Lovelace",
    });
    const { element } = buildTestCrm({ items: [item], tasks: [task] });
    const screen = await render(element);

    await expect
      .element(screen.getByText("Contract signed"))
      .toBeInTheDocument();
    // The linked Task's own text still appears — as a small hint under its
    // checklist row. getByText itself is strict (throws on more than one
    // match), so this also proves it's never duplicated into a separate
    // standalone Tasks list.
    await expect
      .element(screen.getByText("Send contract to Ada Lovelace"))
      .toBeInTheDocument();
  });

  it("the client's name links directly to their real Contact page — the actual relationship, not a heuristic", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm({ items: [buildItem({})] });
    const screen = await render(element);

    const nameLink = screen.getByRole("link", { name: "Ada Lovelace" });
    await expect.element(nameLink).toBeInTheDocument();
    await expect.element(nameLink).toHaveAttribute("href", "/contacts/1/show");
  });
});
