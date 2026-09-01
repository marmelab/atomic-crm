import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Deal, DealStageEvent, Offer } from "../types";

// Kanban queue-ordering slice: exercises the centralized "deals" resource
// hooks in providers/fakerest/dataProvider.ts (the FakeRest mirror of
// set_deal_stage_entered_at()/record_deal_stage_event()) through
// dataProvider.update("deals", ...) — the exact call shape every real
// stage-changing pathway uses (Application review, sales-call booking/
// outcomes, Kanban drag/drop), so these tests cover all of them at once
// rather than re-testing each caller's own file.
const OFFER_ID = 1;
const CONTACT_ID = 1;
const DEAL_ID = 1;

const livingExample: Offer = {
  id: OFFER_ID,
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

const buildDeal = (overrides: Partial<Deal> = {}): Deal => ({
  id: DEAL_ID,
  name: "Ada Lovelace — The Living Example",
  contact_id: CONTACT_ID,
  offer_id: OFFER_ID,
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

// Every deal a real caller ever updates already has at least one history
// row behind it — either from its own real dataProvider.create() call, or
// (for older/fixture rows) the same one-row backfill the deploy-time
// migration and the data generator both seed. Mirroring that here is what
// makes "an unrelated edit appends nothing new" a meaningful assertion,
// rather than conflating it with "there was no history to begin with".
const buildInitialEvent = (deal: Deal): DealStageEvent => ({
  id: 0,
  opportunity_id: deal.id,
  stage: deal.stage,
  entered_at: deal.stage_entered_at,
  created_at: deal.stage_entered_at,
});

const buildFixtures = (
  deals: Deal[],
  dealStageEvents: DealStageEvent[],
  extraOffers: Offer[] = [],
) => {
  const contact = buildContact({ id: CONTACT_ID });
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [contact],
      offers: [livingExample, ...extraOffers],
      deals,
      deal_stage_events: dealStageEvents,
      offer_payment_options: [],
      cohorts: [],
      applications: [],
      enrollments: [],
    }),
    silent: true,
  });
  return { dataProvider };
};

const listEvents = (dataProvider: ReturnType<typeof createDataProvider>) =>
  dataProvider
    .getList<DealStageEvent>("deal_stage_events", {
      filter: { opportunity_id: DEAL_ID },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "entered_at", order: "ASC" },
    })
    .then((result) => result.data);

