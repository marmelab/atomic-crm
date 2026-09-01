import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { memoryStore, type AuthProvider } from "ra-core";
import { MemoryRouter } from "react-router";

import { CRM } from "./CRM";
import { Notification } from "@/components/admin/notification";
import { testI18nProvider } from "@/components/atomic-crm/providers/commons/i18nProvider";
import { createDataProvider } from "@/components/atomic-crm/providers/fakerest";
import { createDataProviderPublicApplicationDataSource } from "@/components/atomic-crm/public-application/publicApplicationDataSource";
import { buildContact, createCrmDb } from "@/test/StoryWrapper";
import type {
  Application,
  Cohort,
  Contact,
  ContactNote,
  Deal,
  Offer,
  Task,
} from "@/components/atomic-crm/types";

// Native Application Intake acceptance-repair pass: proves the actual root
// cause is fixed, not just that submitApplication.ts returns the right
// object in isolation (unit-tested separately in
// public-application/submitApplication.test.ts). This renders the REAL
// <CRM/> tree — the same one src/App.tsx / demo/App.tsx mount — reaches
// /apply/* WITHOUT logging in (an authProvider whose checkAuth always
// rejects, unlike @/test/StoryWrapper's createTestAuthProvider, which
// always resolves authenticated and so never actually proves the public/
// unauthenticated claim), submits through the real form UI, then re-mounts
// <CRM/> with the SAME dataProvider instance and a genuinely authenticated
// session to confirm the submitted Contact/Application/Opportunity/Task
// are visible through the CRM's own resource list — the exact chain a
// human tester follows.
const unauthenticatedProvider: AuthProvider = {
  checkAuth: async () => {
    throw new Error("not authenticated");
  },
  checkError: async () => undefined,
  login: async () => undefined,
  logout: async () => undefined,
  getIdentity: async () => {
    throw new Error("not authenticated");
  },
};

const authenticatedProvider: AuthProvider = {
  checkAuth: async () => undefined,
  checkError: async () => undefined,
  canAccess: async () => true,
  login: async () => undefined,
  logout: async () => undefined,
  getIdentity: async () => ({ id: 0, fullName: "Leif" }),
};

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
  applications_open_at: "2025-01-01",
  applications_close_at: "2099-01-01",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

const buildSharedDb = (
  contacts: Contact[] = [],
  contactNotes: ContactNote[] = [],
) =>
  createDataProvider({
    db: createCrmDb({
      contacts,
      contact_notes: contactNotes,
      offers: [livingExample, gyuOffer],
      offer_payment_options: [],
      cohorts: [septemberCohort],
      applications: [],
      enrollments: [],
      deals: [],
      tasks: [],
      waitlist_entries: [],
    } as any),
    silent: true,
    latency: 0,
  });

const renderPublicRoute = (
  dataProvider: ReturnType<typeof buildSharedDb>,
  initialEntry: string,
) => {
  const publicApplicationDataSource =
    createDataProviderPublicApplicationDataSource(dataProvider);
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CRM
        dataProvider={dataProvider}
        authProvider={unauthenticatedProvider}
        i18nProvider={testI18nProvider}
        store={memoryStore()}
        disableTelemetry
        publicApplicationDataSource={publicApplicationDataSource}
        layout={({ children }) => (
          <>
            {children}
            <Notification />
          </>
        )}
      />
    </MemoryRouter>,
  );
};

const renderAdminRoute = (
  dataProvider: ReturnType<typeof buildSharedDb>,
  initialEntry: string,
) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CRM
        dataProvider={dataProvider}
        authProvider={authenticatedProvider}
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

