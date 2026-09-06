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
import type { Deal, Enrollment, Offer } from "@/components/atomic-crm/types";

// Contracts + Onboarding slice: Clients regrouped into Needs Onboarding /
// Active / Past (architecture review, §9) — never a single flat list an
// onboarding client can blend invisibly into.
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

const buildDeal = (id: number, contactId: number): Deal => ({
  id,
  name: `Client ${id}`,
  contact_id: contactId,
  offer_id: 2,
  stage: "won",
  outcome: null,
  amount: 1400,
  sales_id: 0,
  index: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  stage_entered_at: "2026-01-01T00:00:00.000Z",
});

describe("ClientList", () => {
  it("splits clients into Needs Onboarding, Active, and a collapsed Past Clients section", async () => {
    await page.viewport(1280, 900);

    const onboardingEnrollment: Enrollment = {
      id: 1,
      opportunity_id: 1,
      status: "onboarding",
      start_date: null,
      end_date: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const activeEnrollment: Enrollment = {
      id: 2,
      opportunity_id: 2,
      status: "active",
      start_date: null,
      end_date: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const completedEnrollment: Enrollment = {
      id: 3,
      opportunity_id: 3,
      status: "completed",
      start_date: null,
      end_date: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [
          buildContact({
            id: 1,
            first_name: "Onboarding",
            last_name: "Person",
          }),
          buildContact({ id: 2, first_name: "Active", last_name: "Person" }),
          buildContact({ id: 3, first_name: "Past", last_name: "Person" }),
        ],
        offers: [gyuOffer],
        deals: [buildDeal(1, 1), buildDeal(2, 2), buildDeal(3, 3)],
        enrollments: [
          onboardingEnrollment,
          activeEnrollment,
          completedEnrollment,
        ],
        enrollment_onboarding_items: [],
      }),
      silent: true,
    });

    const screen = await render(
      <MemoryRouter initialEntries={["/enrollments"]}>
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
      .element(screen.getByRole("heading", { name: "Needs Onboarding" }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("heading", { name: "Active", exact: true }))
      .toBeInTheDocument();
    await expect.element(screen.getByText("Past Clients")).toBeInTheDocument();
    await expect
      .element(screen.getByText("Onboarding Person"))
      .toBeInTheDocument();
    await expect.element(screen.getByText("Active Person")).toBeInTheDocument();

    // The Past client's row is collapsed by default — not visible until
    // the section is expanded, mirroring ApplicationList's own precedent.
    await expect
      .element(screen.getByText("Past Person"))
      .not.toBeInTheDocument();
  });
});
