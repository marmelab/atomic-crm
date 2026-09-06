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
} from "@/components/atomic-crm/types";

// Contracts + Onboarding slice: the Dashboard's "Needs Onboarding" section
// (architecture review, §1/§9) — the primary "this person cannot
// disappear" signal, read directly off Enrollment state rather than Tasks.
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
  selected_payment_total: 1400,
  selected_installment_count: 1,
  selected_installment_amount: 1400,
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

const items: EnrollmentOnboardingItem[] = [
  {
    id: 1,
    enrollment_id: 1,
    requirement_key: "contract",
    label: "Contract signed",
    task_text_template: "Send contract to {name}",
    is_required: true,
    sort_order: 1,
    status: "done",
    completed_at: "2026-01-02T00:00:00.000Z",
    external_ref: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 2,
    enrollment_id: 1,
    requirement_key: "slack_access",
    label: "Slack access",
    task_text_template: "Invite {name} to GYU Slack",
    is_required: true,
    sort_order: 2,
    status: "pending",
    completed_at: null,
    external_ref: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

const buildTestCrm = () => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Ada", last_name: "Lovelace" }),
      ],
      offers: [gyuOffer],
      deals: [wonDeal],
      enrollments: [enrollment],
      enrollment_onboarding_items: items,
    }),
    silent: true,
  });
  const authProvider = createTestAuthProvider();
  const store = memoryStore();

  return (
    <MemoryRouter initialEntries={["/"]}>
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
  );
};

describe("Dashboard — Needs Onboarding", () => {
  it("shows a Won client's onboarding progress and links straight to their Enrollment", async () => {
    await page.viewport(1280, 900);
    const screen = await render(buildTestCrm());

    await expect
      .element(
        screen.getByText("Ada Lovelace paid $1,400 USD — Growing Yourself Up"),
      )
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("onboarding 1/2 complete"))
      .toBeInTheDocument();

    const link = screen.getByRole("link", {
      name: /Ada Lovelace paid/,
    });
    await expect.element(link).toHaveAttribute("href", "/enrollments/1/show");
  });

  it("never shows an Active (already onboarded) Enrollment in this section", async () => {
    await page.viewport(1280, 900);
    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [buildContact({ id: 1 })],
        offers: [gyuOffer],
        deals: [wonDeal],
        enrollments: [{ ...enrollment, status: "active" }],
        enrollment_onboarding_items: items,
      }),
      silent: true,
    });
    const screen = await render(
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
      </MemoryRouter>,
    );

    await expect
      .element(screen.getByText("Needs Onboarding"))
      .not.toBeInTheDocument();
  });
});
