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
import type { Cohort, ContactNote, Offer, WaitlistEntry } from "../types";
import type { Db } from "@/components/atomic-crm/providers/fakerest/dataGenerator/types";

// Waitlists slice, §22 (PROGRAM UI / CONTACT UI / DNE): renders the full
// <CRM> through a route, the same convention CRM.routing.test.tsx already
// established, so these exercise real routing + real data-loading rather
// than a shallow component mount.
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

const novemberCohort: Cohort = {
  id: 2,
  offer_id: 2,
  name: "November GYU Cohort",
  status: "applications_open",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

const seededContactNote: ContactNote = {
  id: 1,
  contact_id: 1,
  text: "Seed note",
  date: "2025-01-01T00:00:00.000Z",
  sales_id: 0,
  status: "warm",
};

const buildTestCrm = (
  initialEntries: string[],
  overrides: Partial<Db> = {},
) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [buildContact({ id: 1 })],
      contact_notes: [seededContactNote],
      offers: [livingExample, gyuOffer],
      cohorts: [septemberCohort, novemberCohort],
      offer_payment_options: [],
      applications: [],
      enrollments: [],
      deals: [],
      waitlist_entries: [],
      ...overrides,
    }),
    silent: true,
  });
  const authProvider = createTestAuthProvider();
  const store = memoryStore();

  const element = (
    <MemoryRouter initialEntries={initialEntries}>
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

  return { element, dataProvider };
};

