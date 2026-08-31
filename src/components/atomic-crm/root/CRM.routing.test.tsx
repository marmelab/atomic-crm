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

const buildTestCrm = (initialEntries: string[]) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [buildContact({ id: 1 })],
      contact_notes: [seededContactNote],
      offers: [livingExample, gyuOffer],
      cohorts: [septemberCohort],
      offer_payment_options: [],
      applications: [],
      enrollments: [],
      deals: [],
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
    await expect
      .element(screen.getByText("Cohort September GYU Cohort"))
      .toBeInTheDocument();
  });
});
