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
  Application,
  Cohort,
  Deal,
  Offer,
} from "@/components/atomic-crm/types";

// Native Applications slice, §16: the Application review page (title,
// Offer/Cohort context, readable answer labels, summary empty state,
// review actions).
const livingExample: Offer = {
  id: 1,
  name: "The Living Example",
  type: "individual",
  duration: "4 months",
  current_price: 4000,
  max_active_clients: 12,
  is_active: true,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

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

const septemberCohort: Cohort = {
  id: 1,
  offer_id: 2,
  name: "September GYU Cohort",
  status: "applications_open",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

const buildTestCrm = ({
  deal,
  application,
}: {
  deal: Deal;
  application: Application;
}) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [buildContact({ id: 1 })],
      offers: [livingExample, gyuOffer],
      offer_payment_options: [],
      cohorts: [septemberCohort],
      deals: [deal],
      applications: [application],
      enrollments: [],
    }),
    silent: true,
  });
  const authProvider = createTestAuthProvider();
  const store = memoryStore();

  return (
    <MemoryRouter initialEntries={[`/applications/${application.id}/show`]}>
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

const pendingLivingExampleDeal: Deal = {
  id: 1,
  name: "Ada Lovelace — The Living Example",
  contact_id: 1,
  offer_id: 1,
  stage: "application_received",
  outcome: null,
  amount: 4000,
  sales_id: 0,
  index: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  stage_entered_at: "2026-01-01T00:00:00.000Z",
};

const pendingApplication: Application = {
  id: 1,
  opportunity_id: 1,
  status: "pending",
  submitted_at: "2026-08-31T09:00:00.000Z",
  reviewed_at: null,
  raw_answers: {
    why_this_program: "Ready for consistent 1:1 support.",
    some_future_question: "An answer to an unknown key.",
  },
  summary: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("ApplicationShow", () => {
  it("titles the page with the applicant's name, not the record id", async () => {
    await page.viewport(1280, 900);
    const screen = await render(
      buildTestCrm({
        deal: pendingLivingExampleDeal,
        application: pendingApplication,
      }),
    );

    await expect
      .element(screen.getByRole("heading", { name: "Ada Lovelace" }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText(/Application #1/))
      .not.toBeInTheDocument();
  });

  it("renders the Offer context and submitted date", async () => {
    await page.viewport(1280, 900);
    const screen = await render(
      buildTestCrm({
        deal: pendingLivingExampleDeal,
        application: pendingApplication,
      }),
    );

    await expect
      .element(screen.getByText(/The Living Example · Submitted/))
      .toBeInTheDocument();
  });

  it("shows known answer keys with readable labels, never the raw key", async () => {
    await page.viewport(1280, 900);
    const screen = await render(
      buildTestCrm({
        deal: pendingLivingExampleDeal,
        application: pendingApplication,
      }),
    );

    await expect
      .element(screen.getByText("Why this program?"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Ready for consistent 1:1 support."))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("why_this_program"))
      .not.toBeInTheDocument();
  });

  it("humanizes an unknown answer key instead of dropping it", async () => {
    await page.viewport(1280, 900);
    const screen = await render(
      buildTestCrm({
        deal: pendingLivingExampleDeal,
        application: pendingApplication,
      }),
    );

    await expect
      .element(screen.getByText("Some Future Question"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("An answer to an unknown key."))
      .toBeInTheDocument();
  });

  it("shows the empty-summary state when summary is null", async () => {
    await page.viewport(1280, 900);
    const screen = await render(
      buildTestCrm({
        deal: pendingLivingExampleDeal,
        application: pendingApplication,
      }),
    );

    await expect
      .element(screen.getByText("No summary yet."))
      .toBeInTheDocument();
  });

  it("renders all four review actions for a pending Application", async () => {
    await page.viewport(1280, 900);
    const screen = await render(
      buildTestCrm({
        deal: pendingLivingExampleDeal,
        application: pendingApplication,
      }),
    );

    await expect
      .element(screen.getByRole("button", { name: /Approve/ }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: /Needs Higher Care/ }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: /Not Fit/ }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: /Do Not Engage/ }))
      .toBeInTheDocument();
  });

  it("hides the review actions once already reviewed", async () => {
    await page.viewport(1280, 900);
    const reviewedApplication: Application = {
      ...pendingApplication,
      status: "approved",
      reviewed_at: "2026-08-31T10:00:00.000Z",
    };
    const approvedDeal: Deal = {
      ...pendingLivingExampleDeal,
      stage: "approved",
    };
    const screen = await render(
      buildTestCrm({ deal: approvedDeal, application: reviewedApplication }),
    );

    await expect
      .element(screen.getByText("Reviewed — no further action needed."))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: /Approve/ }))
      .not.toBeInTheDocument();
  });

  it("gives the Application primary visual containment and Related Sales secondary treatment", async () => {
    await page.viewport(1280, 900);
    const screen = await render(
      buildTestCrm({
        deal: pendingLivingExampleDeal,
        application: pendingApplication,
      }),
    );
    const { container } = screen;
    await expect
      .element(screen.getByText("Application Summary"))
      .toBeInTheDocument();

    // Summary/Answers/Review Decision all live inside ONE rounded Card
    // (Native Applications repair pass, §1) — not floating directly on
    // the page, and not each in their own separate card.
    const summaryHeading = [...container.querySelectorAll("h2")].find(
      (el) => el.textContent === "Application Summary",
    );
    const answersHeading = [...container.querySelectorAll("h2")].find(
      (el) => el.textContent === "Application Answers",
    );
    const decisionHeading = [...container.querySelectorAll("h2")].find(
      (el) => el.textContent === "Review Decision",
    );
    const applicationCard = summaryHeading?.closest('[class*="rounded-xl"]');
    expect(applicationCard).not.toBeNull();
    expect(applicationCard?.contains(answersHeading ?? null)).toBe(true);
    expect(applicationCard?.contains(decisionHeading ?? null)).toBe(true);

    // Related Sales is a single compact row, not the same large container.
    const relatedSalesHeading = [...container.querySelectorAll("h2")].find(
      (el) => el.textContent === "Related Sales",
    );
    expect(applicationCard?.contains(relatedSalesHeading ?? null)).toBe(false);
  });
});
