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

  // Client Offboarding slice (§10): an Enrollment mid-offboarding is still
  // CURRENT operational work — Leif is actively winding the relationship
  // down, checklist items still need doing. Burying it in the collapsed
  // Past Clients section (as a naive "status !== active -> past" grouping
  // would) would hide exactly the client who most needs attention right
  // now. Distinct ids from the test above (this file's own convention),
  // never reused across tests in this file.
  it("keeps an offboarding client visible in Active, never buried in the collapsed Past Clients section", async () => {
    await page.viewport(1280, 900);

    const offboardingEnrollment: Enrollment = {
      id: 11,
      opportunity_id: 11,
      status: "offboarding",
      start_date: "2026-01-01",
      end_date: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const completedEnrollment: Enrollment = {
      id: 12,
      opportunity_id: 12,
      status: "completed",
      start_date: "2026-01-01",
      end_date: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [
          buildContact({
            id: 11,
            first_name: "Offboarding",
            last_name: "Person",
          }),
          buildContact({ id: 12, first_name: "Past", last_name: "Person" }),
        ],
        offers: [gyuOffer],
        deals: [buildDeal(11, 11), buildDeal(12, 12)],
        enrollments: [offboardingEnrollment, completedEnrollment],
        enrollment_onboarding_items: [],
        enrollment_offboarding_items: [],
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
      .element(screen.getByRole("heading", { name: "Active", exact: true }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Offboarding Person"))
      .toBeInTheDocument();
    // The genuinely completed client stays collapsed in Past Clients —
    // proving this isn't "everything now shows", only offboarding moved.
    await expect
      .element(screen.getByText("Past Person"))
      .not.toBeInTheDocument();
  });

  // Someone who signed up and then left before finishing. The historical
  // importer can now record that truthfully, and the two things that must
  // hold are that she is not presented as a current client, and not
  // described as having "Completed" the programme she left. Distinct ids
  // again, per this file's own convention.
  // Samantha Putkunz: the container ran its course without her finishing
  // the work and without a formal withdrawal. "Completed" would claim she
  // finished; "Withdrawn" would claim she told us she was leaving.
  it("files an ended container under Past and labels it neither Completed nor Withdrawn", async () => {
    await page.viewport(1280, 900);

    const endedEnrollment: Enrollment = {
      id: 15,
      opportunity_id: 15,
      status: "ended",
      start_date: "2026-04-29",
      end_date: "2026-08-24",
      created_at: "2026-04-29T00:00:00.000Z",
      updated_at: "2026-08-24T00:00:00.000Z",
    };
    const currentEnrollment: Enrollment = {
      id: 16,
      opportunity_id: 16,
      status: "active",
      start_date: "2026-01-01",
      end_date: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [
          buildContact({ id: 15, first_name: "Ended", last_name: "Container" }),
          buildContact({ id: 16, first_name: "Still", last_name: "Going" }),
        ],
        offers: [gyuOffer],
        deals: [buildDeal(15, 15), buildDeal(16, 16)],
        enrollments: [endedEnrollment, currentEnrollment],
        enrollment_onboarding_items: [],
        enrollment_offboarding_items: [],
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
      .element(screen.getByRole("heading", { name: "Active", exact: true }))
      .toBeInTheDocument();
    await expect.element(screen.getByText("Still Going")).toBeInTheDocument();

    // Not current: filed under the collapsed Past section.
    await expect
      .element(screen.getByText("Ended Container"))
      .not.toBeInTheDocument();

    // And neither loaded word appears anywhere on the page.
    await expect
      .element(screen.getByText("Completed", { exact: true }))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByText("Withdrawn", { exact: true }))
      .not.toBeInTheDocument();
  });

  it("treats a withdrawn client as past, and never labels her as having completed the programme", async () => {
    await page.viewport(1280, 900);

    const withdrawnEnrollment: Enrollment = {
      id: 13,
      opportunity_id: 13,
      status: "withdrawn",
      start_date: "2026-08-05",
      end_date: null,
      created_at: "2026-08-05T00:00:00.000Z",
      updated_at: "2026-08-05T00:00:00.000Z",
    };
    const activeEnrollment: Enrollment = {
      id: 14,
      opportunity_id: 14,
      status: "active",
      start_date: "2026-01-01",
      end_date: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [
          buildContact({
            id: 13,
            first_name: "Withdrawn",
            last_name: "Person",
          }),
          buildContact({ id: 14, first_name: "Current", last_name: "Person" }),
        ],
        offers: [gyuOffer],
        deals: [buildDeal(13, 13), buildDeal(14, 14)],
        enrollments: [withdrawnEnrollment, activeEnrollment],
        enrollment_onboarding_items: [],
        enrollment_offboarding_items: [],
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

    // The genuinely current client is the only one shown as such.
    await expect
      .element(screen.getByRole("heading", { name: "Active", exact: true }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Current Person"))
      .toBeInTheDocument();

    // She is filed under Past, which is collapsed — so she is not on screen
    // among Leif's current clients.
    await expect
      .element(screen.getByText("Withdrawn Person"))
      .not.toBeInTheDocument();

    // And the word "Completed" is nowhere on this page: the only terminal
    // client here withdrew, and saying otherwise about a real person is the
    // exact failure this status exists to prevent.
    await expect
      .element(screen.getByText("Completed", { exact: true }))
      .not.toBeInTheDocument();
  });
});
