import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Deal, Offer, SalesCall } from "../types";
import { bookSalesCall } from "./bookSalesCall";
import { cancelSalesCall } from "./cancelSalesCall";
import { recordSalesCallNoShow } from "./recordSalesCallNoShow";
import { needsNextSalesStep } from "../deals/needsNextSalesStep";
import { removeFromPipeline } from "../deals/removeFromPipeline";

// Once a sale has reached Call Booked, a missed meeting does not put it
// back.
//
// Both call-resolution paths used to write the stage back to `approved`,
// reasoning that Call Booked asserts a call in the calendar. Acceptance
// testing retired that: `approved` means "qualified, waiting to book",
// which is where somebody is BEFORE they ever agreed to meet, so writing
// it moved people backwards on a fact that says nothing about how far the
// sale got. Four real Opportunities were found sitting there.
//
// What the card needs to show is still shown — the cancellation, the
// no-show, and the open question about what happens next — but from the
// call facts, never by demoting the Opportunity.

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

const buildDeal = (over: Partial<Deal> = {}): Deal =>
  ({
    id: DEAL_ID,
    name: "Zz Probe — Growing Yourself Up",
    contact_id: CONTACT_ID,
    offer_id: OFFER_ID,
    stage: "call_booked",
    outcome: null,
    owner_decision: null,
    prospect_decision: null,
    archived_at: null,
    amount: 1400,
    sales_id: 0,
    index: 0,
    pricing_mode: "standard",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    stage_entered_at: "2026-01-01T00:00:00.000Z",
    ...over,
  }) as Deal;

const buildFixtures = (over: Partial<Deal> = {}) =>
  createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: CONTACT_ID, first_name: "Zz", last_name: "Probe" }),
      ],
      offers: [buildOffer()],
      deals: [buildDeal(over)],
      tasks: [],
    }),
    silent: true,
    latency: 0,
  });

const book = async (
  dataProvider: ReturnType<typeof createDataProvider>,
  acuityId: string,
  scheduledAt = "2026-09-10T15:00:00.000Z",
) => {
  const booked = await bookSalesCall({
    dataProvider,
    contactId: CONTACT_ID,
    contactName: "Zz Probe",
    opportunityId: DEAL_ID,
    scheduledAt,
    source: "acuity",
    acuityAppointmentId: acuityId,
    acuityAppointmentTypeId: "64654501",
  });
  return (booked as { salesCall: SalesCall }).salesCall.id;
};

const readDeal = async (
  dataProvider: ReturnType<typeof createDataProvider>,
): Promise<Deal> => {
  const { data } = await dataProvider.getOne<Deal>("deals", { id: DEAL_ID });
  return data;
};

const readCalls = async (
  dataProvider: ReturnType<typeof createDataProvider>,
): Promise<SalesCall[]> => {
  const { data } = await dataProvider.getList<SalesCall>("sales_calls", {
    filter: { opportunity_id: DEAL_ID },
    pagination: { page: 1, perPage: 50 },
    sort: { field: "id", order: "ASC" },
  });
  return data;
};

describe("a missed call never moves the Opportunity backwards", () => {
  it("a no-show leaves it in Call Booked", async () => {
    // Arrange
    const dataProvider = buildFixtures();
    const callId = await book(dataProvider, "acuity-noshow-stays");

    // Act
    await recordSalesCallNoShow(dataProvider, callId);

    // Assert
    const deal = await readDeal(dataProvider);
    expect(deal.stage).toBe("call_booked");
    expect(deal.outcome ?? null).toBeNull();
    expect(deal.prospect_decision ?? null).toBeNull();
  });

  it("a cancellation leaves it in Call Booked", async () => {
    const dataProvider = buildFixtures();
    const callId = await book(dataProvider, "acuity-cancel-stays");

    await cancelSalesCall(dataProvider, callId);

    const deal = await readDeal(dataProvider);
    expect(deal.stage).toBe("call_booked");
    expect(deal.outcome ?? null).toBeNull();
  });

  it("the call keeps the fact, which is what the badge reads", async () => {
    const dataProvider = buildFixtures();
    const noShowId = await book(dataProvider, "acuity-badge-noshow");
    await recordSalesCallNoShow(dataProvider, noShowId);

    const [call] = await readCalls(dataProvider);
    expect(call.attendance).toBe("no_show");
    expect(call.status).toBe("completed");
    expect(call.attendance_recorded_at).toBeTruthy();
  });

  it("the open question is derived from the call, not from the stage", async () => {
    const dataProvider = buildFixtures();
    const callId = await book(dataProvider, "acuity-derived");
    await recordSalesCallNoShow(dataProvider, callId);

    const deal = await readDeal(dataProvider);
    const calls = await readCalls(dataProvider);

    // Still in call_booked, and still asking for a decision — the two are
    // independent, which is the whole point of deriving it.
    expect(deal.stage).toBe("call_booked");
    expect(needsNextSalesStep(deal, calls)).toBe("call_no_show");
  });

  it("rebooking resolves the question without anything having to be cleaned up", async () => {
    const dataProvider = buildFixtures();
    const firstId = await book(dataProvider, "acuity-rebook-1");
    await recordSalesCallNoShow(dataProvider, firstId);
    await book(dataProvider, "acuity-rebook-2", "2026-10-01T15:00:00.000Z");

    const deal = await readDeal(dataProvider);
    const calls = await readCalls(dataProvider);

    expect(deal.stage).toBe("call_booked");
    expect(needsNextSalesStep(deal, calls)).toBeNull();
    // The missed call is still history; the new one is the live booking.
    expect(calls.filter((c) => c.attendance === "no_show")).toHaveLength(1);
    expect(calls.filter((c) => c.status === "booked")).toHaveLength(1);
  });

  it("an explicit decision is what finally takes it off the board", async () => {
    const dataProvider = buildFixtures();
    const callId = await book(dataProvider, "acuity-explicit-exit");
    await recordSalesCallNoShow(dataProvider, callId);

    // Act — a human, not the missed call, ends it.
    const result = await removeFromPipeline(dataProvider, {
      opportunityId: DEAL_ID,
      reason: "ghosted",
      note: null,
    });

    expect(result.status).toBe("removed");
    const deal = await readDeal(dataProvider);
    expect(deal.outcome).toBe("lost");
    expect(deal.exit_reason).toBe("ghosted");
    // The stage still records how far the sale actually got.
    expect(deal.stage).toBe("call_booked");
    expect(needsNextSalesStep(deal, await readCalls(dataProvider))).toBeNull();
  });

  it("a Deal that had already moved on is not dragged anywhere either", async () => {
    const dataProvider = buildFixtures({ stage: "decision" });
    const callId = await book(dataProvider, "acuity-past-decision");

    await cancelSalesCall(dataProvider, callId);

    expect((await readDeal(dataProvider)).stage).toBe("decision");
  });
});
