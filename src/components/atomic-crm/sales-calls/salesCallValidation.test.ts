import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Deal, Offer, SalesCall } from "../types";

const CONTACT_ID = 1;
const OFFER_ID = 1;
const DEAL_ID = 1;

const buildFixtures = () => {
  const contact = buildContact({ id: CONTACT_ID });
  const offer: Offer = {
    id: OFFER_ID,
    name: "The Living Example",
    type: "individual",
    duration: "6 months",
    current_price: 4000,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const deal: Deal = {
    id: DEAL_ID,
    name: "Ada Lovelace",
    contact_id: CONTACT_ID,
    offer_id: OFFER_ID,
    stage: "call_booked",
    outcome: null,
    owner_decision: null,
    amount: 4000,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    sales_id: 0,
    index: 0,
    stage_entered_at: "2026-01-01T00:00:00.000Z",
  };
  const existingCall: SalesCall = {
    id: 1,
    opportunity_id: DEAL_ID,
    contact_id: CONTACT_ID,
    status: "booked",
    original_scheduled_at: "2026-09-01T15:00:00.000Z",
    scheduled_at: "2026-09-01T15:00:00.000Z",
    reschedule_count: 0,
    source: "manual",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const otherDeal: Deal = { ...deal, id: 2 };
  return createDataProvider({
    db: createCrmDb({
      contacts: [contact],
      offers: [offer],
      deals: [deal, otherDeal],
      sales_calls: [existingCall],
    }),
    silent: true,
    latency: 0,
  });
};

describe("sales_calls FakeRest defense-in-depth", () => {
  it("rejects a raw create() that would produce a second booked call for the same Opportunity", async () => {
    const dataProvider = buildFixtures();

    await expect(
      dataProvider.create("sales_calls", {
        data: {
          opportunity_id: DEAL_ID,
          contact_id: CONTACT_ID,
          status: "booked",
          original_scheduled_at: "2026-09-10T15:00:00.000Z",
          scheduled_at: "2026-09-10T15:00:00.000Z",
          reschedule_count: 0,
          source: "manual",
        },
      }),
    ).rejects.toThrow();
  });

  it("allows a raw create() for a different Opportunity", async () => {
    const dataProvider = buildFixtures();
    await expect(
      dataProvider.create("sales_calls", {
        data: {
          opportunity_id: 2,
          contact_id: CONTACT_ID,
          status: "booked",
          original_scheduled_at: "2026-09-10T15:00:00.000Z",
          scheduled_at: "2026-09-10T15:00:00.000Z",
          reschedule_count: 0,
          source: "manual",
        },
      }),
    ).resolves.toBeTruthy();
  });
});
