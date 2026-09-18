import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Contact, Deal, DealNote, Enrollment, Offer, Tag } from "../types";
import { removeFromPipeline } from "./removeFromPipeline";
import { recordYes } from "./recordSalesDecision";
import { assessPaymentStatus } from "./paymentStatus";
import { canRemoveFromPipeline, PIPELINE_EXIT_REASONS } from "./pipelineExit";
import { GHOSTED_TAG_NAME } from "./recordOpportunityDecision";

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
    exit_reason: null,
    exit_note: null,
    amount: 4000,
    offer_price_snapshot: 4000,
    sales_id: 0,
    index: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    stage_entered_at: "2026-01-01T00:00:00.000Z",
    ...over,
  }) as Deal;

const makeProvider = (deals: Deal[], extra: Record<string, unknown[]> = {}) =>
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
      tasks: [],
      ...extra,
    }),
    silent: true,
  });

const readDeal = async (
  dataProvider: ReturnType<typeof makeProvider>,
  id = 10,
) => (await dataProvider.getOne<Deal>("deals", { id })).data;

describe("remove from pipeline", () => {
  it("is offered from every active stage, and never once it has ended", () => {
    for (const stage of [
      "interested",
      "application_received",
      "approved",
      "call_booked",
      "decision",
      "committed",
    ]) {
      expect(
        canRemoveFromPipeline({ stage, outcome: null, archived_at: null }),
      ).toBe(true);
    }
    expect(
      canRemoveFromPipeline({ stage: "won", outcome: null, archived_at: null }),
    ).toBe(false);
    expect(
      canRemoveFromPipeline({
        stage: "decision",
        outcome: "lost",
        archived_at: null,
      }),
    ).toBe(false);
  });

  it.each(PIPELINE_EXIT_REASONS.map((r) => [r.reason, r.outcome] as const))(
    "%s exits the pipeline with outcome %s",
    async (reason, outcome) => {
      const dataProvider = makeProvider([buildDeal()]);

      const result = await removeFromPipeline(dataProvider, {
        opportunityId: 10,
        reason,
        // Only "other" requires one, but supplying it always keeps this
        // table-driven.
        note: "because of a specific thing that happened",
      });

      expect(result.status).toBe("removed");
      const deal = await readDeal(dataProvider);
      expect(deal.outcome).toBe(outcome);
      expect(deal.exit_reason).toBe(reason);
      // The stage is never rewritten: they really did reach Decision.
      expect(deal.stage).toBe("decision");
    },
  );

  it("refuses Other without a note rather than recording a meaningless exit", async () => {
    const dataProvider = makeProvider([buildDeal()]);

    const result = await removeFromPipeline(dataProvider, {
      opportunityId: 10,
      reason: "other",
      note: "   ",
    });

    expect(result).toEqual({ status: "note-required" });
    const deal = await readDeal(dataProvider);
    expect(deal.outcome).toBeNull();
    expect(deal.exit_reason).toBeNull();
  });

  it("keeps the note on Other", async () => {
    const dataProvider = makeProvider([buildDeal()]);

    await removeFromPipeline(dataProvider, {
      opportunityId: 10,
      reason: "other",
      note: "moved country",
    });

    expect((await readDeal(dataProvider)).exit_note).toBe("moved country");
  });

  it("tags the Contact only for Ghosted, and only once", async () => {
    const dataProvider = makeProvider([buildDeal(), buildDeal({ id: 11 })]);

    await removeFromPipeline(dataProvider, {
      opportunityId: 10,
      reason: "ghosted",
    });
    await removeFromPipeline(dataProvider, {
      opportunityId: 11,
      reason: "ghosted",
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

  it("does not tag the Contact when they simply declined", async () => {
    const dataProvider = makeProvider([buildDeal()]);

    await removeFromPipeline(dataProvider, {
      opportunityId: 10,
      reason: "declined_offer",
    });

    const { data: tags } = await dataProvider.getList<Tag>("tags", {
      filter: {},
      pagination: { page: 1, perPage: 50 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tags.find((t) => t.name === GHOSTED_TAG_NAME)).toBeUndefined();
  });

  it("sets the standing do-not-engage gate on the Contact, not just the Deal", async () => {
    const dataProvider = makeProvider([buildDeal()]);

    await removeFromPipeline(dataProvider, {
      opportunityId: 10,
      reason: "do_not_engage",
    });

    const { data: contact } = await dataProvider.getOne<Contact>("contacts", {
      id: CONTACT_ID,
    });
    expect(contact.sales_eligibility).toBe("do_not_engage");
    expect((await readDeal(dataProvider)).owner_decision).toBe("do_not_engage");
  });

  it("deletes nothing — the Contact and the Opportunity both survive", async () => {
    const dataProvider = makeProvider([buildDeal()]);

    await removeFromPipeline(dataProvider, {
      opportunityId: 10,
      reason: "money",
    });

    const { data: contacts } = await dataProvider.getList<Contact>("contacts", {
      filter: {},
      pagination: { page: 1, perPage: 50 },
      sort: { field: "id", order: "ASC" },
    });
    expect(contacts).toHaveLength(1);
    expect(await readDeal(dataProvider)).toBeTruthy();
  });

  it("writes a readable history note", async () => {
    const dataProvider = makeProvider([buildDeal()]);

    await removeFromPipeline(dataProvider, {
      opportunityId: 10,
      reason: "timing",
    });

    const { data: notes } = await dataProvider.getList<DealNote>("deal_notes", {
      filter: { deal_id: 10 },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(notes[0].text).toContain("Removed from pipeline");
    expect(notes[0].text).toContain("Timing");
  });

  it("is a safe no-op the second time", async () => {
    const dataProvider = makeProvider([buildDeal()]);
    await removeFromPipeline(dataProvider, {
      opportunityId: 10,
      reason: "nurture",
    });

    const second = await removeFromPipeline(dataProvider, {
      opportunityId: 10,
      reason: "money",
    });

    expect(second).toEqual({ status: "already-resolved" });
    // The first reason stands; the second call changed nothing.
    expect((await readDeal(dataProvider)).exit_reason).toBe("nurture");
  });
});

// The correction that mattered: Won is a SALES fact. Four live clients
// were stuck at Committed with no Enrollment — one paid in full, another
// already onboarded — because Won had been gated on payment plumbing.
describe("recording Yes", () => {
  it("marks Won even when no payment exists at all", async () => {
    const dataProvider = makeProvider([buildDeal()]);

    const result = await recordYes(dataProvider, { opportunityId: 10 });

    expect(result).toEqual({ status: "won" });
    const deal = await readDeal(dataProvider);
    expect(deal.stage).toBe("won");
    expect(deal.prospect_decision).toBe("yes");
    // Payment is a separate dimension and was not touched.
    expect(deal.stripe_subscription_id ?? null).toBeNull();
  });

  it("creates exactly one Enrollment, and a second Yes creates no more", async () => {
    const dataProvider = makeProvider([buildDeal()]);

    await recordYes(dataProvider, { opportunityId: 10 });
    const first = await dataProvider.getList<Enrollment>("enrollments", {
      filter: { opportunity_id: 10 },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });

    await recordYes(dataProvider, { opportunityId: 10 });
    const second = await dataProvider.getList<Enrollment>("enrollments", {
      filter: { opportunity_id: 10 },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });

    expect(first.data).toHaveLength(1);
    expect(second.data).toHaveLength(1);
  });

  it("refuses to re-decide something that already left the pipeline", async () => {
    const dataProvider = makeProvider([buildDeal({ outcome: "lost" })]);

    expect(await recordYes(dataProvider, { opportunityId: 10 })).toEqual({
      status: "already-resolved",
    });
    expect((await readDeal(dataProvider)).stage).toBe("decision");
  });
});

describe("payment status is reported, never used as a gate", () => {
  it("names what is outstanding when nothing is linked", async () => {
    const dataProvider = makeProvider([buildDeal({ stage: "won" })]);

    const status = await assessPaymentStatus(dataProvider, 10);

    expect(status.hasArrangement).toBe(false);
    expect(status.missing.join(" ")).toContain("No Stripe subscription");
    expect(status.missing.join(" ")).toContain("No payment recorded");
  });

  it("reports a linked subscription as established", async () => {
    const dataProvider = makeProvider([
      buildDeal({ stage: "won", stripe_subscription_id: "sub_123" }),
    ]);

    const status = await assessPaymentStatus(dataProvider, 10);

    expect(status.hasArrangement).toBe(true);
    expect(status.established.join(" ")).toContain("subscription linked");
  });

  it("never reports a scheduled payment as paid", async () => {
    const dataProvider = makeProvider([buildDeal({ stage: "won" })], {
      deal_payment_schedule_items: [
        {
          id: 1,
          deal_id: 10,
          amount: 1000,
          sequence: 1,
          due_date: "2027-01-01",
          status: "scheduled",
          paid_on: null,
          source: "owner_stated",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const status = await assessPaymentStatus(dataProvider, 10);

    expect(status.established.join(" ")).toContain("scheduled");
    expect(status.established.join(" ")).not.toContain("paid");
    expect(status.missing.join(" ")).toContain("No payment recorded");
  });
});
