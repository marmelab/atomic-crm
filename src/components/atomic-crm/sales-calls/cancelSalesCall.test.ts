import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Deal, Offer, SalesCall, Task } from "../types";
import { bookSalesCall } from "./bookSalesCall";
import { cancelSalesCall } from "./cancelSalesCall";

// GYU real-infrastructure slice, human-acceptance repair pass: cancelling
// the only booked call for an Opportunity still at Call Booked used to
// leave it silently stranded — correct data, but no task telling anyone a
// decision is needed. Found via a real cancellation against real
// infrastructure, not a fixture. See cancelSalesCall.ts's own
// ensureFollowUpIfStranded for the exact invariant this covers.

const CONTACT_ID = 1;
const OFFER_ID = 2;
const DEAL_ID = 9;

const buildOffer = (): Offer => ({
  id: OFFER_ID,
  name: "Growing Yourself Up",
  type: "group",
  duration: "8 weeks",
  current_price: 1400,
  is_active: true,
  acuity_appointment_type_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

const buildDeal = (overrides: Partial<Deal> = {}): Deal => ({
  pricing_mode: "standard",
  id: DEAL_ID,
  name: "GYU Test Monkey — Growing Yourself Up",
  contact_id: CONTACT_ID,
  offer_id: OFFER_ID,
  stage: "call_booked",
  outcome: null,
  owner_decision: null,
  amount: 1400,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  sales_id: 0,
  index: 0,
  stage_entered_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildFixtures = (dealOverrides: Partial<Deal> = {}) => {
  // The follow-up task's text reads the Contact's own stored name, not
  // whatever contactName a caller passed to bookSalesCall for the booking
  // task — matching that intentional real Contact identity here.
  const contact = buildContact({
    id: CONTACT_ID,
    first_name: "GYU",
    last_name: "Test Monkey",
  });
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

const fetchCancelledFollowUpTasks = async (
  dataProvider: ReturnType<typeof createDataProvider>,
) => {
  const { data } = await dataProvider.getList<Task>("tasks", {
    filter: { contact_id: CONTACT_ID, type: "sales_call_cancelled" },
    pagination: { page: 1, perPage: 10 },
    sort: { field: "id", order: "ASC" },
  });
  return data;
};

describe("cancelSalesCall — the stranded-Opportunity invariant", () => {
  it("cancelling the only booked call for a Call Booked Opportunity creates a Sales Call Cancelled task", async () => {
    const { dataProvider, deal } = buildFixtures();
    const booked = await bookSalesCall({
      dataProvider,
      contactId: CONTACT_ID,
      contactName: "GYU Test Monkey",
      opportunityId: deal.id,
      scheduledAt: "2026-09-10T15:00:00.000Z",
      source: "acuity",
      acuityAppointmentId: "acuity-cancel-1",
      acuityAppointmentTypeId: "64654501",
    });
    const salesCallId = (booked as { salesCall: SalesCall }).salesCall.id;

    const result = await cancelSalesCall(dataProvider, salesCallId);
    expect(result.status).toBe("cancelled");

    const { data: updatedDeal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    // Never regressed by cancellation — a human/business decision, not
    // something this invariant should guess.
    expect(updatedDeal.stage).toBe("call_booked");

    const followUpTasks = await fetchCancelledFollowUpTasks(dataProvider);
    expect(followUpTasks).toHaveLength(1);
    expect(followUpTasks[0].text).toContain("GYU Test Monkey");
    expect(followUpTasks[0].status).toBe("pending");
    expect(followUpTasks[0].done_date).toBeFalsy();
  });

  it("a duplicate cancellation webhook for the same call is a safe no-op — no duplicate follow-up task", async () => {
    const { dataProvider, deal } = buildFixtures();
    const booked = await bookSalesCall({
      dataProvider,
      contactId: CONTACT_ID,
      contactName: "GYU Test Monkey",
      opportunityId: deal.id,
      scheduledAt: "2026-09-10T15:00:00.000Z",
      source: "acuity",
      acuityAppointmentId: "acuity-cancel-dup",
      acuityAppointmentTypeId: "64654501",
    });
    const salesCallId = (booked as { salesCall: SalesCall }).salesCall.id;

    const first = await cancelSalesCall(dataProvider, salesCallId);
    const second = await cancelSalesCall(dataProvider, salesCallId);
    expect(first.status).toBe("cancelled");
    expect(second.status).toBe("already-cancelled");

    const followUpTasks = await fetchCancelledFollowUpTasks(dataProvider);
    expect(followUpTasks).toHaveLength(1);
  });

  it("does not create a follow-up task when the booking was never matched to an Opportunity", async () => {
    const { dataProvider } = buildFixtures();
    const booked = await bookSalesCall({
      dataProvider,
      contactId: CONTACT_ID,
      contactName: "GYU Test Monkey",
      opportunityId: null,
      scheduledAt: "2026-09-10T15:00:00.000Z",
      source: "acuity",
      acuityAppointmentId: "acuity-cancel-unmatched",
      acuityAppointmentTypeId: "64654501",
    });
    const salesCallId = (booked as { salesCall: SalesCall }).salesCall.id;

    await cancelSalesCall(dataProvider, salesCallId);

    const followUpTasks = await fetchCancelledFollowUpTasks(dataProvider);
    expect(followUpTasks).toHaveLength(0);
  });

  it("does not create a follow-up task when the Opportunity already moved past Call Booked", async () => {
    const { dataProvider, deal } = buildFixtures({ stage: "committed" });
    const booked = await bookSalesCall({
      dataProvider,
      contactId: CONTACT_ID,
      contactName: "GYU Test Monkey",
      opportunityId: deal.id,
      scheduledAt: "2026-09-10T15:00:00.000Z",
      source: "manual",
    });
    const salesCallId = (booked as { salesCall: SalesCall }).salesCall.id;

    await cancelSalesCall(dataProvider, salesCallId);

    const followUpTasks = await fetchCancelledFollowUpTasks(dataProvider);
    expect(followUpTasks).toHaveLength(0);
  });

  it("does not create a follow-up task when another currently-booked call already covers the Opportunity", async () => {
    // This exact state (two simultaneously "booked" sales_calls rows for
    // one Opportunity) is already impossible to reach through the app's
    // own write path — salesCallValidation.ts's own beforeCreate guard
    // (mirroring the real database's sales_calls_one_booked_per_
    // opportunity_idx partial unique index) refuses a second one. Seeded
    // directly at fixture-construction time, bypassing that guard on
    // purpose, so the defensive check inside cancelSalesCall.ts itself is
    // still proven correct on its own — not merely inherited for free from
    // a constraint elsewhere that a future migration could relax.
    const contact = buildContact({
      id: CONTACT_ID,
      first_name: "GYU",
      last_name: "Test Monkey",
    });
    const offer = buildOffer();
    const deal = buildDeal();
    const firstCall: SalesCall = {
      id: 501,
      opportunity_id: deal.id,
      contact_id: CONTACT_ID,
      status: "booked",
      original_scheduled_at: "2026-09-10T15:00:00.000Z",
      scheduled_at: "2026-09-10T15:00:00.000Z",
      reschedule_count: 0,
      source: "acuity",
      acuity_appointment_id: "acuity-cancel-multi-1",
      acuity_appointment_type_id: "64654501",
      created_at: "2026-09-10T15:00:00.000Z",
      updated_at: "2026-09-10T15:00:00.000Z",
    };
    const secondCall: SalesCall = {
      id: 502,
      opportunity_id: deal.id,
      contact_id: CONTACT_ID,
      status: "booked",
      original_scheduled_at: "2026-09-11T15:00:00.000Z",
      scheduled_at: "2026-09-11T15:00:00.000Z",
      reschedule_count: 0,
      source: "manual",
      created_at: "2026-09-11T15:00:00.000Z",
      updated_at: "2026-09-11T15:00:00.000Z",
    };

    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [contact],
        offers: [offer],
        deals: [deal],
        sales_calls: [firstCall, secondCall],
        tasks: [],
      }),
      silent: true,
      latency: 0,
    });

    await cancelSalesCall(dataProvider, firstCall.id);

    const followUpTasks = await fetchCancelledFollowUpTasks(dataProvider);
    expect(followUpTasks).toHaveLength(0);
  });

  it("a fresh booking after a stranding cancellation completes the follow-up task", async () => {
    const { dataProvider, deal } = buildFixtures();
    const booked = await bookSalesCall({
      dataProvider,
      contactId: CONTACT_ID,
      contactName: "GYU Test Monkey",
      opportunityId: deal.id,
      scheduledAt: "2026-09-10T15:00:00.000Z",
      source: "acuity",
      acuityAppointmentId: "acuity-cancel-rebook-1",
      acuityAppointmentTypeId: "64654501",
    });
    const salesCallId = (booked as { salesCall: SalesCall }).salesCall.id;
    await cancelSalesCall(dataProvider, salesCallId);
    expect(await fetchCancelledFollowUpTasks(dataProvider)).toHaveLength(1);

    await bookSalesCall({
      dataProvider,
      contactId: CONTACT_ID,
      contactName: "GYU Test Monkey",
      opportunityId: deal.id,
      scheduledAt: "2026-09-15T15:00:00.000Z",
      source: "acuity",
      acuityAppointmentId: "acuity-cancel-rebook-2",
      acuityAppointmentTypeId: "64654501",
    });

    const followUpTasks = await fetchCancelledFollowUpTasks(dataProvider);
    expect(followUpTasks).toHaveLength(1);
    expect(followUpTasks[0].status).toBe("completed");
    expect(followUpTasks[0].done_date).toBeTruthy();
  });
});
