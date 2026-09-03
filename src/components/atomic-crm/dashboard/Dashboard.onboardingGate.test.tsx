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
import type { Db } from "@/components/atomic-crm/providers/fakerest/dataGenerator/types";

// Onboarding-gate real-infrastructure repair, round 2: found via real human
// Auth acceptance testing — after round 1 (removing the Contact-Note
// requirement) shipped, cleaning up the disposable test Contact used to
// verify it returned the real CRM to zero Contacts, and the stock
// "What's next? / Add your first contact" stepper reappeared for Leif's
// own already-initialized administrator account. The lesson: CRM
// initialization must never be inferred from business-data counts — an
// initialized CRM with zero Contacts is still an initialized CRM (that is
// already authProvider.ts's own job, via init_state/the `sales` table,
// independent of Contacts). The Dashboard now has NO business-data gate at
// all; every section renders its own empty state.
const buildTestCrm = (overrides: Partial<Db> = {}) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [],
      contact_notes: [],
      offers: [],
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
  return { element, dataProvider };
};

describe("Dashboard onboarding gate — an initialized administrator is never blocked by starter-data requirements", () => {
  it("zero Contacts and zero Contact Notes still reaches the real Dashboard with empty-state sections, not the onboarding stepper", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm();
    const screen = await render(element);

    await expect
      .element(screen.getByRole("heading", { name: "Tasks" }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("What's next?"))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByText("Add your first contact"))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByText("Add your first note"))
      .not.toBeInTheDocument();
  });

  it("a Contact with zero Contact Notes still reaches the real Dashboard, not the onboarding stepper", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm({ contacts: [buildContact({ id: 1 })] });
    const screen = await render(element);

    await expect
      .element(screen.getByRole("heading", { name: "Tasks" }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("What's next?"))
      .not.toBeInTheDocument();
  });
});
