import { describe, expect, it } from "vitest";

import { createDataProvider } from "./dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type {
  Contact,
  Deal,
  Enrollment,
  Offer,
  WaitlistEntry,
} from "../../types";

// Empirical proof that the derived relationship fields (Contacts UX
// cleanup pass) actually reach what a real "contacts" getList call
// returns and can be filtered on — not just that
// computeContactRelationshipFields's own math is right in isolation.
// contactRelationshipFields.ts's own header explains why this can't be a
// direct `db` mutation (ra-data-fakerest deep-clones on construction).

const leOffer: Offer = {
  id: 1,
  name: "The Living Example",
  type: "individual",
  duration: "4 months",
  current_price: 4000,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const gyuOffer: Offer = {
  id: 2,
  name: "Growing Yourself Up",
  type: "group",
  duration: "8 weeks",
  current_price: 1400,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const buildDeal = (overrides: Partial<Deal>): Deal => ({
  pricing_mode: "standard",
  id: 1,
  name: "Test",
  contact_id: 1,
  offer_id: leOffer.id,
  cohort_id: null,
  stage: "interested",
  outcome: null,
  amount: 4000,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  sales_id: 0,
  index: 0,
  stage_entered_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("contacts getList — derived relationship fields (FakeRest)", () => {
  it("attaches offer_ids and is_current_client and returns them from a real getList call", async () => {
    const contact = buildContact({ id: 1 });
    const deal = buildDeal({ id: 10, contact_id: 1, offer_id: gyuOffer.id });
    const enrollment: Enrollment = {
      id: 1,
      opportunity_id: 10,
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [contact],
        offers: [leOffer, gyuOffer],
        offer_payment_options: [],
        cohorts: [],
        deals: [deal],
        enrollments: [enrollment],
        applications: [],
        waitlist_entries: [],
      } as any),
      silent: true,
      latency: 0,
    });

    const { data } = await dataProvider.getList<Contact>("contacts", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    });

    expect(data).toHaveLength(1);
    expect(data[0]!.offer_ids).toEqual([gyuOffer.id]);
    expect(data[0]!.is_current_client).toBe(true);
    expect(data[0]!.is_past_client).toBe(false);
  });

  it("supports filtering by the derived is_on_waitlist field, matching the ToggleFilterButton pattern used elsewhere", async () => {
    const onWaitlist = buildContact({ id: 1, first_name: "Waiting" });
    const notOnWaitlist = buildContact({ id: 2, first_name: "NotWaiting" });
    const entry: WaitlistEntry = {
      id: 1,
      contact_id: 1,
      offer_id: leOffer.id,
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
    };

    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [onWaitlist, notOnWaitlist],
        offers: [leOffer, gyuOffer],
        offer_payment_options: [],
        cohorts: [],
        deals: [],
        enrollments: [],
        applications: [],
        waitlist_entries: [entry],
      } as any),
      silent: true,
      latency: 0,
    });

    const { data } = await dataProvider.getList<Contact>("contacts", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: { is_on_waitlist: true },
    });

    expect(data).toHaveLength(1);
    expect(data[0]!.first_name).toBe("Waiting");
  });

  it("supports filtering Offer History via the array-containment operator (offer_ids@cs), the same pattern the existing tags filter already uses", async () => {
    const leContact = buildContact({ id: 1, first_name: "LEOnly" });
    const gyuContact = buildContact({ id: 2, first_name: "GYUOnly" });
    const leDeal = buildDeal({ id: 10, contact_id: 1, offer_id: leOffer.id });
    const gyuDeal = buildDeal({ id: 11, contact_id: 2, offer_id: gyuOffer.id });

    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [leContact, gyuContact],
        offers: [leOffer, gyuOffer],
        offer_payment_options: [],
        cohorts: [],
        deals: [leDeal, gyuDeal],
        enrollments: [],
        applications: [],
        waitlist_entries: [],
      } as any),
      silent: true,
      latency: 0,
    });

    const { data } = await dataProvider.getList<Contact>("contacts", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: { "offer_ids@cs": `{${gyuOffer.id}}` },
    });

    expect(data).toHaveLength(1);
    expect(data[0]!.first_name).toBe("GYUOnly");
  });
});
