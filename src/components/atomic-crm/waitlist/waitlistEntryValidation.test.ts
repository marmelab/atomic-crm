import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Cohort, Offer, WaitlistEntry } from "../types";
import { findActiveWaitlistEntry } from "./waitlistEntryValidation";

const CONTACT_ID = 1;
const LE_OFFER_ID = 1;
const GYU_OFFER_ID = 2;
const COHORT_ID = 1;

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
  id: COHORT_ID,
  offer_id: GYU_OFFER_ID,
  name: "September GYU Cohort",
  status: "applications_open",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const buildProvider = (entries: WaitlistEntry[]) =>
  createDataProvider({
    db: createCrmDb({
      contacts: [buildContact({ id: CONTACT_ID })],
      offers: [livingExample, gyuOffer],
      offer_payment_options: [],
      cohorts: [septemberCohort],
      waitlist_entries: entries,
    }),
    silent: true,
    latency: 0,
  });

const buildEntry = (overrides: Partial<WaitlistEntry> = {}): WaitlistEntry => ({
  id: 1,
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

describe("duplicate-active-entry prevention (dataProvider.create through the FakeRest hook)", () => {
  it("rejects a second active entry for the same Contact + Offer (offer-level)", async () => {
    const dataProvider = buildProvider([buildEntry({ status: "waiting" })]);

    await expect(
      dataProvider.create("waitlist_entries", {
        data: {
          contact_id: CONTACT_ID,
          offer_id: LE_OFFER_ID,
          cohort_id: null,
          status: "waiting",
          joined_at: "2026-01-02T00:00:00.000Z",
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects a second active entry for the same Contact + Cohort (cohort-specific)", async () => {
    const dataProvider = buildProvider([
      buildEntry({
        id: 1,
        offer_id: GYU_OFFER_ID,
        cohort_id: COHORT_ID,
        status: "invited",
      }),
    ]);

    await expect(
      dataProvider.create("waitlist_entries", {
        data: {
          contact_id: CONTACT_ID,
          offer_id: GYU_OFFER_ID,
          cohort_id: COHORT_ID,
          status: "waiting",
          joined_at: "2026-01-02T00:00:00.000Z",
        },
      }),
    ).rejects.toThrow();
  });

  it("allows a cohort-specific entry alongside an existing offer-level entry for the same Contact — never conflated", async () => {
    const dataProvider = buildProvider([
      buildEntry({
        id: 1,
        offer_id: GYU_OFFER_ID,
        cohort_id: null,
        status: "waiting",
      }),
    ]);

    const { data: created } = await dataProvider.create("waitlist_entries", {
      data: {
        contact_id: CONTACT_ID,
        offer_id: GYU_OFFER_ID,
        cohort_id: COHORT_ID,
        status: "waiting",
        joined_at: "2026-01-02T00:00:00.000Z",
      },
    });
    expect(created.id).toBeDefined();

    const { total } = await dataProvider.getList("waitlist_entries", {
      filter: { contact_id: CONTACT_ID },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(2);
  });

  it("allows a brand-new active entry once the only prior one is historical (removed) — rejoin is not blocked", async () => {
    const dataProvider = buildProvider([
      buildEntry({ status: "removed", removed_at: "2026-01-10T00:00:00.000Z" }),
    ]);

    const { data: created } = await dataProvider.create("waitlist_entries", {
      data: {
        contact_id: CONTACT_ID,
        offer_id: LE_OFFER_ID,
        cohort_id: null,
        status: "waiting",
        joined_at: "2026-01-11T00:00:00.000Z",
      },
    });
    expect(created.status).toBe("waiting");

    const { total } = await dataProvider.getList("waitlist_entries", {
      filter: { contact_id: CONTACT_ID },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    // Both rows persist — the old history is never overwritten by the rejoin.
    expect(total).toBe(2);
  });

  it("allows a brand-new active entry once the only prior one is historical (converted) — rejoin is not blocked", async () => {
    const dataProvider = buildProvider([
      buildEntry({
        status: "converted",
        converted_at: "2026-01-10T00:00:00.000Z",
        converted_opportunity_id: 99,
      }),
    ]);

    await expect(
      dataProvider.create("waitlist_entries", {
        data: {
          contact_id: CONTACT_ID,
          offer_id: LE_OFFER_ID,
          cohort_id: null,
          status: "waiting",
          joined_at: "2026-01-11T00:00:00.000Z",
        },
      }),
    ).resolves.toBeDefined();
  });

  it("rejects an invalid Offer/Cohort relationship (a Cohort belonging to a different Offer)", async () => {
    const dataProvider = buildProvider([]);

    await expect(
      dataProvider.create("waitlist_entries", {
        data: {
          contact_id: CONTACT_ID,
          offer_id: LE_OFFER_ID,
          cohort_id: COHORT_ID, // belongs to GYU_OFFER_ID, not LE_OFFER_ID
          status: "waiting",
          joined_at: "2026-01-02T00:00:00.000Z",
        },
      }),
    ).rejects.toThrow();
  });
});

describe("findActiveWaitlistEntry", () => {
  it("finds the active offer-level entry for a Contact/Offer pair", async () => {
    const entry = buildEntry({ status: "waiting" });
    const dataProvider = buildProvider([entry]);

    const found = await findActiveWaitlistEntry(dataProvider, {
      contactId: CONTACT_ID,
      offerId: LE_OFFER_ID,
      cohortId: null,
    });
    expect(found?.id).toBe(entry.id);
  });

  it("returns null when the only match is historical", async () => {
    const dataProvider = buildProvider([buildEntry({ status: "removed" })]);

    const found = await findActiveWaitlistEntry(dataProvider, {
      contactId: CONTACT_ID,
      offerId: LE_OFFER_ID,
      cohortId: null,
    });
    expect(found).toBeNull();
  });

  it("does not match a cohort-specific entry when asking offer-level, or vice versa", async () => {
    const dataProvider = buildProvider([
      buildEntry({
        id: 1,
        offer_id: GYU_OFFER_ID,
        cohort_id: COHORT_ID,
        status: "waiting",
      }),
    ]);

    const offerLevel = await findActiveWaitlistEntry(dataProvider, {
      contactId: CONTACT_ID,
      offerId: GYU_OFFER_ID,
      cohortId: null,
    });
    expect(offerLevel).toBeNull();

    const cohortLevel = await findActiveWaitlistEntry(dataProvider, {
      contactId: CONTACT_ID,
      offerId: GYU_OFFER_ID,
      cohortId: COHORT_ID,
    });
    expect(cohortLevel?.id).toBe(1);
  });
});
