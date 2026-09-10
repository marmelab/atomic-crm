import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Deal, Offer, SalesCall, SalesCallEvent, Task } from "../types";
import { bookSalesCall } from "./bookSalesCall";
import {
  attachSalesCallToOpportunity,
  createOpportunityAndAttachSalesCall,
  dismissSalesCall,
} from "./resolveUnmatchedSalesCall";

// Unmatched Sales Call Resolution slice: the three human decisions the
// dedicated resolution page offers. Real disposable fixtures only —
// mirrors this app's own Contact/Offer/Deal fixture conventions
// (bookSalesCall.test.ts), never Porsche Brown or Sarah Henke.
const CONTACT_ID = 1;
const LE_OFFER_ID = 1;
const GYU_OFFER_ID = 2;
const APPOINTMENT_TYPE_ID = "999888";

const leOffer: Offer = {
  id: LE_OFFER_ID,
  name: "The Living Example",
  type: "individual",
  duration: "6 months",
  current_price: 4000,
  is_active: true,
  acuity_appointment_type_id: APPOINTMENT_TYPE_ID,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const gyuOffer: Offer = {
  id: GYU_OFFER_ID,
  name: "Growing Yourself Up",
  type: "group",
  duration: "8 weeks",
  current_price: 1400,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const buildSalesCall = (overrides: Partial<SalesCall> = {}): SalesCall => ({
  id: 1,
  opportunity_id: null,
  contact_id: CONTACT_ID,
  status: "booked",
  original_scheduled_at: "2026-09-10T18:00:00.000Z",
  scheduled_at: "2026-09-10T18:00:00.000Z",
  reschedule_count: 0,
  source: "acuity",
  acuity_appointment_id: "acuity-1",
  acuity_appointment_type_id: APPOINTMENT_TYPE_ID,
  dismissed_at: null,
  dismissal_reason: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildDeal = (overrides: Partial<Deal> = {}): Deal => ({
  pricing_mode: "standard",
  id: 10,
  name: "Ada Lovelace — The Living Example",
  contact_id: CONTACT_ID,
  offer_id: LE_OFFER_ID,
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

const buildPendingResolveTask = (overrides: Partial<Task> = {}): Task => ({
  id: 1,
  contact_id: CONTACT_ID,
  type: "resolve_sales_call",
  text: "Ada Lovelace · The Living Example · Sep 10, 2026, 6:00 PM",
  due_date: "2026-01-01T00:00:00.000Z",
  status: "pending",
  sales_call_id: 1,
  ...overrides,
});

const buildFixtures = ({
  salesCall,
  deals = [],
  offers = [leOffer, gyuOffer],
  tasks = [buildPendingResolveTask()],
}: {
  salesCall: SalesCall;
  deals?: Deal[];
  offers?: Offer[];
  tasks?: Task[];
}) =>
  createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({
          id: CONTACT_ID,
          first_name: "Ada",
          last_name: "Lovelace",
        }),
      ],
      offers,
      cohorts: [],
      deals,
      sales_calls: [salesCall],
      sales_call_events: [],
      tasks,
    } as any),
    silent: true,
    latency: 0,
  });

describe("attachSalesCallToOpportunity", () => {
  it("attaches to a compatible existing Opportunity, advances Approved -> Call Booked, and resolves the alert", async () => {
    const dataProvider = buildFixtures({
      salesCall: buildSalesCall(),
      deals: [buildDeal({ stage: "approved" })],
    });

    const result = await attachSalesCallToOpportunity(dataProvider, {
      salesCallId: 1,
      opportunityId: 10,
    });
    expect(result).toEqual({ applied: true });

    const { data: salesCall } = await dataProvider.getOne<SalesCall>(
      "sales_calls",
      { id: 1 },
    );
    expect(salesCall.opportunity_id).toBe(10);

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: 10,
    });
    expect(deal.stage).toBe("call_booked");

    const { data: events } = await dataProvider.getList<SalesCallEvent>(
      "sales_call_events",
      {
        filter: { sales_call_id: 1 },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(events.some((e) => e.kind === "opportunity_attached")).toBe(true);

    const { data: tasks } = await dataProvider.getList<Task>("tasks", {
      filter: { contact_id: CONTACT_ID },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    const resolveTask = tasks.find((t) => t.type === "resolve_sales_call");
    expect(resolveTask?.done_date).toBeTruthy();
    expect(tasks.some((t) => t.type === "sales_call")).toBe(true);
  });

  it("rejects an incompatible Opportunity (wrong Offer) rather than attaching across offers", async () => {
    const dataProvider = buildFixtures({
      salesCall: buildSalesCall(),
      deals: [buildDeal({ id: 11, offer_id: GYU_OFFER_ID, stage: "approved" })],
    });

    const result = await attachSalesCallToOpportunity(dataProvider, {
      salesCallId: 1,
      opportunityId: 11,
    });
    expect(result).toEqual({
      applied: false,
      reason: "incompatible-opportunity",
    });

    const { data: salesCall } = await dataProvider.getOne<SalesCall>(
      "sales_calls",
      { id: 1 },
    );
    expect(salesCall.opportunity_id).toBeNull();
  });

  it("is idempotent — attaching an already-resolved sales_call is a safe no-op", async () => {
    const dataProvider = buildFixtures({
      salesCall: buildSalesCall({ opportunity_id: 10 }),
      deals: [buildDeal({ stage: "call_booked" })],
    });

    const result = await attachSalesCallToOpportunity(dataProvider, {
      salesCallId: 1,
      opportunityId: 10,
    });
    expect(result).toEqual({ applied: false, reason: "already-resolved" });
  });

  it("a duplicate Acuity webhook replay after a real match never recreates the alert or duplicates anything", async () => {
    const dataProvider = buildFixtures({
      salesCall: buildSalesCall(),
      deals: [buildDeal({ stage: "approved" })],
    });
    await attachSalesCallToOpportunity(dataProvider, {
      salesCallId: 1,
      opportunityId: 10,
    });

    const replay = await bookSalesCall({
      dataProvider,
      contactId: CONTACT_ID,
      contactName: "Ada Lovelace",
      opportunityId: null,
      scheduledAt: "2026-09-10T18:00:00.000Z",
      source: "acuity",
      acuityAppointmentId: "acuity-1",
      acuityAppointmentTypeId: APPOINTMENT_TYPE_ID,
    });
    expect(replay.status).toBe("already-booked");

    const { data: salesCall } = await dataProvider.getOne<SalesCall>(
      "sales_calls",
      { id: 1 },
    );
    expect(salesCall.opportunity_id).toBe(10);

    const { total: dealsTotal } = await dataProvider.getList<Deal>("deals", {
      filter: { contact_id: CONTACT_ID },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(dealsTotal).toBe(1);

    const { data: tasks } = await dataProvider.getList<Task>("tasks", {
      filter: { contact_id: CONTACT_ID, type: "resolve_sales_call" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].done_date).toBeTruthy();
  });
});

describe("createOpportunityAndAttachSalesCall", () => {
  it("creates exactly the mapped Offer's Opportunity, attaches the EXISTING sales_call, and resolves the alert", async () => {
    const dataProvider = buildFixtures({ salesCall: buildSalesCall() });

    const result = await createOpportunityAndAttachSalesCall(dataProvider, {
      salesCallId: 1,
    });
    expect(result).toEqual({ applied: true });

    const { total: dealsTotal, data: deals } = await dataProvider.getList<Deal>(
      "deals",
      {
        filter: { contact_id: CONTACT_ID },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(dealsTotal).toBe(1);
    expect(deals[0].offer_id).toBe(LE_OFFER_ID);
    expect(deals[0].stage).toBe("call_booked");

    const { data: salesCall } = await dataProvider.getOne<SalesCall>(
      "sales_calls",
      { id: 1 },
    );
    expect(salesCall.opportunity_id).toBe(deals[0].id);
  });

  it("never creates a second Opportunity on a double-click/retry", async () => {
    const dataProvider = buildFixtures({ salesCall: buildSalesCall() });

    await createOpportunityAndAttachSalesCall(dataProvider, { salesCallId: 1 });
    const second = await createOpportunityAndAttachSalesCall(dataProvider, {
      salesCallId: 1,
    });

    expect(second).toEqual({ applied: false, reason: "already-resolved" });
    const { total } = await dataProvider.getList<Deal>("deals", {
      filter: { contact_id: CONTACT_ID },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(1);
  });
});

describe("dismissSalesCall", () => {
  it("dismisses with a reason — preserves the sales_call, never creates an Opportunity, resolves the alert", async () => {
    const dataProvider = buildFixtures({ salesCall: buildSalesCall() });

    const result = await dismissSalesCall(dataProvider, {
      salesCallId: 1,
      reason: "Test booking",
    });
    expect(result).toEqual({ applied: true });

    const { data: salesCall } = await dataProvider.getOne<SalesCall>(
      "sales_calls",
      { id: 1 },
    );
    expect(salesCall.opportunity_id).toBeNull();
    expect(salesCall.dismissed_at).toBeTruthy();
    expect(salesCall.dismissal_reason).toBe("Test booking");

    const { total: dealsTotal } = await dataProvider.getList<Deal>("deals", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(dealsTotal).toBe(0);

    const { data: events } = await dataProvider.getList<SalesCallEvent>(
      "sales_call_events",
      {
        filter: { sales_call_id: 1 },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(events.some((e) => e.kind === "dismissed")).toBe(true);
  });

  it("a duplicate Acuity webhook replay after dismissal never recreates the alert", async () => {
    const dataProvider = buildFixtures({ salesCall: buildSalesCall() });
    await dismissSalesCall(dataProvider, { salesCallId: 1, reason: null });

    // The exact same real-infrastructure replay guard bookSalesCall.ts
    // already proved (acuity_appointment_id dedup) — never re-runs the
    // unmatched-branch logic for a booking it's already recorded,
    // dismissed or not.
    const replay = await bookSalesCall({
      dataProvider,
      contactId: CONTACT_ID,
      contactName: "Ada Lovelace",
      opportunityId: null,
      scheduledAt: "2026-09-10T18:00:00.000Z",
      source: "acuity",
      acuityAppointmentId: "acuity-1",
      acuityAppointmentTypeId: APPOINTMENT_TYPE_ID,
    });
    expect(replay.status).toBe("already-booked");

    const { data: salesCall } = await dataProvider.getOne<SalesCall>(
      "sales_calls",
      { id: 1 },
    );
    expect(salesCall.dismissed_at).toBeTruthy();
    // The alert stays resolved (done_date set by the dismissal itself,
    // before the replay ever reached this code) — the replay creates
    // nothing new, never a second/reopened resolve_sales_call Task.
    const { data: tasks } = await dataProvider.getList<Task>("tasks", {
      filter: { contact_id: CONTACT_ID, type: "resolve_sales_call" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].done_date).toBeTruthy();
  });
});
