import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Deal, Offer, SalesCall, Task } from "../types";
import { bookSalesCall } from "./bookSalesCall";

const CONTACT_ID = 1;
const OFFER_ID = 1;
const DEAL_ID = 1;

const buildOffer = (): Offer => ({
  id: OFFER_ID,
  name: "The Living Example",
  type: "individual",
  duration: "6 months",
  current_price: 4000,
  is_active: true,
  acuity_appointment_type_id: "12345",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

const buildDeal = (overrides: Partial<Deal> = {}): Deal => ({
  pricing_mode: "standard",
  id: DEAL_ID,
  name: "Ada Lovelace — The Living Example",
  contact_id: CONTACT_ID,
  offer_id: OFFER_ID,
  stage: "approved",
  outcome: null,
  owner_decision: null,
  amount: 4000,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  sales_id: 0,
  index: 0,
  stage_entered_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildFixtures = (dealOverrides: Partial<Deal> = {}) => {
  const contact = buildContact({ id: CONTACT_ID });
  const offer = buildOffer();
  const deal = buildDeal(dealOverrides);

  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [contact],
      offers: [offer],
      deals: [deal],
      tasks: [],
    }),
    silent: true,
    latency: 0,
  });

  return { dataProvider, deal };
};

describe("bookSalesCall", () => {
  it("books a call for a matched Opportunity: advances Approved -> Call Booked and creates a Sales Call task", async () => {
    const { dataProvider, deal } = buildFixtures();

    const result = await bookSalesCall({
      dataProvider,
      contactId: CONTACT_ID,
      contactName: "Ada Lovelace",
      opportunityId: deal.id,
      scheduledAt: "2026-09-10T15:00:00.000Z",
      source: "acuity",
      acuityAppointmentId: "acuity-1",
      acuityAppointmentTypeId: "12345",
    });
    expect(result.status).toBe("booked");

    const { data: updatedDeal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(updatedDeal.stage).toBe("call_booked");
    expect(updatedDeal.sales_call_at).toBe("2026-09-10T15:00:00.000Z");

    const { data: tasks } = await dataProvider.getList<Task>("tasks", {
      filter: { contact_id: CONTACT_ID, type: "sales_call" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].due_date).toBe("2026-09-10T15:00:00.000Z");
    expect(tasks[0].done_date).toBeFalsy();

    const { data: events } = await dataProvider.getList("sales_call_events", {
      filter: {
        sales_call_id: (result as { salesCall: SalesCall }).salesCall.id,
      },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("booked");
  });

  it("books a call with no matched Opportunity: preserves it unmatched and creates a Resolve Sales Call task instead", async () => {
    const { dataProvider } = buildFixtures();

    const result = await bookSalesCall({
      dataProvider,
      contactId: CONTACT_ID,
      contactName: "Ada Lovelace",
      opportunityId: null,
      scheduledAt: "2026-09-10T15:00:00.000Z",
      source: "acuity",
      acuityAppointmentId: "acuity-2",
      acuityAppointmentTypeId: "12345",
    });
    expect(result.status).toBe("booked");
    if (result.status === "booked") {
      expect(result.salesCall.opportunity_id).toBeNull();
    }

    const { data: resolveTasks } = await dataProvider.getList<Task>("tasks", {
      filter: { contact_id: CONTACT_ID, type: "resolve_sales_call" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(resolveTasks).toHaveLength(1);

    const { data: salesCallTasks } = await dataProvider.getList<Task>("tasks", {
      filter: { contact_id: CONTACT_ID, type: "sales_call" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(salesCallTasks).toHaveLength(0);
  });

  it("does not regress an Opportunity already past Approved", async () => {
    const { dataProvider, deal } = buildFixtures({ stage: "committed" });

    await bookSalesCall({
      dataProvider,
      contactId: CONTACT_ID,
      contactName: "Ada Lovelace",
      opportunityId: deal.id,
      scheduledAt: "2026-09-10T15:00:00.000Z",
      source: "manual",
    });

    const { data: updatedDeal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(updatedDeal.stage).toBe("committed");
  });

  it("a duplicate webhook delivery for the same Acuity appointment id is a safe no-op", async () => {
    const { dataProvider, deal } = buildFixtures();
    const input = {
      dataProvider,
      contactId: CONTACT_ID,
      contactName: "Ada Lovelace",
      opportunityId: deal.id,
      scheduledAt: "2026-09-10T15:00:00.000Z",
      source: "acuity" as const,
      acuityAppointmentId: "acuity-dup",
      acuityAppointmentTypeId: "12345",
    };

    const first = await bookSalesCall(input);
    const second = await bookSalesCall(input);
    expect(first.status).toBe("booked");
    expect(second.status).toBe("already-booked");

    const { total } = await dataProvider.getList("sales_calls", {
      filter: { acuity_appointment_id: "acuity-dup" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(1);

    const { data: tasks } = await dataProvider.getList<Task>("tasks", {
      filter: { contact_id: CONTACT_ID, type: "sales_call" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tasks).toHaveLength(1);
  });

  it("a second booking for an Opportunity that already has a booked call retargets it instead of duplicating", async () => {
    const { dataProvider, deal } = buildFixtures();

    await bookSalesCall({
      dataProvider,
      contactId: CONTACT_ID,
      contactName: "Ada Lovelace",
      opportunityId: deal.id,
      scheduledAt: "2026-09-10T15:00:00.000Z",
      source: "manual",
    });
    const second = await bookSalesCall({
      dataProvider,
      contactId: CONTACT_ID,
      contactName: "Ada Lovelace",
      opportunityId: deal.id,
      scheduledAt: "2026-09-12T15:00:00.000Z",
      source: "manual",
    });
    expect(second.status).toBe("reused-existing-booking");

    const { total } = await dataProvider.getList("sales_calls", {
      filter: { opportunity_id: DEAL_ID },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(1);

    const { data: updatedDeal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(updatedDeal.sales_call_at).toBe("2026-09-12T15:00:00.000Z");
  });
});
