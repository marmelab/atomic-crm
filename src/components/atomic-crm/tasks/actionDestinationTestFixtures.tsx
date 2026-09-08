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
  Deal,
  Offer,
  Task,
} from "@/components/atomic-crm/types";
import type { Db } from "@/components/atomic-crm/providers/fakerest/dataGenerator/types";

// Shared fixtures for the Task-as-action-launcher regression tests (split
// across several small, single-test files — vitest browser mode's
// per-file worker showed cumulative render/timeout instability across
// repeated <CRM/> mounts within one file that isolated files don't hit;
// this also matches the codebase's own "many small files" convention).
// Reproduces the exact real record shape found via real human Auth
// acceptance testing: a Contact whose only Deal has one still-pending
// Application, with a "review_application" Task pointing at that Contact
// via contact_id — Task's only durable link (see
// useTaskActionDestination.ts's own comment on why).
export const livingExample: Offer = {
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

export const buildDeal = (overrides: Partial<Deal> = {}): Deal =>
  ({
    id: 10,
    name: "SalesId Verify — The Living Example",
    contact_id: 1,
    offer_id: 1,
    cohort_id: null,
    stage: "application_received",
    outcome: null,
    owner_decision: null,
    amount: 4000,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    sales_id: 0,
    index: 0,
    stage_entered_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }) as Deal;

export const buildApplication = (
  overrides: Partial<Application> = {},
): Application => ({
  id: 100,
  opportunity_id: 10,
  status: "pending",
  submitted_at: "2026-01-01T00:00:00.000Z",
  reviewed_at: null,
  raw_answers: { why_this_program: "Testing the action-launcher fix." },
  summary: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

export const buildReviewTask = (overrides: Partial<Task> = {}): Task => ({
  id: 1000,
  contact_id: 1,
  type: "review_application",
  text: "Review SalesId Verify's application",
  due_date: "2026-01-01T00:00:00.000Z",
  done_date: null,
  status: "pending",
  sales_id: 0,
  ...overrides,
});

export const buildTestCrm = (overrides: Partial<Db> = {}) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "SalesId", last_name: "Verify" }),
      ],
      contact_notes: [],
      offers: [livingExample],
      offer_payment_options: [],
      cohorts: [],
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
  // dataProvider is returned alongside element (backward compatible —
  // every existing caller destructures only { element }) so a Dashboard-
  // routing regression test (Task.contactRouting.test.tsx) can read back
  // Task/Enrollment/Contact/Deal state after an interaction, the same
  // "prove nothing mutated" shape ClientShow.tasks.test.tsx's own tests
  // already use.
  return { element, dataProvider };
};
