import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Deal, Offer, SalesCall, Task } from "../types";
import { bookSalesCall } from "./bookSalesCall";

// Logging a call that already happened.
//
// Dax Kara's Opportunity reached Call Booked before call tracking
// existed, so the CRM offered to record the call — and the click
// returned "Server communication error". The cause was a not-null column
// the payload never sent, fixed in the database (20260920020000); what
// these cover is the half above it: a call whose time has passed is not
// something to attend, it is something whose outcome nobody has stated,
// and the two must not be represented the same way.

const CONTACT_ID = 1;
const OFFER_ID = 2;
const DEAL_ID = 9;

const offer: Offer = {
  id: OFFER_ID,
  name: "The Living Example",
  type: "individual",
  duration: "6 months",
  current_price: 4000,
  is_active: true,
  acuity_appointment_type_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const buildDeal = (over: Partial<Deal> = {}): Deal =>
  ({
    id: DEAL_ID,
    name: "Zz Backfill — The Living Example",
    contact_id: CONTACT_ID,
    offer_id: OFFER_ID,
    // The shape the backfill prompt appears for: Call Booked, no call.
    stage: "call_booked",
    outcome: null,
    archived_at: null,
    prospect_decision: null,
    owner_decision: null,
    amount: 4000,
    sales_id: 0,
    index: 0,
    pricing_mode: "standard",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    stage_entered_at: "2026-07-01T00:00:00.000Z",
    ...over,
  }) as Deal;

const build = (over: Partial<Deal> = {}) =>
  createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({
          id: CONTACT_ID,
          first_name: "Zz",
          last_name: "Backfill",
        }),
      ],
      offers: [offer],
      deals: [buildDeal(over)],
      tasks: [],
    }),
    silent: true,
    latency: 0,
  });

// 2026-08-01 12:30 in America/Denver — the time Leif entered — is 18:30Z.
const PAST_CALL = "2026-08-01T18:30:00.000Z";
const FUTURE_CALL = new Date(Date.now() + 7 * 86400_000).toISOString();

const log = async (
  dataProvider: ReturnType<typeof createDataProvider>,
  scheduledAt: string,
) =>
  bookSalesCall({
    dataProvider,
    contactId: CONTACT_ID,
    contactName: "Zz Backfill",
    opportunityId: DEAL_ID,
    scheduledAt,
    source: "manual",
  });

const callsFor = async (
  dataProvider: ReturnType<typeof createDataProvider>,
): Promise<SalesCall[]> => {
  const { data } = await dataProvider.getList<SalesCall>("sales_calls", {
    filter: { opportunity_id: DEAL_ID },
    pagination: { page: 1, perPage: 50 },
    sort: { field: "id", order: "ASC" },
  });
  return data;
};

describe("a call that already happened", () => {
  it("is recorded once, against the right Opportunity, at the stated time", async () => {
    // Arrange
    const dataProvider = build();

    // Act
    const result = await log(dataProvider, PAST_CALL);

    // Assert
    expect(result.status).toBe("booked");
    const calls = await callsFor(dataProvider);
    expect(calls).toHaveLength(1);
    expect(calls[0].opportunity_id).toBe(DEAL_ID);
    expect(calls[0].contact_id).toBe(CONTACT_ID);
    expect(calls[0].source).toBe("manual");
    // The instant Leif typed, unshifted.
    expect(calls[0].scheduled_at).toBe(PAST_CALL);
    expect(calls[0].original_scheduled_at).toBe(PAST_CALL);
  });

  it("is marked as a question rather than a meeting to attend", async () => {
    const dataProvider = build();

    await log(dataProvider, PAST_CALL);

    const [call] = await callsFor(dataProvider);
    // resolution_requested_at is the canonical "nobody knows what
    // happened here", and it is what turns this into the single
    // "what happened on this call?" question.
    expect(call.resolution_requested_at).toBeTruthy();
    // Attendance is NOT invented: Leif said it happened, not how it went.
    expect(call.attendance ?? null).toBeNull();
  });

  it("invents no sales decision", async () => {
    const dataProvider = build();

    await log(dataProvider, PAST_CALL);

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.outcome ?? null).toBeNull();
    expect(deal.prospect_decision ?? null).toBeNull();
    expect(deal.owner_decision ?? null).toBeNull();
  });
});

describe("a call still to come", () => {
  it("keeps ordinary booked semantics", async () => {
    const dataProvider = build();

    await log(dataProvider, FUTURE_CALL);

    const [call] = await callsFor(dataProvider);
    expect(call.status).toBe("booked");
    // Nothing to resolve: it has not happened.
    expect(call.resolution_requested_at ?? null).toBeNull();
  });
});

describe("the stage this runs against", () => {
  it("does not move an Opportunity already at Call Booked", async () => {
    const dataProvider = build();

    await log(dataProvider, PAST_CALL);

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.stage).toBe("call_booked");
  });

  it("does not drag a later stage backwards", async () => {
    // A human decision that moved the sale on outranks a backfilled call.
    const dataProvider = build({ stage: "decision" });

    await log(dataProvider, PAST_CALL);

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.stage).toBe("decision");
  });

  it("advances Approved, which is the one transition it owns", async () => {
    const dataProvider = build({ stage: "approved" });

    await log(dataProvider, FUTURE_CALL);

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.stage).toBe("call_booked");
  });
});

describe("clicking it twice", () => {
  it("reuses the booking instead of creating a second call", async () => {
    // Arrange — the retry after an error, or a double click.
    const dataProvider = build();
    await log(dataProvider, PAST_CALL);

    // Act
    const second = await log(dataProvider, PAST_CALL);

    // Assert
    expect(second.status).toBe("reused-existing-booking");
    expect(await callsFor(dataProvider)).toHaveLength(1);
  });

  it("leaves the Opportunity with a call, so it stops being asked", async () => {
    // The prompt appears only while no call exists. Once one does, the
    // backfill invitation is gone.
    const dataProvider = build();
    await log(dataProvider, PAST_CALL);

    expect(await callsFor(dataProvider)).toHaveLength(1);
  });
});

describe("the work it leaves behind", () => {
  it("leaves no appointment task behind, however many times it runs", async () => {
    // The call is the record; the Task system is for work. What this call
    // genuinely leaves open is resolution_requested_at — "nobody has said
    // what happened here" — asserted above, and the one question the
    // reconciler turns into a row.
    const dataProvider = build();

    await log(dataProvider, PAST_CALL);
    await log(dataProvider, PAST_CALL);

    const { data: tasks } = await dataProvider.getList<Task>("tasks", {
      filter: { contact_id: CONTACT_ID, type: "sales_call" },
      pagination: { page: 1, perPage: 20 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tasks).toHaveLength(0);
  });

  it("leaves no appointment task behind for a future call either", async () => {
    const dataProvider = build();

    await log(dataProvider, FUTURE_CALL);

    const { data: tasks } = await dataProvider.getList<Task>("tasks", {
      filter: { contact_id: CONTACT_ID },
      pagination: { page: 1, perPage: 20 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tasks).toHaveLength(0);
  });
});
