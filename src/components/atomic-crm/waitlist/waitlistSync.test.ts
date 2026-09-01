import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Cohort, Deal, Offer, WaitlistEntry } from "../types";

// Human-acceptance repair pass, §4/§5/§6: a Contact cannot stay Waiting/
// Invited once an active Opportunity exists for the same relationship,
// however that Opportunity was created or advanced — these exercise the
// centralized sync (wired into dataProvider.ts's "deals" resource
// afterCreate/afterUpdate, see waitlistSync.ts) through the real
// dataProvider, never the sync function directly, so the tests prove the
// ACTUAL wiring, not just the pure logic.
const CONTACT_ID = 1;
const LE_OFFER_ID = 1;
const GYU_OFFER_ID = 2;
const SEPTEMBER_COHORT_ID = 1;
const NOVEMBER_COHORT_ID = 2;
const ENTRY_ID = 1;

const livingExample: Offer = {
  id: LE_OFFER_ID,
  name: "The Living Example",
  type: "individual",
  duration: "4 months",
  current_price: 4000,
  is_active: true,
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

const septemberCohort: Cohort = {
  id: SEPTEMBER_COHORT_ID,
  offer_id: GYU_OFFER_ID,
  name: "September GYU Cohort",
  status: "applications_open",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const novemberCohort: Cohort = {
  id: NOVEMBER_COHORT_ID,
  offer_id: GYU_OFFER_ID,
  name: "November GYU Cohort",
  status: "applications_open",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const buildEntry = (overrides: Partial<WaitlistEntry> = {}): WaitlistEntry => ({
  id: ENTRY_ID,
  contact_id: CONTACT_ID,
  offer_id: LE_OFFER_ID,
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

const buildProvider = (entries: WaitlistEntry[], deals: Deal[] = []) =>
  createDataProvider({
    db: createCrmDb({
      contacts: [buildContact({ id: CONTACT_ID })],
      offers: [livingExample, gyuOffer],
      offer_payment_options: [],
      cohorts: [septemberCohort, novemberCohort],
      enrollments: [],
      deals,
      waitlist_entries: entries,
    }),
    silent: true,
    latency: 0,
  });

describe("Opportunity creation converts a compatible Waitlist Entry (§4)", () => {
  it("creating an LE Opportunity through the normal New Opportunity flow converts the offer-level LE entry — the Sarah Jones contradiction", async () => {
    const dataProvider = buildProvider([buildEntry({ status: "waiting" })]);

    const { data: deal } = await dataProvider.create<Deal>("deals", {
      data: {
        contact_id: CONTACT_ID,
        offer_id: LE_OFFER_ID,
        stage: "interested",
        outcome: null,
        amount: 4000,
        description: "",
      },
    });

    const { data: entry } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: ENTRY_ID },
    );
    expect(entry.status).toBe("converted");
    expect(entry.converted_at).not.toBeNull();
    expect(entry.converted_opportunity_id).toBe(deal.id);
  });

  it("an Opportunity advancing to Approved through a plain edit (not the waitlist button) also converts it", async () => {
    const existingDeal: Deal = {
      id: 9,
      name: "Ada Lovelace — The Living Example",
      contact_id: CONTACT_ID,
      offer_id: LE_OFFER_ID,
      stage: "application_received",
      outcome: null,
      amount: 4000,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      sales_id: 0,
      index: 0,
      stage_entered_at: "2026-01-01T00:00:00.000Z",
    };
    const dataProvider = buildProvider(
      [buildEntry({ status: "waiting" })],
      [existingDeal],
    );

    await dataProvider.update("deals", {
      id: 9,
      data: { stage: "approved" },
      previousData: existingDeal,
    });

    const { data: entry } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: ENTRY_ID },
    );
    expect(entry.status).toBe("converted");
    expect(entry.converted_opportunity_id).toBe(9);
  });

  it("a Won Opportunity also converts a compatible waiting entry (Won is certainly not still waiting)", async () => {
    const dataProvider = buildProvider([buildEntry({ status: "waiting" })]);

    await dataProvider.create<Deal>("deals", {
      data: {
        contact_id: CONTACT_ID,
        offer_id: LE_OFFER_ID,
        stage: "won",
        outcome: null,
        amount: 4000,
        description: "",
      },
    });

    const { data: entry } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: ENTRY_ID },
    );
    expect(entry.status).toBe("converted");
  });

  it("an Opportunity that exits (outcome set) does NOT convert the entry — it never became a real active relationship", async () => {
    const dataProvider = buildProvider([buildEntry({ status: "waiting" })]);

    await dataProvider.create<Deal>("deals", {
      data: {
        contact_id: CONTACT_ID,
        offer_id: LE_OFFER_ID,
        stage: "application_received",
        outcome: "not_fit",
        amount: 4000,
        description: "",
      },
    });

    const { data: entry } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: ENTRY_ID },
    );
    expect(entry.status).toBe("waiting");
  });

  it("an unrelated Offer's waitlist entry is never touched", async () => {
    const dataProvider = buildProvider([
      buildEntry({
        status: "waiting",
        offer_id: GYU_OFFER_ID,
        cohort_id: null,
      }),
    ]);

    await dataProvider.create<Deal>("deals", {
      data: {
        contact_id: CONTACT_ID,
        offer_id: LE_OFFER_ID,
        stage: "interested",
        outcome: null,
        amount: 4000,
        description: "",
      },
    });

    const { data: entry } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: ENTRY_ID },
    );
    expect(entry.status).toBe("waiting");
  });
});

