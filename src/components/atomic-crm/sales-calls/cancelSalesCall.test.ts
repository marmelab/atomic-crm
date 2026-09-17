import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Deal, Offer, SalesCall, Task } from "../types";
import { bookSalesCall } from "./bookSalesCall";
import { cancelSalesCall } from "./cancelSalesCall";

// Canonical cancellation, shared by the manual "Cancelled" choice in
// Complete Sales Call and by the Acuity webhook. What these mostly assert
// is what cancellation must NEVER do: claim an attendance, tag the Contact,
// decide a disposition, or leave Call Booked asserting a call that does not
// exist.
//
// This file previously encoded the opposite: the Opportunity stayed in Call
// Booked and a "stranded lead" task was created to compensate. That made
// Call Booked mean two different things, so Leif ruled it means exactly one
// — there is a genuine booked future call. Returning the Deal to Approved
// IS the needs-booking signal the stranding task stood in for, so the task
// is retired along with the old behaviour.

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
  const contact = buildContact({
    id: CONTACT_ID,
    first_name: "GYU",
    last_name: "Test Monkey",
  });

  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [contact],
      offers: [buildOffer()],
      deals: [buildDeal(dealOverrides)],
      tasks: [],
    }),
    silent: true,
    latency: 0,
  });

  return { dataProvider, deal: buildDeal(dealOverrides) };
};

const book = async (
  dataProvider: ReturnType<typeof createDataProvider>,
  acuityId: string,
  opportunityId: number | null = DEAL_ID,
  scheduledAt = "2026-09-10T15:00:00.000Z",
) => {
  const booked = await bookSalesCall({
    dataProvider,
    contactId: CONTACT_ID,
    contactName: "GYU Test Monkey",
    opportunityId,
    scheduledAt,
    source: "acuity",
    acuityAppointmentId: acuityId,
    acuityAppointmentTypeId: "64654501",
  });
  return (booked as { salesCall: SalesCall }).salesCall.id;
};

// The retired behaviour's task type. Asserted absent rather than deleted
// from the codebase, so a regression that reintroduces it fails loudly.
const fetchStrandingTasks = async (
  dataProvider: ReturnType<typeof createDataProvider>,
) => {
  const { data } = await dataProvider.getList<Task>("tasks", {
    filter: { contact_id: CONTACT_ID, type: "sales_call_cancelled" },
    pagination: { page: 1, perPage: 10 },
    sort: { field: "id", order: "ASC" },
  });
  return data;
};

describe("cancelSalesCall — canonical cancellation", () => {
  it("cancels the call, frees the Opportunity from Call Booked, and closes that call's task", async () => {
    const { dataProvider } = buildFixtures();
    const salesCallId = await book(dataProvider, "acuity-cancel-1");

    const result = await cancelSalesCall(dataProvider, salesCallId);
    expect(result.status).toBe("cancelled");

    const { data: call } = await dataProvider.getOne<SalesCall>("sales_calls", {
      id: salesCallId,
    });
    expect(call.status).toBe("cancelled");
    expect(call.cancelled_at).toBeTruthy();
    // When it WAS going to happen is part of the history.
    expect(call.original_scheduled_at).toBe("2026-09-10T15:00:00.000Z");
    // Nobody was there to attend or miss it.
    expect(call.attendance).toBeFalsy();

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    // Call Booked asserted a booked call; there is none.
    expect(deal.stage).toBe("approved");
    // But nothing was decided about pursuing them.
    expect(deal.outcome).toBeFalsy();

    // That call's task is cancelled, not completed — nobody did it.
    const { data: tasks } = await dataProvider.getList<Task>("tasks", {
      filter: { sales_call_id: salesCallId },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    for (const task of tasks) {
      expect(task.status).toBe("cancelled");
      expect(task.done_date).toBeFalsy();
    }

    // And no stranding task is invented to explain the stage.
    expect(await fetchStrandingTasks(dataProvider)).toHaveLength(0);
  });

  it("never attaches a No-show tag — cancelling is not failing to turn up", async () => {
    const { dataProvider } = buildFixtures();
    const salesCallId = await book(dataProvider, "acuity-cancel-tag");
    await cancelSalesCall(dataProvider, salesCallId);

    const { data: tags } = await dataProvider.getList("tags", {
      filter: {},
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    });
    const noShowTag = tags.find(
      (tag: { name?: string }) => tag.name?.toLowerCase() === "no-show",
    );
    const { data: contact } = await dataProvider.getOne("contacts", {
      id: CONTACT_ID,
    });
    if (noShowTag) {
      expect(contact.tags ?? []).not.toContain(noShowTag.id);
    }
  });

  it("is idempotent — a duplicate webhook adds no second event", async () => {
    const { dataProvider } = buildFixtures();
    const salesCallId = await book(dataProvider, "acuity-cancel-2");

    expect((await cancelSalesCall(dataProvider, salesCallId)).status).toBe(
      "cancelled",
    );
    expect((await cancelSalesCall(dataProvider, salesCallId)).status).toBe(
      "already-cancelled",
    );

    const { data: events } = await dataProvider.getList("sales_call_events", {
      filter: { sales_call_id: salesCallId, kind: "cancelled" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(events).toHaveLength(1);
  });

  it("leaves an Opportunity that already moved past Call Booked exactly where it is", async () => {
    const { dataProvider } = buildFixtures({ stage: "decision" });
    const salesCallId = await book(dataProvider, "acuity-cancel-3");
    await cancelSalesCall(dataProvider, salesCallId);

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    // Cancelling an old call must never drag a progressed Deal backwards.
    expect(deal.stage).toBe("decision");
  });

  it("does not touch any Opportunity when the booking was never matched to one", async () => {
    const { dataProvider } = buildFixtures();
    const salesCallId = await book(dataProvider, "acuity-cancel-4", null);

    const result = await cancelSalesCall(dataProvider, salesCallId);
    expect(result.status).toBe("cancelled");

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.stage).toBe("call_booked");
  });

  it("supports a genuine rebooking afterwards, without resurrecting the cancelled call", async () => {
    const { dataProvider } = buildFixtures();
    const firstId = await book(dataProvider, "acuity-rebook-1");
    await cancelSalesCall(dataProvider, firstId);

    const secondId = await book(
      dataProvider,
      "acuity-rebook-2",
      DEAL_ID,
      "2026-10-20T15:00:00.000Z",
    );
    expect(secondId).not.toBe(firstId);

    const { data: cancelled } = await dataProvider.getOne<SalesCall>(
      "sales_calls",
      { id: firstId },
    );
    expect(cancelled.status).toBe("cancelled");
    const { data: live } = await dataProvider.getOne<SalesCall>("sales_calls", {
      id: secondId,
    });
    expect(live.status).toBe("booked");
  });

  it("refuses to cancel a call that genuinely happened", async () => {
    const { dataProvider } = buildFixtures();
    const salesCallId = await book(dataProvider, "acuity-attended");
    const { data: call } = await dataProvider.getOne<SalesCall>("sales_calls", {
      id: salesCallId,
    });
    await dataProvider.update<SalesCall>("sales_calls", {
      id: salesCallId,
      data: { attendance: "attended", status: "completed" },
      previousData: call,
    });

    const result = await cancelSalesCall(dataProvider, salesCallId);
    expect(result.status).toBe("already-attended");
  });
});
