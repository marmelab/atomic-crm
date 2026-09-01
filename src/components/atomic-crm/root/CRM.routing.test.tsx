import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { memoryStore } from "ra-core";
import { MemoryRouter } from "react-router";

import { CRM } from "./CRM";
import { Notification } from "@/components/admin/notification";
import { testI18nProvider } from "@/components/atomic-crm/providers/commons/i18nProvider";
import { createDataProvider } from "@/components/atomic-crm/providers/fakerest";
import {
  buildContact,
  createCrmDb,
  createTestAuthProvider,
} from "@/test/StoryWrapper";
import type { Cohort, ContactNote, Offer } from "@/components/atomic-crm/types";
import type { Db } from "@/components/atomic-crm/providers/fakerest/dataGenerator/types";

// Chaos Monkey routing/shell regression: at any viewport narrow enough to
// use the Mobile shell, "/" rendered only a "Latest Activity" fragment
// (the pre-Dashboard/Today-slice MobileDashboard) instead of the real
// Dashboard, and Cohort detail pages 404'd because "cohorts" was never a
// registered Resource under MobileAdmin. Both are fixed here: every
// viewport renders the same Dashboard content, and a Cohort reached from
// the Programs hub stays reachable on mobile.
//
// This renders <CRM> directly rather than through @/test/StoryWrapper:
// StoryWrapper's `dashboard` prop always substitutes its own `children`
// slot for whichever Dashboard component CRM would otherwise pick, which
// is exactly the mobile-vs-desktop dashboard selection this regression is
// about — so it can't be used to test it.
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

// Dashboard.tsx gates its real content behind an onboarding stepper until
// at least one Contact and one ContactNote exist.
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
  deals: Db["deals"] = [],
  enrollments: Db["enrollments"] = [],
  extraContacts: Db["contacts"] = [],
) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [buildContact({ id: 1 }), ...extraContacts],
      contact_notes: [seededContactNote],
      offers: [livingExample, gyuOffer],
      cohorts: [septemberCohort],
      offer_payment_options: [],
      applications: [],
      enrollments,
      deals,
    }),
    silent: true,
  });
  const authProvider = createTestAuthProvider();
  const store = memoryStore();

  return (
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
};

// NOTE: mounting the full <CRM> in this browser-mode test harness does not
// reliably reproduce the mobile-shell switch itself — `page.viewport()`
// updates `window.innerWidth` (confirmed) but the deeply-nested Admin tree
// still renders DesktopAdmin at a sub-768px width here, unlike the
// isolated useIsMobile() hook test (use-mobile.test.tsx) or manual browser
// verification, both of which correctly reproduce the mobile shell at this
// width. These two tests are still valuable as content/routing regression
// coverage (mirroring what the human tester observed), but they do not by
// themselves prove which shell rendered — see use-mobile.test.tsx for that.
describe("CRM Dashboard and Cohort routes at a narrow (sub-768px) viewport", () => {
  it("renders the full Dashboard (not just Latest Activity)", async () => {
    // MOBILE_BREAKPOINT in hooks/use-mobile.ts is 768px: <768 is mobile.
    await page.viewport(600, 900);
    const screen = await render(buildTestCrm(["/"]));

    await expect
      .element(screen.getByText("Business at a Glance"))
      .toBeInTheDocument();
    await expect.element(screen.getByText("Tasks")).toBeInTheDocument();
  });

  it("keeps a Cohort detail page reachable (no dead route)", async () => {
    await page.viewport(600, 900);
    const screen = await render(buildTestCrm(["/programs"]));

    await expect
      .element(screen.getByText("September GYU Cohort"))
      .toBeInTheDocument();
    await screen.getByText("September GYU Cohort").click();

    await expect.element(screen.getByText("Not Found")).not.toBeInTheDocument();
    // CohortShow was rewritten this slice (§3) to match the Living Example
    // page's visual language: the Cohort's own name is now the page's h1,
    // with no "Cohort " prefix.
    await expect
      .element(screen.getByRole("heading", { name: "September GYU Cohort" }))
      .toBeInTheDocument();
  });
});