describe("GYU compatibility rules (§4)", () => {
  it("a general (offer-level) GYU waitlist converts when the Contact enters a real GYU cohort Opportunity", async () => {
    const dataProvider = buildProvider([
      buildEntry({
        status: "waiting",
        offer_id: GYU_OFFER_ID,
        cohort_id: null,
      }),
    ]);

    await dataProvider.create<Deal>("deals", {
      data: {
        contact_id: CONTACT_ID,
        offer_id: GYU_OFFER_ID,
        cohort_id: NOVEMBER_COHORT_ID,
        stage: "interested",
        outcome: null,
        amount: 1400,
        description: "",
      },
    });

    const { data: entry } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: ENTRY_ID },
    );
    expect(entry.status).toBe("converted");
  });

  it("a September-specific waitlist does NOT convert because of a November Opportunity", async () => {
    const dataProvider = buildProvider([
      buildEntry({
        status: "waiting",
        offer_id: GYU_OFFER_ID,
        cohort_id: SEPTEMBER_COHORT_ID,
      }),
    ]);

    await dataProvider.create<Deal>("deals", {
      data: {
        contact_id: CONTACT_ID,
        offer_id: GYU_OFFER_ID,
        cohort_id: NOVEMBER_COHORT_ID,
        stage: "interested",
        outcome: null,
        amount: 1400,
        description: "",
      },
    });

    const { data: entry } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: ENTRY_ID },
    );
    expect(entry.status).toBe("waiting");
  });

  it("a cohort-specific waitlist converts only for its own matching Cohort", async () => {
    const dataProvider = buildProvider([
      buildEntry({
        status: "waiting",
        offer_id: GYU_OFFER_ID,
        cohort_id: NOVEMBER_COHORT_ID,
      }),
    ]);

    await dataProvider.create<Deal>("deals", {
      data: {
        contact_id: CONTACT_ID,
        offer_id: GYU_OFFER_ID,
        cohort_id: NOVEMBER_COHORT_ID,
        stage: "interested",
        outcome: null,
        amount: 1400,
        description: "",
      },
    });

    const { data: entry } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: ENTRY_ID },
    );
    expect(entry.status).toBe("converted");
  });

  it("converting a general entry via a cohort Opportunity ALSO converts a sibling cohort-specific entry for the same Contact/matching Cohort — both compatible entries convert", async () => {
    const dataProvider = buildProvider([
      buildEntry({
        id: 1,
        status: "waiting",
        offer_id: GYU_OFFER_ID,
        cohort_id: null,
      }),
      buildEntry({
        id: 2,
        status: "waiting",
        offer_id: GYU_OFFER_ID,
        cohort_id: NOVEMBER_COHORT_ID,
      }),
    ]);

    await dataProvider.create<Deal>("deals", {
      data: {
        contact_id: CONTACT_ID,
        offer_id: GYU_OFFER_ID,
        cohort_id: NOVEMBER_COHORT_ID,
        stage: "interested",
        outcome: null,
        amount: 1400,
        description: "",
      },
    });

    const { data: general } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: 1 },
    );
    const { data: specific } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: 2 },
    );
    expect(general.status).toBe("converted");
    expect(specific.status).toBe("converted");
  });
});

describe("idempotency", () => {
  it("re-saving an already-active Deal does not error and leaves an already-converted entry converted", async () => {
    const dataProvider = buildProvider([buildEntry({ status: "waiting" })]);

    const { data: deal } = await dataProvider.create<Deal>("deals", {
      data: {
        contact_id: CONTACT_ID,
        offer_id: LE_OFFER_ID,
        stage: "interested",
        outcome: null,
        amount: 4000,
        description: "",
      },
    });

    await expect(
      dataProvider.update("deals", {
        id: deal.id,
        data: { stage: "approved" },
        previousData: deal,
      }),
    ).resolves.toBeDefined();

    const { data: entry } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: ENTRY_ID },
    );
    expect(entry.status).toBe("converted");
  });
});
