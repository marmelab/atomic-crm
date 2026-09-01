import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Application, Cohort, Contact, Deal, Offer } from "../types";
import { reviewApplication } from "./reviewApplication";

// Diagnostic test for the reported "DNE contact disappears from Contacts"
// bug (Native Applications repair pass, §2): reproduces the exact query
// ContactList.tsx issues (getList "contacts", no filter, sort by
// last_seen DESC) immediately after a Do Not Engage review, against the
// real FakeRest dataProvider (not a mock) — the same layer the reported
// symptom would have gone through.
const CONTACT_ID = 1;
const OFFER_ID = 1;
const DEAL_ID = 1;
const APPLICATION_ID = 1;

const buildFixtures = () => {
  const contact = buildContact({ id: CONTACT_ID, first_name: "Willis" });

  const offer: Offer = {
    id: OFFER_ID,
    name: "The Living Example",
    type: "individual",
    duration: "4 months",
    current_price: 4000,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  const deal: Deal = {
    id: DEAL_ID,
    name: "Willis Lovelace — The Living Example",
    contact_id: CONTACT_ID,
    offer_id: OFFER_ID,
    stage: "application_received",
    outcome: null,
    owner_decision: null,
    amount: 4000,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    sales_id: 0,
    index: 0,
    stage_entered_at: "2026-01-01T00:00:00.000Z",
  };

  const application: Application = {
    id: APPLICATION_ID,
    opportunity_id: DEAL_ID,
    status: "pending",
    submitted_at: "2026-01-01T00:00:00.000Z",
    reviewed_at: null,
    raw_answers: {},
    summary: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [contact],
      offers: [offer],
      offer_payment_options: [],
      cohorts: [] as Cohort[],
      deals: [deal],
      applications: [application],
      enrollments: [],
    }),
    silent: true,
    latency: 0,
  });

  return { dataProvider, deal, application, contact };
};

describe("Do Not Engage contact visibility", () => {
  it("the DNE Contact still appears in the unfiltered Contacts list", async () => {
    const { dataProvider, deal, application } = buildFixtures();

    await reviewApplication({
      dataProvider,
      application,
      deal,
      outcome: "do_not_engage",
    });

    const { data, total } = await dataProvider.getList<Contact>("contacts", {
      pagination: { page: 1, perPage: 25 },
      sort: { field: "last_seen", order: "DESC" },
      filter: {},
    });
    expect(total).toBe(1);
    expect(data.map((c) => c.id)).toContain(CONTACT_ID);
    expect(data[0]!.sales_eligibility).toBe("do_not_engage");
  });

  it("the DNE Contact is still findable by search", async () => {
    const { dataProvider, deal, application } = buildFixtures();

    await reviewApplication({
      dataProvider,
      application,
      deal,
      outcome: "do_not_engage",
    });

    const { data, total } = await dataProvider.getList<Contact>("contacts", {
      pagination: { page: 1, perPage: 25 },
      sort: { field: "last_seen", order: "DESC" },
      filter: { q: "Willis" },
    });
    expect(total).toBe(1);
    expect(data[0]!.first_name).toBe("Willis");
  });

  it("the DNE Contact is still fetchable individually (Contact show page)", async () => {
    const { dataProvider, deal, application } = buildFixtures();

    await reviewApplication({
      dataProvider,
      application,
      deal,
      outcome: "do_not_engage",
    });

    const { data } = await dataProvider.getOne<Contact>("contacts", {
      id: CONTACT_ID,
    });
    expect(data.id).toBe(CONTACT_ID);
    expect(data.sales_eligibility).toBe("do_not_engage");
  });

  it("the DNE Contact still appears in the Person selector (contacts_summary reference)", async () => {
    const { dataProvider, deal, application } = buildFixtures();

    await reviewApplication({
      dataProvider,
      application,
      deal,
      outcome: "do_not_engage",
    });

    const { data, total } = await dataProvider.getList<Contact>(
      "contacts_summary",
      {
        pagination: { page: 1, perPage: 25 },
        sort: { field: "last_seen", order: "DESC" },
        filter: { q: "Willis" },
      },
    );
    expect(total).toBe(1);
    expect(data[0]!.id).toBe(CONTACT_ID);
  });

  it("the DNE Opportunity is excluded from the active pipeline query, while the Contact's history remains reachable via the Deal", async () => {
    const { dataProvider, deal, application } = buildFixtures();

    await reviewApplication({
      dataProvider,
      application,
      deal,
      outcome: "do_not_engage",
    });

    const { total: activeCount } = await dataProvider.getList<Deal>("deals", {
      pagination: { page: 1, perPage: 25 },
      sort: { field: "index", order: "DESC" },
      filter: {
        "archived_at@is": null,
        "stage@neq": "won",
        "outcome@is": null,
      },
    });
    expect(activeCount).toBe(0);

    // Still directly reachable (history preserved) even though excluded
    // from the active-pipeline query above.
    const { data: historicalDeal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(historicalDeal.outcome).toBe("lost");
    expect(historicalDeal.owner_decision).toBe("do_not_engage");
  });
});