describe("deal stage-entry tracking (centralized 'deals' hooks)", () => {
  it("creating a deal stamps stage_entered_at and records a matching deal_stage_events row", async () => {
    const { dataProvider } = buildFixtures([], []);
    const before = new Date().toISOString();

    const { data: created } = await dataProvider.create<Deal>("deals", {
      data: {
        name: "Grace Hopper — The Living Example",
        contact_id: CONTACT_ID,
        offer_id: OFFER_ID,
        stage: "interested",
        amount: 4000,
        sales_id: 0,
        index: 0,
      },
    });

    expect(created.stage_entered_at >= before).toBe(true);

    const { data: events } = await dataProvider.getList<DealStageEvent>(
      "deal_stage_events",
      {
        filter: { opportunity_id: created.id },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "entered_at", order: "ASC" },
      },
    );
    expect(events).toHaveLength(1);
    expect(events[0].stage).toBe("interested");
    expect(events[0].entered_at).toBe(created.stage_entered_at);
  });

  it("a genuine stage change moves stage_entered_at forward and appends a new history row (stage-change-to-bottom)", async () => {
    const deal = buildDeal({
      stage: "call_booked",
      stage_entered_at: "2026-01-01T00:00:00.000Z",
    });
    const { dataProvider } = buildFixtures([deal], [buildInitialEvent(deal)]);

    const { data: updated } = await dataProvider.update<Deal>("deals", {
      id: DEAL_ID,
      data: { stage: "decision" },
      previousData: deal,
    });

    expect(updated.stage_entered_at).not.toBe(deal.stage_entered_at);
    expect(new Date(updated.stage_entered_at).getTime()).toBeGreaterThan(
      new Date(deal.stage_entered_at).getTime(),
    );

    const events = await listEvents(dataProvider);
    expect(events.map((e) => e.stage)).toEqual(["call_booked", "decision"]);
  });

  it("an unrelated field edit never touches stage_entered_at or appends a history row", async () => {
    const deal = buildDeal({
      stage: "interested",
      stage_entered_at: "2026-01-01T00:00:00.000Z",
    });
    const { dataProvider } = buildFixtures([deal], [buildInitialEvent(deal)]);

    const { data: updated } = await dataProvider.update<Deal>("deals", {
      id: DEAL_ID,
      data: { description: "Updated background notes." },
      previousData: deal,
    });

    expect(updated.stage_entered_at).toBe(deal.stage_entered_at);

    const events = await listEvents(dataProvider);
    expect(events).toHaveLength(1); // only the pre-existing seeded row
  });

  it("saving a note on the Opportunity never touches stage_entered_at", async () => {
    const deal = buildDeal({
      stage: "interested",
      stage_entered_at: "2026-01-01T00:00:00.000Z",
    });
    const { dataProvider } = buildFixtures([deal], [buildInitialEvent(deal)]);

    await dataProvider.create("deal_notes", {
      data: {
        deal_id: DEAL_ID,
        text: "Had a great intro conversation.",
        date: "2026-02-01T00:00:00.000Z",
        sales_id: 0,
      },
    });

    const { data: unchanged } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(unchanged.stage_entered_at).toBe(deal.stage_entered_at);

    const events = await listEvents(dataProvider);
    expect(events).toHaveLength(1); // only the pre-existing seeded row
  });

  it("re-entering a stage later gets a fresh, later stage_entered_at (re-entry-new-position)", async () => {
    const deal = buildDeal({
      stage: "interested",
      stage_entered_at: "2026-01-01T00:00:00.000Z",
    });
    const { dataProvider } = buildFixtures([deal], [buildInitialEvent(deal)]);

    const { data: bumped } = await dataProvider.update<Deal>("deals", {
      id: DEAL_ID,
      data: { stage: "call_booked" },
      previousData: deal,
    });
    const { data: backToInterested } = await dataProvider.update<Deal>(
      "deals",
      {
        id: DEAL_ID,
        data: { stage: "interested" },
        previousData: bumped,
      },
    );

    // The re-entry's stage_entered_at is a fresh, later timestamp — not the
    // Opportunity's original one — so it sorts at the bottom of
    // "interested" again, not back where it started.
    expect(backToInterested.stage_entered_at).not.toBe(deal.stage_entered_at);
    expect(
      new Date(backToInterested.stage_entered_at).getTime(),
    ).toBeGreaterThan(new Date(bumped.stage_entered_at).getTime());

    const events = await listEvents(dataProvider);
    expect(events.map((e) => e.stage)).toEqual([
      "interested",
      "call_booked",
      "interested",
    ]);
  });

  it("applies the same rule to a Growing Yourself Up (group) Opportunity as a Living Example one", async () => {
    const gyuDeal = buildDeal({
      offer_id: gyuOffer.id,
      stage: "application_received",
      stage_entered_at: "2026-01-01T00:00:00.000Z",
    });
    const { dataProvider } = buildFixtures(
      [gyuDeal],
      [buildInitialEvent(gyuDeal)],
      [gyuOffer],
    );

    const { data: updated } = await dataProvider.update<Deal>("deals", {
      id: DEAL_ID,
      data: { stage: "decision" },
      previousData: gyuDeal,
    });

    expect(updated.stage_entered_at).not.toBe(gyuDeal.stage_entered_at);
    const events = await listEvents(dataProvider);
    expect(events.map((e) => e.stage)).toEqual([
      "application_received",
      "decision",
    ]);
  });
});
