import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Contact, Deal, Offer, SalesCall, Tag } from "../types";
import {
  GHOSTED_TAG_NAME,
  isAtDecision,
  recordOpportunityDecision,
} from "./recordOpportunityDecision";
import {
  isAwaitingBooking,
  resolveApprovedOpportunity,
} from "./resolveApprovedOpportunity";
import {
  describeSalesCallState,
  selectCurrentSalesCall,
} from "../sales-calls/selectCurrentSalesCall";

const CONTACT_ID = 1;

const offer: Offer = {
  id: 1,
  name: "The Living Example",
  type: "individual",
  duration: "6 months",
  current_price: 4000,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const buildDeal = (over: Partial<Deal> = {}): Deal =>
  ({
    pricing_mode: "standard",
    id: 10,
    name: "Ada Lovelace — The Living Example",
    contact_id: CONTACT_ID,
    offer_id: 1,
    stage: "decision",
    outcome: null,
    archived_at: null,
    owner_decision: null,
    prospect_decision: null,
    amount: 4000,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    sales_id: 0,
    index: 0,
    stage_entered_at: "2026-01-01T00:00:00.000Z",
    ...over,
  }) as Deal;

const makeProvider = (deals: Deal[], tags: Tag[] = []) =>
  createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({
          id: CONTACT_ID,
          first_name: "Ada",
          last_name: "Lovelace",
        }),
      ],
      offers: [offer],
      deals,
      tags,
      tasks: [],
    }),
    silent: true,
  });

const readDeal = async (
  dataProvider: ReturnType<typeof makeProvider>,
  id: number,
) => (await dataProvider.getOne<Deal>("deals", { id })).data;

