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

// Onboarding-gate real-infrastructure repair: found via real human Auth
// acceptance testing, not fixtures — an administrator whose only Contact
// arrived through the public application form (real production behavior:
// Contact/Deal/Application/Task created automatically, never a Contact
// Note) was permanently stuck behind DashboardStepper's "Add your first
// note" step, with no legitimate way through it. Every other Dashboard
// test in this codebase seeds both a Contact AND a Contact Note by
// default (see Dashboard.comingUp.test.tsx's buildTestCrm), which is
// exactly why this exact "1 Contact, 0 Contact Notes" administrator state
// was never exercised by any existing test before this bug reached a real
// user.
const buildTestCrm = (overrides: Partial<Db> = {}) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [buildContact({ id: 1 })],
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
  it("a Contact with zero Contact Notes still reaches the real Dashboard, not the onboarding stepper", async () => {
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
      .element(screen.getByText("Add your first note"))
      .not.toBeInTheDocument();
  });

  it("zero Contacts still shows the lightweight onboarding stepper (step 1 preserved)", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm({ contacts: [] });
    const screen = await render(element);

    await expect.element(screen.getByText("What's next?")).toBeInTheDocument();
    await expect
      .element(screen.getByRole("heading", { name: "Tasks" }))
      .not.toBeInTheDocument();
  });
});