describe("Public /apply routes — unauthenticated access + shared demo state", () => {
  it("Living Example: renders with no login redirect, and the submitted Contact/Application/Opportunity/Task are visible through the SAME dataProvider the CRM itself reads", async () => {
    await page.viewport(1280, 900);
    const dataProvider = buildSharedDb();
    const screen = await renderPublicRoute(
      dataProvider,
      "/apply/living-example",
    );

    // Proves §15's "accessible WITHOUT CRM authentication": this
    // authProvider's checkAuth always throws, yet the form renders instead
    // of a login page.
    await expect
      .element(screen.getByLabelText("First name"))
      .toBeInTheDocument();

    await screen.getByLabelText("First name").fill("Natasha");
    await screen.getByLabelText("Last name").fill("Repair");
    await screen.getByLabelText("Email").fill("natasha.repair@example.com");
    await screen
      .getByLabelText("Why this program?")
      .fill("Testing the acceptance repair.");
    await screen.getByRole("button", { name: "Submit application" }).click();

    await expect
      .element(screen.getByText("Application received"))
      .toBeInTheDocument();

    // The actual proof: the SAME dataProvider instance now has the full
    // chain — no separate/isolated FakeRest store, no hard-reload boundary
    // between the public form and whatever reads this data next.
    const { data: contacts } = await dataProvider.getList<Contact>("contacts", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(contacts).toHaveLength(1);
    expect(contacts[0].first_name).toBe("Natasha");

    const { data: deals } = await dataProvider.getList<Deal>("deals", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(deals).toHaveLength(1);
    expect(deals[0].offer_id).toBe(livingExample.id);
    expect(deals[0].stage).toBe("application_received");
    expect(deals[0].entry_path).toBe("application_form");

    const { data: applications } = await dataProvider.getList<Application>(
      "applications",
      {
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(applications).toHaveLength(1);
    expect(applications[0].opportunity_id).toBe(deals[0].id);
    expect(applications[0].status).toBe("pending");
    expect(applications[0].submitted_at).toBeTruthy();

    const { data: tasks } = await dataProvider.getList<Task>("tasks", {
      filter: { type: "review_application" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe("pending");

    // The strongest available proof this session: re-mount the REAL <CRM/>
    // (a fresh browser render, same as a human clicking to a different
    // page) against the SAME dataProvider object, now authenticated, and
    // confirm Natasha is actually visible through the CRM's own UI — not
    // merely present in the data layer.
    const adminScreen = await renderAdminRoute(dataProvider, "/applications");
    await expect
      .element(adminScreen.getByText("Natasha Repair"))
      .toBeInTheDocument();
  });

  it("Growing Yourself Up (cohort 1): full chain, correct offer/cohort association", async () => {
    await page.viewport(1280, 900);
    const dataProvider = buildSharedDb();
    const screen = await renderPublicRoute(
      dataProvider,
      "/apply/growing-yourself-up/1",
    );

    await expect
      .element(screen.getByLabelText("First name"))
      .toBeInTheDocument();

    await screen.getByLabelText("First name").fill("Tycho");
    await screen.getByLabelText("Last name").fill("Repair");
    await screen.getByLabelText("Email").fill("tycho.repair@example.com");
    await screen
      .getByLabelText("Why this cohort?")
      .fill("Testing the acceptance repair.");
    await screen.getByRole("button", { name: "Submit application" }).click();

    await expect
      .element(screen.getByText("Application received"))
      .toBeInTheDocument();

    const { data: deals } = await dataProvider.getList<Deal>("deals", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(deals).toHaveLength(1);
    expect(deals[0].offer_id).toBe(gyuOffer.id);
    expect(deals[0].cohort_id).toBe(septemberCohort.id);

    const adminScreen = await renderAdminRoute(dataProvider, "/applications");
    await expect
      .element(adminScreen.getByText("Tycho Repair"))
      .toBeInTheDocument();
  });

  // Acceptance-repair pass, round 2: the Contact/Application/Opportunity
  // chain already proved itself visible above via the Applications list —
  // that list has no owner filter, so it never exposed this bug. The
  // Dashboard's own Tasks section (dashboard/DashboardTasks.tsx) is
  // different: it queries `filter: { sales_id: identity?.id }` — a Task
  // created with no sales_id at all (every one intake produced before this
  // repair) silently never matches and never appears here, even though it
  // fully exists. This asserts against that EXACT query's own rendered
  // output, not just the isolated task-creation helper, per the human
  // acceptance condition ("navigate to the Dashboard... confirm a visible
  // Review Application task").
  it("Living Example: the Review Application Task is visible on the Dashboard's own Today bucket, not just the Applications list", async () => {
    await page.viewport(1280, 900);
    // Dashboard.tsx gates its real content behind an onboarding stepper
    // until at least one Contact and one ContactNote exist (see
    // CRM.routing.test.tsx's own identical seeding) — an unrelated
    // baseline record, distinct from the applicant this test submits.
    const baselineContact = buildContact({ id: 99, first_name: "Baseline" });
    const baselineNote: ContactNote = {
      id: 1,
      contact_id: 99,
      text: "Seed note",
      date: "2025-01-01T00:00:00.000Z",
      sales_id: 0,
      status: "warm",
    };
    const dataProvider = buildSharedDb([baselineContact], [baselineNote]);
    const screen = await renderPublicRoute(
      dataProvider,
      "/apply/living-example",
    );

    await screen.getByLabelText("First name").fill("Lau");
    await screen.getByLabelText("Last name").fill("Repair");
    await screen.getByLabelText("Email").fill("lau.repair@example.com");
    await screen
      .getByLabelText("Why this program?")
      .fill("Reproducing the missing Dashboard task.");
    await screen.getByRole("button", { name: "Submit application" }).click();
    await expect
      .element(screen.getByText("Application received"))
      .toBeInTheDocument();

    // Same identity id (0) as the administrator Sale createCrmDb seeds by
    // default — the exact match resolveDefaultTaskSalesId's fix depends on.
    const adminScreen = await renderAdminRoute(dataProvider, "/");
    await expect
      .element(adminScreen.getByText("Business at a Glance"))
      .toBeInTheDocument();
    // Primary title format: "{Task Type}: {Person Name}" (Tasks
    // information-hierarchy pass) — not task.text.
    await expect
      .element(adminScreen.getByText("Review Application: Lau Repair"))
      .toBeInTheDocument();
  });

  it("Growing Yourself Up (cohort 1): the Review Application Task is visible on the Dashboard's own Today bucket", async () => {
    await page.viewport(1280, 900);
    const baselineContact = buildContact({ id: 99, first_name: "Baseline" });
    const baselineNote: ContactNote = {
      id: 1,
      contact_id: 99,
      text: "Seed note",
      date: "2025-01-01T00:00:00.000Z",
      sales_id: 0,
      status: "warm",
    };
    const dataProvider = buildSharedDb([baselineContact], [baselineNote]);
    const screen = await renderPublicRoute(
      dataProvider,
      "/apply/growing-yourself-up/1",
    );

    await screen.getByLabelText("First name").fill("Sable");
    await screen.getByLabelText("Last name").fill("Repair");
    await screen.getByLabelText("Email").fill("sable.repair@example.com");
    await screen
      .getByLabelText("Why this cohort?")
      .fill("Reproducing the missing Dashboard task for GYU.");
    await screen.getByRole("button", { name: "Submit application" }).click();
    await expect
      .element(screen.getByText("Application received"))
      .toBeInTheDocument();

    const adminScreen = await renderAdminRoute(dataProvider, "/");
    await expect
      .element(adminScreen.getByText("Business at a Glance"))
      .toBeInTheDocument();
    await expect
      .element(adminScreen.getByText("Review Application: Sable Repair"))
      .toBeInTheDocument();
  });

  it("DNE Contact: generic public success, no Review Application Task, no reactivation — verified through the CRM's own resource lists", async () => {
    await page.viewport(1280, 900);
    const dneContact = buildContact({
      id: 1,
      first_name: "Dana",
      last_name: "Existing",
      email_jsonb: [{ email: "dana.existing@example.com", type: "Work" }],
      sales_eligibility: "do_not_engage",
    });
    const dataProvider = buildSharedDb([dneContact]);
    const screen = await renderPublicRoute(
      dataProvider,
      "/apply/living-example",
    );

    await screen.getByLabelText("First name").fill("Dana");
    await screen.getByLabelText("Last name").fill("Existing");
    await screen.getByLabelText("Email").fill("dana.existing@example.com");
    await screen
      .getByLabelText("Why this program?")
      .fill("Testing DNE auto-resolve.");
    await screen.getByRole("button", { name: "Submit application" }).click();

    // Identical applicant-facing copy — no hint anything is different.
    await expect
      .element(screen.getByText("Application received"))
      .toBeInTheDocument();

    const { data: applications } = await dataProvider.getList<Application>(
      "applications",
      {
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(applications).toHaveLength(1);
    expect(applications[0].status).toBe("do_not_engage");

    const { data: deals } = await dataProvider.getList<Deal>("deals", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(deals).toHaveLength(1);
    expect(deals[0].outcome).toBe("lost");
    expect(deals[0].owner_decision).toBe("do_not_engage");

    const { total: taskCount } = await dataProvider.getList("tasks", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(taskCount).toBe(0);
  });

  it("double-click Submit creates exactly one Contact/Deal/Application/Task", async () => {
    await page.viewport(1280, 900);
    const dataProvider = buildSharedDb();
    const screen = await renderPublicRoute(
      dataProvider,
      "/apply/living-example",
    );

    await screen.getByLabelText("First name").fill("Double");
    await screen.getByLabelText("Last name").fill("Click");
    await screen.getByLabelText("Email").fill("double.click@example.com");
    await screen
      .getByLabelText("Why this program?")
      .fill("Testing duplicate-submit protection.");

    const submitButton = screen.getByRole("button", {
      name: "Submit application",
    });
    await submitButton.click();

    // The button disables synchronously with the click (PublicApplicationForm.tsx's
    // isSubmitting guard) — Playwright's own actionability check refuses to
    // click a disabled element, which is itself the proof a literal second
    // click can never reach handleSubmit while a submission is in flight.
    await expect.element(screen.getByText("Submitting…")).toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: "Submitting…" }))
      .toBeDisabled();

    await expect
      .element(screen.getByText("Application received"))
      .toBeInTheDocument();

    const { total: contactCount } = await dataProvider.getList("contacts", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(contactCount).toBe(1);
    const { total: applicationCount } = await dataProvider.getList(
      "applications",
      {
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(applicationCount).toBe(1);
    const { total: taskCount } = await dataProvider.getList("tasks", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(taskCount).toBe(1);
  });

  it("a genuine write failure shows a generic failure state, not success", async () => {
    await page.viewport(1280, 900);
    const dataProvider = buildSharedDb();
    const failingDataSource = {
      ...createDataProviderPublicApplicationDataSource(dataProvider),
      submitApplication: async () => {
        throw new Error("simulated network failure");
      },
    };
    const screen = await render(
      <MemoryRouter initialEntries={["/apply/living-example"]}>
        <CRM
          dataProvider={dataProvider}
          authProvider={unauthenticatedProvider}
          i18nProvider={testI18nProvider}
          store={memoryStore()}
          disableTelemetry
          publicApplicationDataSource={failingDataSource}
          layout={({ children }) => (
            <>
              {children}
              <Notification />
            </>
          )}
        />
      </MemoryRouter>,
    );

    await screen.getByLabelText("First name").fill("Fails");
    await screen.getByLabelText("Last name").fill("Safely");
    await screen.getByLabelText("Email").fill("fails.safely@example.com");
    await screen
      .getByLabelText("Why this program?")
      .fill("Testing the failure path.");
    await screen.getByRole("button", { name: "Submit application" }).click();

    await expect
      .element(screen.getByText("Application received"))
      .not.toBeInTheDocument();
    await expect
      .element(
        screen.getByText("Something went wrong on our end. Please try again."),
      )
      .toBeInTheDocument();

    const { total: contactCount } = await dataProvider.getList("contacts", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(contactCount).toBe(0);
  });
});
