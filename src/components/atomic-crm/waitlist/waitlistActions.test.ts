import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Deal, Offer, WaitlistEntry } from "../types";
import {
  convertToOpportunity,
  markInvited,
  removeFromWaitlist,
} from "./waitlistActions";

const CONTACT_ID = 1;
const OFFER_ID = 1;
const ENTRY_ID = 1;

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

const buildEntry = (overrides: Partial<WaitlistEntry> = {}): WaitlistEntry => ({
  id: ENTRY_ID,
  contact_id: CONTACT_ID,
  offer_id: OFFER_ID,
  cohort_id: null,
  status: "waiting",
  joined_at: "2026-01-01T00:00:00.000Z",
  desired_timing: null,
  notes: null,
  priority: null,
  source: null,
  invited_at: null,
  converted_at: null,
  converted_opportunity_id: null,
  removed_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildFixtures = (
  entryOverrides: Partial<WaitlistEntry> = {},
  extra: {
    deals?: Deal[];
    contactOverrides?: Parameters<typeof buildContact>[0];
  } = {},
) => {
  const contact = buildContact({ id: CONTACT_ID, ...extra.contactOverrides });
  const entry = buildEntry(entryOverrides);

  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [contact],
      offers: [livingExample],
      offer_payment_options: [],
      cohorts: [],
      deals: extra.deals ?? [],
      waitlist_entries: [entry],
    }),
    silent: true,
    latency: 0,
  });

  return { dataProvider, entry };
};

describe("markInvited", () => {
  it("waiting -> invited: sets invited_at, leaves the entry active", async () => {
    const { dataProvider } = buildFixtures({ status: "waiting" });

    const result = await markInvited(dataProvider, ENTRY_ID);
    expect(result).toEqual({ applied: true });

    const { data: updated } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: ENTRY_ID },
    );
    expect(updated.status).toBe("invited");
    expect(updated.invited_at).not.toBeNull();
  });

  it("does not create an Opportunity by itself", async () => {
    const { dataProvider } = buildFixtures({ status: "waiting" });

    await markInvited(dataProvider, ENTRY_ID);

    const { total } = await dataProvider.getList("deals", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(0);
  });

  it("is a no-op against an already-invited entry (re-fetches current state, never trusts a stale caller)", async () => {
    const { dataProvider } = buildFixtures({
      status: "invited",
      invited_at: "2026-01-05T00:00:00.000Z",
    });

    const result = await markInvited(dataProvider, ENTRY_ID);
    expect(result).toEqual({ applied: false, reason: "not-waiting" });

    const { data: entry } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: ENTRY_ID },
    );
    // The original invited_at stands — a second, stale call never rewrites it.
    expect(entry.invited_at).toBe("2026-01-05T00:00:00.000Z");
  });

  it("is a no-op against a converted or removed entry", async () => {
    const { dataProvider } = buildFixtures({ status: "converted" });
    const result = await markInvited(dataProvider, ENTRY_ID);
    expect(result).toEqual({ applied: false, reason: "not-waiting" });
  });
});

describe("removeFromWaitlist", () => {
  it("waiting -> removed: sets removed_at, preserves the row", async () => {
    const { dataProvider } = buildFixtures({ status: "waiting" });

    const result = await removeFromWaitlist(dataProvider, ENTRY_ID);
    expect(result).toEqual({ applied: true });

    const { data: updated } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: ENTRY_ID },
    );
    expect(updated.status).toBe("removed");
    expect(updated.removed_at).not.toBeNull();
  });

  it("invited -> removed is also allowed", async () => {
    const { dataProvider } = buildFixtures({ status: "invited" });

    const result = await removeFromWaitlist(dataProvider, ENTRY_ID);
    expect(result).toEqual({ applied: true });
  });

  it("is a no-op against an already-removed or converted entry", async () => {
    const { dataProvider } = buildFixtures({ status: "removed" });

    const result = await removeFromWaitlist(dataProvider, ENTRY_ID);
    expect(result).toEqual({ applied: false, reason: "not-active" });
  });

  it("never touches the Contact or any prior Opportunity", async () => {
    const priorDeal: Deal = {
      id: 5,
      name: "Ada Lovelace — The Living Example",
      contact_id: CONTACT_ID,
      offer_id: OFFER_ID,
      stage: "won",
      outcome: null,
      amount: 4000,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      sales_id: 0,
      index: 0,
      stage_entered_at: "2026-01-01T00:00:00.000Z",
    };
    const { dataProvider } = buildFixtures(
      { status: "waiting" },
      { deals: [priorDeal] },
    );

    await removeFromWaitlist(dataProvider, ENTRY_ID);

    const { data: deal } = await dataProvider.getOne<Deal>("deals", { id: 5 });
    expect(deal.stage).toBe("won");
    const { data: contact } = await dataProvider.getOne("contacts", {
      id: CONTACT_ID,
    });
    expect(contact.id).toBe(CONTACT_ID);
  });
});

