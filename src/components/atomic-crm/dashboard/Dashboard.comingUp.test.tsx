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
  Cohort,
  ContactNote,
  Deal,
  Enrollment,
  Offer,
  Task,
} from "@/components/atomic-crm/types";
import type { Db } from "@/components/atomic-crm/providers/fakerest/dataGenerator/types";

// Next Up / Temporal Intelligence slice, §23/§24: renders the full <CRM>
// at "/" — the same convention CRM.routing.test.tsx and waitlist.routing.
// test.tsx already established — so these exercise real routing and the
// real Dashboard, not a shallow mount.
//
// Dates are computed relative to the REAL current time rather than via
// vi.setSystemTime()/vi.useFakeTimers(): faking timers here hung the
// render entirely (FakeRest's simulated latency and React Query's
// internal timers never got a chance to fire), and no other rendering
// test in this codebase mocks system time — pure-logic files like
// livingExampleCapacity.test.ts inject `now` as a plain function
// parameter instead. Sacrifices literal date-string assertions for a
// reliable render; the pure-projection tests (cohortEvents.test.ts,
// comingUpProjection.test.ts) already cover exact chronology/dedupe with
// an injected `today`.
const NOW = new Date();
const isoDateOnly = (date: Date) => date.toISOString().slice(0, 10);
const daysFromNow = (days: number, hour = 12) => {
  const date = new Date(NOW);
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};
const dateOnlyFromNow = (days: number) => {
  const date = new Date(NOW);
  date.setDate(date.getDate() + days);
  return isoDateOnly(date);
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

const seededContactNote: ContactNote = {
  id: 1,
  contact_id: 1,
  text: "Seed note",
  date: "2025-01-01T00:00:00.000Z",
  sales_id: 0,
  status: "warm",
};

const task = (
  overrides: Partial<Task> & Pick<Task, "id" | "due_date">,
): Task => ({
  contact_id: 1,
  type: "other",
  text: "Test task",
  sales_id: 0,
  status: "pending",
  done_date: null,
  ...overrides,
});

const buildTestCrm = (
  initialEntries: string[],
  overrides: Partial<Db> = {},
) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [buildContact({ id: 1 })],
      contact_notes: [seededContactNote],
      offers: [livingExample, gyuOffer],
      cohorts: [],
      offer_payment_options: [],
      applications: [],
      enrollments: [],
      deals: [],
      waitlist_entries: [],
      tasks: [],
      ...overrides,
    }),
    silent: true,
    latency: 0,
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