const entry = (
  overrides: Partial<WaitlistEntry> &
    Pick<WaitlistEntry, "id" | "contact_id" | "offer_id">,
): WaitlistEntry => ({
  cohort_id: null,
  status: "waiting",
  joined_at: "2026-01-01T00:00:00.000Z",
  desired_timing: null,
  notes: null,
  priority: null,
  source: null,
  invited_at: null,
  converted_at: null,
  converted_opportunity_id: null,
  removed_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("Living Example page — Waitlist section", () => {
  it("shows only active entries with a correct count; converted/removed are excluded", async () => {
    await page.viewport(1280, 900);
    const contacts = [
      buildContact({ id: 1, first_name: "Ada", last_name: "Lovelace" }),
      buildContact({ id: 2, first_name: "Owen", last_name: "Blake" }),
      buildContact({ id: 3, first_name: "Ivy", last_name: "Osei" }),
      buildContact({ id: 4, first_name: "Felix", last_name: "Tran" }),
    ];
    const entries = [
      entry({ id: 1, contact_id: 2, offer_id: 1, status: "waiting" }),
      entry({ id: 2, contact_id: 3, offer_id: 1, status: "converted" }),
      entry({ id: 3, contact_id: 4, offer_id: 1, status: "removed" }),
    ];

    const { element } = buildTestCrm(["/programs/individual/1"], {
      contacts,
      waitlist_entries: entries,
    });
    const screen = await render(element);

    await expect
      .element(screen.getByRole("heading", { name: "Waitlist · 1" }))
      .toBeInTheDocument();
    await expect.element(screen.getByText("Owen Blake")).toBeInTheDocument();
    await expect.element(screen.getByText("Ivy Osei")).not.toBeInTheDocument();
    await expect
      .element(screen.getByText("Felix Tran"))
      .not.toBeInTheDocument();
  });
});

describe("Group Program page (GYU general) — Waitlist section", () => {
  it("shows only offer-level entries — a cohort-specific entry never leaks in", async () => {
    await page.viewport(1280, 900);
    const contacts = [
      buildContact({ id: 1, first_name: "Dana", last_name: "Cole" }),
      buildContact({ id: 2, first_name: "Nadia", last_name: "Osei" }),
    ];
    const entries = [
      entry({
        id: 1,
        contact_id: 1,
        offer_id: 2,
        cohort_id: null,
        status: "waiting",
      }),
      entry({
        id: 2,
        contact_id: 2,
        offer_id: 2,
        cohort_id: 1,
        status: "waiting",
      }),
    ];

    const { element } = buildTestCrm(["/programs/group/2"], {
      contacts,
      waitlist_entries: entries,
    });
    const screen = await render(element);

    await expect
      .element(screen.getByRole("heading", { name: "Waitlist · 1" }))
      .toBeInTheDocument();
    await expect.element(screen.getByText("Dana Cole")).toBeInTheDocument();
    await expect
      .element(screen.getByText("Nadia Osei"))
      .not.toBeInTheDocument();
  });
});

describe("Cohort page — Waitlist section", () => {
  it("shows only that Cohort's entries — general GYU waiting and another Cohort's entries never leak in", async () => {
    await page.viewport(1280, 900);
    const contacts = [
      buildContact({ id: 1, first_name: "Malik", last_name: "Rowe" }),
      buildContact({ id: 2, first_name: "Dana", last_name: "Cole" }),
      buildContact({ id: 3, first_name: "Theo", last_name: "Marsh" }),
    ];
    const entries = [
      entry({
        id: 1,
        contact_id: 1,
        offer_id: 2,
        cohort_id: 1,
        status: "waiting",
      }),
      entry({
        id: 2,
        contact_id: 2,
        offer_id: 2,
        cohort_id: null,
        status: "waiting",
      }),
      entry({
        id: 3,
        contact_id: 3,
        offer_id: 2,
        cohort_id: 2,
        status: "waiting",
      }),
    ];

    const { element } = buildTestCrm(["/cohorts/1/show"], {
      contacts,
      waitlist_entries: entries,
    });
    const screen = await render(element);

    await expect
      .element(screen.getByRole("heading", { name: "Waitlist · 1" }))
      .toBeInTheDocument();
    await expect.element(screen.getByText("Malik Rowe")).toBeInTheDocument();
    await expect.element(screen.getByText("Dana Cole")).not.toBeInTheDocument();
    await expect
      .element(screen.getByText("Theo Marsh"))
      .not.toBeInTheDocument();
  });
});

describe("ContactShow — Waitlists section", () => {
  it("shows both an active and a historical entry, with distinct status", async () => {
    await page.viewport(1280, 900);
    const contact = buildContact({
      id: 1,
      first_name: "Sarah",
      last_name: "Jones",
    });
    const entries = [
      entry({ id: 1, contact_id: 1, offer_id: 1, status: "waiting" }),
      entry({
        id: 2,
        contact_id: 1,
        offer_id: 2,
        cohort_id: 1,
        status: "removed",
        removed_at: "2026-01-05T00:00:00.000Z",
      }),
    ];

    const { element } = buildTestCrm(["/contacts/1/show"], {
      contacts: [contact],
      waitlist_entries: entries,
    });
    const screen = await render(element);

    await expect
      .element(screen.getByText("The Living Example"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Growing Yourself Up — September GYU Cohort"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Waiting", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Removed", { exact: true }))
      .toBeInTheDocument();
  });
});

describe("Add to Waitlist — Do Not Engage guard", () => {
  it("keeps a DNE Contact selectable but blocks adding them to the waitlist", async () => {
    await page.viewport(1280, 900);
    const dneContact = buildContact({
      id: 2,
      first_name: "Willis",
      last_name: "Byrne",
      email_jsonb: [{ email: "willis.byrne@example.com", type: "Work" }],
      sales_eligibility: "do_not_engage",
    });

    const { element, dataProvider } = buildTestCrm(["/programs/individual/1"], {
      contacts: [buildContact({ id: 1 }), dneContact],
    });
    const screen = await render(element);

    await screen.getByRole("button", { name: "Add to Waitlist" }).click();
    await screen.getByText("Search by name or email…").click();
    await screen.getByPlaceholder("Search...").fill("Willis");

    // Findable — never hidden from the selector.
    await expect.element(screen.getByText("Willis Byrne")).toBeInTheDocument();
    await screen.getByText("Willis Byrne").click();

    // Unlike the Opportunity Person field, this one has no dedicated Alert —
    // the async validator's message surfaces as the field's own validation
    // error, which react-hook-form resolves on a submit attempt.
    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect
      .element(
        screen.getByText(
          "This person is marked Do Not Engage — they can't be added to a waitlist.",
        ),
      )
      .toBeInTheDocument();

    // Blocked: no entry is created for them.
    const { total } = await dataProvider.getList("waitlist_entries", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(0);
  });
});