describe("convertToOpportunity", () => {
  it("creates a new Opportunity at Interested with no outcome, for the same Contact/Offer/Cohort", async () => {
    const { dataProvider } = buildFixtures({
      status: "waiting",
      cohort_id: null,
      source: "instagram",
    });

    const result = await convertToOpportunity(dataProvider, ENTRY_ID);
    expect(result.applied).toBe(true);
    if (!result.applied) throw new Error("unreachable");
    expect(result.reusedExisting).toBe(false);

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: result.dealId,
    });
    expect(deal.contact_id).toBe(CONTACT_ID);
    expect(deal.offer_id).toBe(OFFER_ID);
    expect(deal.cohort_id ?? null).toBeNull();
    expect(deal.stage).toBe("interested");
    expect(deal.outcome).toBeNull();
    expect(deal.amount).toBe(4000);
    expect(deal.source).toBe("instagram");
  });

  it("marks the entry converted, with converted_at and the linked Opportunity id", async () => {
    const { dataProvider } = buildFixtures({ status: "waiting" });

    const result = await convertToOpportunity(dataProvider, ENTRY_ID);
    expect(result.applied).toBe(true);
    if (!result.applied) throw new Error("unreachable");

    const { data: entry } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: ENTRY_ID },
    );
    expect(entry.status).toBe("converted");
    expect(entry.converted_at).not.toBeNull();
    expect(entry.converted_opportunity_id).toBe(result.dealId);
  });

  it("also converts from Invited (an offer already made, not yet accepted)", async () => {
    const { dataProvider } = buildFixtures({ status: "invited" });

    const result = await convertToOpportunity(dataProvider, ENTRY_ID);
    expect(result.applied).toBe(true);
  });

  it("reuses an existing active Opportunity for the same Contact/Offer/Cohort instead of duplicating it", async () => {
    const existingDeal: Deal = {
      id: 9,
      name: "Ada Lovelace — The Living Example",
      contact_id: CONTACT_ID,
      offer_id: OFFER_ID,
      stage: "call_booked",
      outcome: null,
      amount: 4000,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      sales_id: 0,
      index: 0,
      stage_entered_at: "2026-01-01T00:00:00.000Z",
    };
    const { dataProvider } = buildFixtures(
      { status: "waiting" },
      { deals: [existingDeal] },
    );

    const result = await convertToOpportunity(dataProvider, ENTRY_ID);
    expect(result.applied).toBe(true);
    if (!result.applied) throw new Error("unreachable");
    expect(result.reusedExisting).toBe(true);
    expect(result.dealId).toBe(9);

    const { total: dealCount } = await dataProvider.getList("deals", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(dealCount).toBe(1);

    // The pre-existing Opportunity's own stage is left untouched — reuse
    // links to it, it never rewinds real sales progress.
    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: 9,
    });
    expect(deal.stage).toBe("call_booked");
  });

  it("does not reuse a Won or exited (outcome set) Opportunity — only a currently-active one blocks a duplicate", async () => {
    const wonDeal: Deal = {
      id: 11,
      name: "Ada Lovelace — The Living Example",
      contact_id: CONTACT_ID,
      offer_id: OFFER_ID,
      stage: "won",
      outcome: null,
      amount: 4000,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      sales_id: 0,
      index: 0,
      stage_entered_at: "2026-01-01T00:00:00.000Z",
    };
    const { dataProvider } = buildFixtures(
      { status: "waiting" },
      { deals: [wonDeal] },
    );

    const result = await convertToOpportunity(dataProvider, ENTRY_ID);
    expect(result.applied).toBe(true);
    if (!result.applied) throw new Error("unreachable");
    expect(result.reusedExisting).toBe(false);

    const { total: dealCount } = await dataProvider.getList("deals", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(dealCount).toBe(2);
  });

  it("is blocked for a Do Not Engage Contact, even though the waitlist entry predates it", async () => {
    const { dataProvider } = buildFixtures(
      { status: "waiting" },
      { contactOverrides: { sales_eligibility: "do_not_engage" } },
    );

    const result = await convertToOpportunity(dataProvider, ENTRY_ID);
    expect(result).toEqual({ applied: false, reason: "do-not-engage" });

    const { total: dealCount } = await dataProvider.getList("deals", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(dealCount).toBe(0);

    const { data: entry } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: ENTRY_ID },
    );
    expect(entry.status).toBe("waiting");
  });

  it("is a no-op against an already-converted or removed entry (idempotent)", async () => {
    const { dataProvider } = buildFixtures({ status: "converted" });

    const result = await convertToOpportunity(dataProvider, ENTRY_ID);
    expect(result).toEqual({ applied: false, reason: "not-active" });

    const { total: dealCount } = await dataProvider.getList("deals", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(dealCount).toBe(0);
  });
});