describe("Dashboard — Needs Attention (Tasks)", () => {
  it("buckets Overdue/Today/Next 7 Days correctly and excludes Completed/Cancelled", async () => {
    await page.viewport(1280, 900);
    // Tasks information-hierarchy pass: the primary title is now
    // "{Task Type}: {Person Name}" (tasks/Task.tsx), not task.text — every
    // task here shares Contact 1 ("Ada Lovelace", buildContact's default),
    // so each needs its own distinguishable `type` instead of relying on
    // `text` to tell the buckets apart.
    const tasks: Task[] = [
      task({ id: 1, due_date: daysFromNow(-3), type: "overdue-task" }),
      task({ id: 2, due_date: daysFromNow(0), type: "today-task" }),
      task({ id: 3, due_date: daysFromNow(3), type: "next-7-days-task" }),
      task({
        id: 4,
        due_date: daysFromNow(0),
        type: "completed-task",
        status: "completed",
        done_date: daysFromNow(-1),
      }),
      task({
        id: 5,
        due_date: daysFromNow(0),
        type: "cancelled-task",
        status: "cancelled",
      }),
    ];

    const { element } = buildTestCrm(["/"], { tasks });
    const screen = await render(element);

    await expect
      .element(screen.getByText("overdue-task: Ada Lovelace"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("today-task: Ada Lovelace"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("next-7-days-task: Ada Lovelace"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("completed-task: Ada Lovelace"))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByText("cancelled-task: Ada Lovelace"))
      .not.toBeInTheDocument();
  });
});

describe("Dashboard — Coming Up", () => {
  it("shows the calm empty state when there are no upcoming events", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm(["/"]);
    const screen = await render(element);

    await expect
      .element(screen.getByRole("heading", { name: "Coming Up" }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("No major program or client dates coming up."))
      .toBeInTheDocument();
  });

  it("renders a Living Example completion/opening and a Cohort start chronologically, with correct link targets", async () => {
    await page.viewport(1280, 900);
    const kathy = buildContact({
      id: 2,
      first_name: "Kathy",
      last_name: "Reyes",
    });
    const leDeal: Deal = {
      id: 1,
      name: "Kathy Reyes — The Living Example",
      contact_id: 2,
      offer_id: 1,
      stage: "won",
      outcome: null,
      amount: 4000,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      sales_id: 0,
      index: 0,
      stage_entered_at: "2026-01-01T00:00:00.000Z",
    };
    const leEnrollment: Enrollment = {
      id: 1,
      opportunity_id: 1,
      status: "active",
      start_date: dateOnlyFromNow(-30),
      end_date: dateOnlyFromNow(30), // later than the Cohort start below
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const septemberCohort: Cohort = {
      id: 1,
      offer_id: 2,
      name: "September GYU Cohort",
      status: "applications_open",
      applications_open_at: dateOnlyFromNow(-10),
      applications_close_at: dateOnlyFromNow(5),
      program_start_at: dateOnlyFromNow(10),
      program_end_at: dateOnlyFromNow(60),
      maximum_capacity: 10,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    const { element } = buildTestCrm(["/"], {
      contacts: [buildContact({ id: 1 }), kathy],
      deals: [leDeal],
      enrollments: [leEnrollment],
      cohorts: [septemberCohort],
    });
    const screen = await render(element);

    await expect
      .element(screen.getByText("Kathy Reyes completes"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("1 Living Example opening"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("September GYU Cohort starts"))
      .toBeInTheDocument();

    const anchors = [...screen.container.querySelectorAll("a")];
    const leAnchor = anchors.find((a) =>
      a.textContent?.includes("Kathy Reyes completes"),
    );
    const cohortAnchor = anchors.find((a) =>
      a.textContent?.includes("September GYU Cohort starts"),
    );
    expect(leAnchor?.getAttribute("href")).toBe(
      "/programs/individual/1#upcoming-openings",
    );
    expect(cohortAnchor?.getAttribute("href")).toBe("/cohorts/1/show");

    // Chronological: Cohort start (day 10) before LE opening (day 30).
    const cohortIndex = anchors.indexOf(cohortAnchor!);
    const leIndex = anchors.indexOf(leAnchor!);
    expect(cohortIndex).toBeLessThan(leIndex);
  });

  it("groups two same-day Living Example completions into one event", async () => {
    await page.viewport(1280, 900);
    const dave = buildContact({ id: 2, first_name: "Dave", last_name: "Kim" });
    const julia = buildContact({
      id: 3,
      first_name: "Julia",
      last_name: "Chen",
    });
    const sharedEndDate = dateOnlyFromNow(30);
    const deals: Deal[] = [
      {
        id: 1,
        name: "Dave Kim — The Living Example",
        contact_id: 2,
        offer_id: 1,
        stage: "won",
        outcome: null,
        amount: 4000,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        sales_id: 0,
        index: 0,
        stage_entered_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: 2,
        name: "Julia Chen — The Living Example",
        contact_id: 3,
        offer_id: 1,
        stage: "won",
        outcome: null,
        amount: 4000,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        sales_id: 0,
        index: 0,
        stage_entered_at: "2026-01-01T00:00:00.000Z",
      },
    ];
    const enrollments: Enrollment[] = [
      {
        id: 1,
        opportunity_id: 1,
        status: "active",
        start_date: dateOnlyFromNow(-30),
        end_date: sharedEndDate,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: 2,
        opportunity_id: 2,
        status: "active",
        start_date: dateOnlyFromNow(-30),
        end_date: sharedEndDate,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ];

    const { element } = buildTestCrm(["/"], {
      contacts: [buildContact({ id: 1 }), dave, julia],
      deals,
      enrollments,
    });
    const screen = await render(element);

    await expect
      .element(screen.getByText("Dave Kim + Julia Chen complete"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("2 Living Example openings"))
      .toBeInTheDocument();
    // Not rendered as two separate rows.
    await expect
      .element(screen.getByText("Dave Kim completes"))
      .not.toBeInTheDocument();
  });

  it("excludes a past Cohort event (applications_open_at already elapsed)", async () => {
    await page.viewport(1280, 900);
    const septemberCohort: Cohort = {
      id: 1,
      offer_id: 2,
      name: "September GYU Cohort",
      status: "applications_open",
      applications_open_at: dateOnlyFromNow(-10), // before today — excluded
      applications_close_at: null,
      program_start_at: null,
      program_end_at: null,
      maximum_capacity: 10,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    const { element } = buildTestCrm(["/"], { cohorts: [septemberCohort] });
    const screen = await render(element);

    await expect
      .element(screen.getByText("No major program or client dates coming up."))
      .toBeInTheDocument();
  });

  it("does not invent a Cohort event from an unset date column", async () => {
    await page.viewport(1280, 900);
    const draftCohort: Cohort = {
      id: 1,
      offer_id: 2,
      name: "Future GYU Cohort",
      status: "draft",
      applications_open_at: null,
      applications_close_at: null,
      program_start_at: null,
      program_end_at: null,
      maximum_capacity: 10,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    const { element } = buildTestCrm(["/"], { cohorts: [draftCohort] });
    const screen = await render(element);

    await expect
      .element(screen.getByText("No major program or client dates coming up."))
      .toBeInTheDocument();
  });
});

describe("Dashboard — hierarchy preserved", () => {
  it("renders Tasks, Coming Up, Business at a Glance, Art Oracle, and Latest Activity together", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm(["/"]);
    const screen = await render(element);

    await expect
      .element(screen.getByRole("heading", { name: "Tasks" }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("heading", { name: "Coming Up" }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("heading", { name: "Business at a Glance" }))
      .toBeInTheDocument();
    await expect.element(screen.getByText("Art Oracle")).toBeInTheDocument();
    await expect
      .element(screen.getByText(/Latest Activity/))
      .toBeInTheDocument();
  });
});