describe("recording a decision", () => {
  it("yes is Won, and Won is not an exit", async () => {
    // Arrange
    const dataProvider = makeProvider([buildDeal()]);

    // Act
    const result = await recordOpportunityDecision(dataProvider, {
      opportunityId: 10,
      decision: "won",
    });

    // Assert — this used to write stage 'onboarding' on the reasoning that
    // Won meant payment had arrived. Payment never gates Won: the sale
    // succeeding and the money arriving are different dimensions, and
    // persisting 'onboarding' made another of the fourteen legacy rows
    // nobody can interpret.
    expect(result.status).toBe("recorded");
    const deal = await readDeal(dataProvider, 10);
    expect(deal.stage).toBe("won");
    expect(deal.stage).not.toBe("onboarding");
    // Winning is not exiting.
    expect(deal.outcome).toBeNull();
    expect(deal.prospect_decision).toBe("yes");
  });

  it("declined exits the pipeline without tagging the person", async () => {
    const dataProvider = makeProvider([buildDeal()]);
    await recordOpportunityDecision(dataProvider, {
      opportunityId: 10,
      decision: "declined",
    });

    const deal = await readDeal(dataProvider, 10);
    expect(deal.outcome).toBe("lost");
    expect(deal.prospect_decision).toBe("no");
    // Saying no is a normal answer, not a behavioural pattern to carry
    // forward onto the Contact.
    const { data: tags } = await dataProvider.getList<Tag>("tags", {
      filter: {},
      pagination: { page: 1, perPage: 50 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tags.find((t) => t.name === GHOSTED_TAG_NAME)).toBeUndefined();
  });

  it("ghosted exits the pipeline and tags the Contact, distinctly from declining", async () => {
    const dataProvider = makeProvider([buildDeal()]);
    await recordOpportunityDecision(dataProvider, {
      opportunityId: 10,
      decision: "ghosted",
    });

    const deal = await readDeal(dataProvider, 10);
    expect(deal.outcome).toBe("lost");
    // The difference that matters: they did not say no, they said nothing.
    expect(deal.prospect_decision).toBe("ghosted");

    const { data: contact } = await dataProvider.getOne<Contact>("contacts", {
      id: CONTACT_ID,
    });
    const { data: tags } = await dataProvider.getList<Tag>("tags", {
      filter: {},
      pagination: { page: 1, perPage: 50 },
      sort: { field: "id", order: "ASC" },
    });
    const ghosted = tags.find((t) => t.name === GHOSTED_TAG_NAME);
    expect(ghosted).toBeDefined();
    expect(contact.tags?.map(String)).toContain(String(ghosted!.id));
  });

  it("applies the Ghosted tag once, however many times it is recorded", async () => {
    const dataProvider = makeProvider([buildDeal(), buildDeal({ id: 11 })]);
    await recordOpportunityDecision(dataProvider, {
      opportunityId: 10,
      decision: "ghosted",
    });
    await recordOpportunityDecision(dataProvider, {
      opportunityId: 11,
      decision: "ghosted",
    });

    const { data: tags } = await dataProvider.getList<Tag>("tags", {
      filter: {},
      pagination: { page: 1, perPage: 50 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tags.filter((t) => t.name === GHOSTED_TAG_NAME)).toHaveLength(1);

    const { data: contact } = await dataProvider.getOne<Contact>("contacts", {
      id: CONTACT_ID,
    });
    const ghostedId = String(tags.find((t) => t.name === GHOSTED_TAG_NAME)!.id);
    expect(
      contact.tags?.map(String).filter((t) => t === ghostedId),
    ).toHaveLength(1);
  });

  it("refuses to re-decide an Opportunity that already left the pipeline", async () => {
    const dataProvider = makeProvider([buildDeal({ outcome: "lost" })]);
    const result = await recordOpportunityDecision(dataProvider, {
      opportunityId: 10,
      decision: "won",
    });

    expect(result.status).toBe("already-resolved");
    const deal = await readDeal(dataProvider, 10);
    expect(deal.stage).toBe("decision");
    expect(deal.outcome).toBe("lost");
  });

  it("drops the person out of People Deciding once a decision is recorded", async () => {
    const dataProvider = makeProvider([buildDeal()]);
    expect(isAtDecision(await readDeal(dataProvider, 10))).toBe(true);

    await recordOpportunityDecision(dataProvider, {
      opportunityId: 10,
      decision: "ghosted",
    });

    expect(isAtDecision(await readDeal(dataProvider, 10))).toBe(false);
  });
});

describe("resolving an Approved Opportunity", () => {
  const approved = () => buildDeal({ stage: "approved" });

  it("keeping it Approved changes nothing at all", async () => {
    const dataProvider = makeProvider([approved()]);
    const before = await readDeal(dataProvider, 10);

    const result = await resolveApprovedOpportunity(dataProvider, {
      opportunityId: 10,
      resolution: "await-booking",
    });

    expect(result.status).toBe("unchanged");
    const after = await readDeal(dataProvider, 10);
    expect(after.stage).toBe("approved");
    expect(after.outcome).toBeNull();
    // Not even a timestamp invented to look like something happened.
    expect(after.stage_entered_at).toBe(before.stage_entered_at);
    expect(isAwaitingBooking(after)).toBe(true);
  });

  it("nurture and lost both exit the pipeline, to different meanings", async () => {
    const nurtureProvider = makeProvider([approved()]);
    await resolveApprovedOpportunity(nurtureProvider, {
      opportunityId: 10,
      resolution: "nurture",
    });
    expect((await readDeal(nurtureProvider, 10)).outcome).toBe("nurture");

    const lostProvider = makeProvider([approved()]);
    await resolveApprovedOpportunity(lostProvider, {
      opportunityId: 10,
      resolution: "lost",
    });
    expect((await readDeal(lostProvider, 10)).outcome).toBe("lost");
  });

  it("leaves the stage alone so the history stays true", async () => {
    const dataProvider = makeProvider([approved()]);
    await resolveApprovedOpportunity(dataProvider, {
      opportunityId: 10,
      resolution: "lost",
    });
    // They really did reach Approved; marking an exit must not rewrite that.
    expect((await readDeal(dataProvider, 10)).stage).toBe("approved");
  });
});

// Mihaela Petrova's exact production shape, which is why this selector
// exists: the July no-show was RECORDED after the September booking, so
// the higher id belongs to the earlier call.
describe("which sales call is the current one", () => {
  const call = (over: Partial<SalesCall>): SalesCall =>
    ({
      id: 1,
      opportunity_id: 10,
      contact_id: CONTACT_ID,
      status: "completed",
      attendance: null,
      scheduled_on: "2026-01-01",
      scheduled_at: "2026-01-01T12:00:00.000Z",
      original_scheduled_at: "2026-01-01T12:00:00.000Z",
      schedule_precision: "exact",
      reschedule_count: 0,
      source: "acuity",
      dismissed_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      ...over,
    }) as SalesCall;

  const julyNoShow = call({
    id: 141,
    scheduled_on: "2026-07-28",
    scheduled_at: "2026-07-28T12:00:00.000Z",
    attendance: "no_show",
  });
  const septemberCancelled = call({
    id: 140,
    scheduled_on: "2026-09-18",
    scheduled_at: "2026-09-18T12:00:00.000Z",
    status: "cancelled",
  });

  it("picks the most recent call, not the most recently recorded one", () => {
    const { current, history } = selectCurrentSalesCall([
      julyNoShow,
      septemberCancelled,
    ]);

    expect(current?.id).toBe(140);
    expect(describeSalesCallState(current!)).toBe("Cancelled");
    expect(history.map((c) => c.id)).toEqual([141]);
    expect(describeSalesCallState(history[0])).toBe("No-show");
  });

  it("a still-booked call outranks anything already concluded", () => {
    const rebooked = call({
      id: 5,
      scheduled_on: "2026-10-02",
      scheduled_at: "2026-10-02T12:00:00.000Z",
      status: "booked",
    });
    const { current } = selectCurrentSalesCall([
      septemberCancelled,
      julyNoShow,
      rebooked,
    ]);

    expect(current?.id).toBe(5);
    expect(describeSalesCallState(current!)).toBe("Booked");
  });

  it("never surfaces the oldest call just because it was attached first", () => {
    const { current } = selectCurrentSalesCall([
      julyNoShow,
      septemberCancelled,
    ]);
    expect(current?.scheduled_on).not.toBe("2026-07-28");
  });

  it("reports no call rather than guessing when there are none", () => {
    expect(selectCurrentSalesCall([])).toEqual({ current: null, history: [] });
    expect(selectCurrentSalesCall(undefined)).toEqual({
      current: null,
      history: [],
    });
  });
});
