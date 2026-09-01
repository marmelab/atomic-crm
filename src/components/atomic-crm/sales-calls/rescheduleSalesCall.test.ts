import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Deal, Offer, SalesCall } from "../types";
import { rescheduleSalesCall } from "./rescheduleSalesCall";

const CONTACT_ID = 1;
const OFFER_ID = 1;
const DEAL_ID = 1;
const SALES_CALL_ID = 1;

const buildFixtures = (salesCallOverrides: Partial<SalesCall> = {}) => {
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
  const salesCall: SalesCall = {
    id: SALES_CALL_ID,
    opportunity_id: DEAL_ID,
    contact_id: CONTACT_ID,
    status: "booked",
    original_scheduled_at: "2026-09-01T15:00:00.000Z",
    scheduled_at: "2026-09-01T15:00:00.000Z",
    reschedule_count: 0,
    source: "manual",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...salesCallOverrides,
  };
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [contact],
      offers: [offer],
      deals: [deal],
      sales_calls: [salesCall],
      tasks: [],
    }),
    silent: true,
    latency: 0,
  });
  return { dataProvider };
};

describe("rescheduleSalesCall", () => {
  it("returns not-found for a nonexistent sales call", async () => {
    const { dataProvider } = buildFixtures();
    const result = await rescheduleSalesCall(dataProvider, {
      salesCallId: 999,
      newScheduledAt: "2026-09-05T15:00:00.000Z",
    });
    expect(result.status).toBe("not-found");
  });

  it("refuses to reschedule a cancelled call", async () => {
    const { dataProvider } = buildFixtures({
      status: "cancelled",
      cancelled_at: "2026-08-01T00:00:00.000Z",
    });
    const result = await rescheduleSalesCall(dataProvider, {
      salesCallId: SALES_CALL_ID,
      newScheduledAt: "2026-09-05T15:00:00.000Z",
    });
    expect(result.status).toBe("cancelled-call");
  });

  it("is idempotent when the 'new' time matches what's already recorded", async () => {
    const { dataProvider } = buildFixtures();
    const result = await rescheduleSalesCall(dataProvider, {
      salesCallId: SALES_CALL_ID,
      newScheduledAt: "2026-09-01T15:00:00.000Z",
    });
    expect(result.status).toBe("already-current");

    const { data: salesCall } = await dataProvider.getOne<SalesCall>(
      "sales_calls",
      { id: SALES_CALL_ID },
    );
    expect(salesCall.reschedule_count).toBe(0);
  });
});