// Runtime Fix + Visual Consistency slice, §1/§12: the Opportunities pipeline
// was down with "Failed to fetch dynamically imported module" (root-caused
// to @hello-pangea/dnd only being reachable through DealList's lone
// React.lazy() boundary — fixed via optimizeDeps.include in vite.config.ts
// / vite.demo.config.ts). That specific dev-server dependency-optimization
// race isn't reproducible in a unit-test environment (no real Vite dev
// server involved), so this instead guards the code-level half of the
// regression: the lazy-loaded /deals route still mounts and renders real
// data through to completion, with no dead-route fallback.
describe("Opportunities pipeline (DealList) route", () => {
  it("renders the Kanban board via its lazy-loaded route, with each card showing what the person is applying for", async () => {
    await page.viewport(1280, 900);
    const leDeal: Db["deals"][number] = {
      id: 1,
      name: "Ada Lovelace — The Living Example",
      contact_id: 1,
      offer_id: 1,
      stage: "call_booked",
      outcome: null,
      amount: 4000,
      sales_id: 0,
      index: 0,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
      stage_entered_at: "2025-01-01T00:00:00.000Z",
    };
    // Acceptance-repair pass, round 2: the Kanban card previously showed
    // only the Contact's name and the amount, with no way to tell a Living
    // Example card apart from a Growing Yourself Up one at a glance —
    // seeding one of each proves DealCard.tsx renders the actual Offer
    // name (offers' own recordRepresentation), not a shared/blank label.
    const gyuContact = buildContact({
      id: 2,
      first_name: "Geralyn",
      last_name: "Marsh",
    });
    const gyuDeal: Db["deals"][number] = {
      id: 2,
      name: "Geralyn Marsh — Growing Yourself Up",
      contact_id: 2,
      offer_id: 2,
      cohort_id: 1,
      stage: "call_booked",
      outcome: null,
      amount: 1400,
      sales_id: 0,
      index: 1,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
      stage_entered_at: "2025-01-01T00:00:00.000Z",
    };
    const screen = await render(
      buildTestCrm(["/deals"], [leDeal, gyuDeal], [], [gyuContact]),
    );

    await expect.element(screen.getByText("Not Found")).not.toBeInTheDocument();
    // Each Kanban card shows its linked Contact's name, not the Deal's own
    // `name` field — see DealCard.tsx.
    await expect.element(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    await expect.element(screen.getByText("Geralyn Marsh")).toBeInTheDocument();
    await expect
      .element(screen.getByText("The Living Example · $4.00K"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Growing Yourself Up · $1.40K"))
      .toBeInTheDocument();
    // Column heading shows the visible Opportunity count alongside the
    // stage name (UX cleanup pass, §2) — both seeded deals are in "Call
    // Booked", an empty column ("Interested") shows 0.
    await expect
      .element(screen.getByText("Call Booked · 2"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Interested · 0"))
      .toBeInTheDocument();
  });
});

// §12: "relevant GYU cohort link destinations" — a Cohort page's person
// links must land on a real Contact page for both a still-deciding
// applicant and an already-enrolled client, never a dead route.
describe("GYU Cohort person links", () => {
  it("a person still deciding links through to their Contact page", async () => {
    await page.viewport(1280, 900);
    const decidingDeal: Db["deals"][number] = {
      id: 2,
      name: "Ada Lovelace — Growing Yourself Up",
      contact_id: 1,
      offer_id: 2,
      cohort_id: 1,
      stage: "call_booked",
      outcome: null,
      amount: 1400,
      sales_id: 0,
      index: 0,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
      stage_entered_at: "2025-01-01T00:00:00.000Z",
    };
    const screen = await render(
      buildTestCrm(["/cohorts/1/show"], [decidingDeal]),
    );

    await expect
      .element(screen.getByRole("heading", { name: "People Deciding" }))
      .toBeInTheDocument();
    await screen.getByRole("link", { name: "Ada Lovelace" }).click();

    await expect.element(screen.getByText("Not Found")).not.toBeInTheDocument();
    await expect.element(screen.getByText("CTO")).toBeInTheDocument();
  });

  it("an enrolled client links through to their Contact page", async () => {
    await page.viewport(1280, 900);
    const enrolledDeal: Db["deals"][number] = {
      id: 3,
      name: "Ada Lovelace — Growing Yourself Up",
      contact_id: 1,
      offer_id: 2,
      cohort_id: 1,
      stage: "won",
      outcome: null,
      amount: 1400,
      sales_id: 0,
      index: 0,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
      stage_entered_at: "2025-01-01T00:00:00.000Z",
    };
    const enrollment: Db["enrollments"][number] = {
      id: 1,
      opportunity_id: 3,
      status: "active",
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
    };
    const screen = await render(
      buildTestCrm(["/cohorts/1/show"], [enrolledDeal], [enrollment]),
    );

    await expect
      .element(screen.getByRole("heading", { name: "Enrolled Clients" }))
      .toBeInTheDocument();
    await screen.getByRole("link", { name: "Ada Lovelace" }).click();

    await expect.element(screen.getByText("Not Found")).not.toBeInTheDocument();
    await expect.element(screen.getByText("CTO")).toBeInTheDocument();
  });
});
