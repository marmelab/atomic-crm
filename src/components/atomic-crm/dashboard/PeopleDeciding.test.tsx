import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { memoryStore } from "ra-core";
import { MemoryRouter } from "react-router";

import { CRM } from "../root/CRM";
import { Notification } from "@/components/admin/notification";
import { testI18nProvider } from "../providers/commons/i18nProvider";
import { createDataProvider } from "../providers/fakerest/dataProvider";
import {
  buildContact,
  createCrmDb,
  createTestAuthProvider,
} from "@/test/StoryWrapper";
import type { Deal, Offer } from "../types";

// Production said "Nobody is currently deciding" while the Pipeline showed
// eight people at Decision, Kristen McGee among them. Two separate causes,
// both covered here: the Dashboard used to require prospect_decision and
// owner_decision (set on 1 Opportunity out of 120), and then its query
// filtered on an "is null" operator that returned nothing at all.
//
// The invariant: Dashboard People Deciding == the active Decision-stage
// population, with no dashboard-only definition of "deciding".

const offer: Offer = {
  id: 1,
  name: "The Living Example",
  type: "individual",
  duration: "4 months",
  current_price: 4000,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const deal = (over: Partial<Deal> & { id: number; contact_id: number }): Deal =>
  ({
    name: `Deal ${over.id}`,
    offer_id: 1,
    stage: "decision",
    outcome: null,
    archived_at: null,
    amount: 4000,
    sales_id: 0,
    index: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    stage_entered_at: "2026-01-01T00:00:00.000Z",
    offer_name_snapshot: "The Living Example",
    ...over,
  }) as Deal;

const renderDashboard = (
  deals: Deal[],
  contacts: ReturnType<typeof buildContact>[],
) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({ contacts, offers: [offer], deals, tasks: [] }),
    silent: true,
  });
  return render(
    <MemoryRouter initialEntries={["/"]}>
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
};

describe("Dashboard — People Deciding", () => {
  it("lists an active Decision-stage person even with no decision fields recorded", async () => {
    await page.viewport(1280, 900);
    // Kristen's real production shape: stage decision, both optional
    // decision fields null. Requiring them is what emptied the Dashboard.
    const screen = await renderDashboard(
      [
        deal({
          id: 69,
          contact_id: 105,
          prospect_decision: null,
          owner_decision: null,
        }),
      ],
      [buildContact({ id: 105, first_name: "Kristen", last_name: "McGee" })],
    );

    await expect.element(screen.getByText("Kristen McGee")).toBeInTheDocument();
    await expect
      .element(screen.getByText("Nobody is currently deciding."))
      .not.toBeInTheDocument();
  });

  it("excludes Decision-stage Opportunities that have already closed or been archived", async () => {
    await page.viewport(1280, 900);
    const screen = await renderDashboard(
      [
        deal({ id: 1, contact_id: 201 }),
        deal({ id: 2, contact_id: 202, outcome: "lost" }),
        deal({ id: 3, contact_id: 203, outcome: "nurture" }),
        deal({
          id: 4,
          contact_id: 204,
          archived_at: "2026-02-01T00:00:00.000Z",
        }),
      ],
      [
        buildContact({ id: 201, first_name: "Still", last_name: "Deciding" }),
        buildContact({ id: 202, first_name: "Went", last_name: "Lost" }),
        buildContact({ id: 203, first_name: "Went", last_name: "Nurture" }),
        buildContact({ id: 204, first_name: "Was", last_name: "Archived" }),
      ],
    );

    await expect
      .element(screen.getByText("Still Deciding"))
      .toBeInTheDocument();
    for (const name of ["Went Lost", "Went Nurture", "Was Archived"]) {
      await expect.element(screen.getByText(name)).not.toBeInTheDocument();
    }
  });

  it("says nobody is deciding only when genuinely nobody is at Decision", async () => {
    await page.viewport(1280, 900);
    const screen = await renderDashboard(
      [deal({ id: 1, contact_id: 301, stage: "call_booked" })],
      [buildContact({ id: 301, first_name: "Call", last_name: "Booked" })],
    );

    await expect
      .element(screen.getByText("Nobody is currently deciding."))
      .toBeInTheDocument();
  });
});
