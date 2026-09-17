import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type {
  Application,
  Cohort,
  Deal,
  Enrollment,
  Offer,
  WaitlistEntry,
} from "../types";
import { markInvited, removeFromWaitlist } from "./waitlistActions";
import { DuplicateActiveWaitlistEntryError } from "./waitlistEntryValidation";

// Manual Waitlist operations (Pre-live Operations slice). These exercise
// the DATA-LAYER contract behind the two UI entry points — the Contact
// page's "Add to Waitlist" and the Program/Cohort pages' existing one —
// since both write the same canonical waitlist_entries row through the
// same provider, with duplicate protection enforced in the provider
// lifecycle rather than in either screen.

const CONTACT_ID = 1;
const OTHER_CONTACT_ID = 2;
const LE_OFFER_ID = 1;
const GYU_OFFER_ID = 2;
const COHORT_ID = 10;

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

const growingYourselfUp: Offer = {
  id: GYU_OFFER_ID,
  name: "Growing Yourself Up",
  type: "group",
  duration: "8 weeks",
  current_price: 1400,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const januaryCohort: Cohort = {
  id: COHORT_ID,
  offer_id: GYU_OFFER_ID,
  name: "Growing Yourself Up — January 2027",
  status: "applications_open",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
} as Cohort;

// A previously-imported historical row, with the provenance shape the
// historical import produces (a source-derived joined_at, no priority).
const historicalEntry: WaitlistEntry = {
  id: 900,
  contact_id: OTHER_CONTACT_ID,
  offer_id: LE_OFFER_ID,
  cohort_id: null,
  status: "waiting",
  joined_at: "2026-08-20T17:49:18.000Z",
  desired_timing: null,
  notes:
    "Historical import: joined_at is the source page creation time, NOT a confirmed join date.",
  priority: 7,
  source: null,
  invited_at: null,
  converted_at: null,
  converted_opportunity_id: null,
  removed_at: null,
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
} as WaitlistEntry;

const buildProvider = (entries: WaitlistEntry[] = []) =>
  createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: CONTACT_ID }),
        buildContact({ id: OTHER_CONTACT_ID, first_name: "Historical" }),
      ],
      offers: [livingExample, growingYourselfUp],
      cohorts: [januaryCohort],
      deals: [],
      applications: [],
      enrollments: [],
      waitlist_entries: entries,
      tasks: [],
    } as any),
    silent: true,
    latency: 0,
  });

// What both "Add to Waitlist" sheets submit: a waitlist_entries row for a
// Contact + Offer (+ optional Cohort), status waiting, joined now.
const addToWaitlist = (
  dataProvider: ReturnType<typeof buildProvider>,
  {
    contactId = CONTACT_ID,
    offerId,
    cohortId = null,
    joinedAt = new Date().toISOString(),
    desiredTiming = null,
  }: {
    contactId?: number;
    offerId: number;
    cohortId?: number | null;
    joinedAt?: string;
    desiredTiming?: string | null;
  },
) =>
  dataProvider.create<WaitlistEntry>("waitlist_entries", {
    data: {
      contact_id: contactId,
      offer_id: offerId,
      cohort_id: cohortId,
      status: "waiting",
      joined_at: joinedAt,
      desired_timing: desiredTiming,
    } as Partial<WaitlistEntry>,
  });

describe("manual waitlist operations", () => {
  it("Contact -> add to an Offer-level waitlist creates one canonical entry", async () => {
    const dataProvider = buildProvider();
    const { data: entry } = await addToWaitlist(dataProvider, {
      offerId: LE_OFFER_ID,
    });

    expect(entry.contact_id).toBe(CONTACT_ID);
    expect(entry.offer_id).toBe(LE_OFFER_ID);
    expect(entry.cohort_id ?? null).toBeNull();
    expect(entry.status).toBe("waiting");

    const { data: all } = await dataProvider.getList<WaitlistEntry>(
      "waitlist_entries",
      {
        filter: { contact_id: CONTACT_ID },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(all).toHaveLength(1);
  });

  it("Contact -> add to a specific Cohort waitlist records the Cohort scope", async () => {
    const dataProvider = buildProvider();
    const { data: entry } = await addToWaitlist(dataProvider, {
      offerId: GYU_OFFER_ID,
      cohortId: COHORT_ID,
    });
    expect(entry.offer_id).toBe(GYU_OFFER_ID);
    expect(entry.cohort_id).toBe(COHORT_ID);
    expect(entry.status).toBe("waiting");
  });

  it("Program/Cohort -> adding an existing Contact produces the same canonical row", async () => {
    const dataProvider = buildProvider();
    // The Program page supplies the Offer/Cohort; the person is chosen.
    const { data: entry } = await addToWaitlist(dataProvider, {
      contactId: OTHER_CONTACT_ID,
      offerId: GYU_OFFER_ID,
      cohortId: COHORT_ID,
    });
    expect(entry.contact_id).toBe(OTHER_CONTACT_ID);
    expect(entry.offer_id).toBe(GYU_OFFER_ID);
    expect(entry.cohort_id).toBe(COHORT_ID);
  });

  it("refuses a duplicate ACTIVE membership for the same Contact + Offer + Cohort scope", async () => {
    const dataProvider = buildProvider();
    await addToWaitlist(dataProvider, { offerId: LE_OFFER_ID });

    await expect(
      addToWaitlist(dataProvider, { offerId: LE_OFFER_ID }),
    ).rejects.toBeInstanceOf(DuplicateActiveWaitlistEntryError);

    const { data: all } = await dataProvider.getList<WaitlistEntry>(
      "waitlist_entries",
      {
        filter: { contact_id: CONTACT_ID },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(all).toHaveLength(1);
  });

  it("keeps Offer-level and specific-Cohort waitlists as distinct legitimate facts", async () => {
    const dataProvider = buildProvider();
    await addToWaitlist(dataProvider, { offerId: GYU_OFFER_ID });
    // Same Contact, same Offer, but a specific Cohort — a different fact,
    // so it must NOT be collapsed into the offer-level entry.
    await addToWaitlist(dataProvider, {
      offerId: GYU_OFFER_ID,
      cohortId: COHORT_ID,
    });

    const { data: all } = await dataProvider.getList<WaitlistEntry>(
      "waitlist_entries",
      {
        filter: { contact_id: CONTACT_ID },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(all).toHaveLength(2);
    const scopes = all.map((e) => e.cohort_id ?? null);
    expect(scopes).toContain(null);
    expect(scopes).toContain(COHORT_ID);
  });

  it("creates no Application, no Deal and no Enrollment", async () => {
    const dataProvider = buildProvider();
    await addToWaitlist(dataProvider, { offerId: LE_OFFER_ID });

    const { data: applications } = await dataProvider.getList<Application>(
      "applications",
      {
        filter: {},
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    const { data: deals } = await dataProvider.getList<Deal>("deals", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    const { data: enrollments } = await dataProvider.getList<Enrollment>(
      "enrollments",
      {
        filter: {},
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(applications).toHaveLength(0);
    expect(deals).toHaveLength(0);
    expect(enrollments).toHaveLength(0);
  });

  it("creates no fake invitation — a manual add starts at Waiting", async () => {
    const dataProvider = buildProvider();
    const { data: entry } = await addToWaitlist(dataProvider, {
      offerId: LE_OFFER_ID,
    });
    expect(entry.status).toBe("waiting");
    expect(entry.invited_at ?? null).toBeNull();
    expect(entry.converted_at ?? null).toBeNull();
    expect(entry.removed_at ?? null).toBeNull();
  });

  it("stamps a manual add with the actual creation moment", async () => {
    const dataProvider = buildProvider();
    const before = Date.now();
    const { data: entry } = await addToWaitlist(dataProvider, {
      offerId: LE_OFFER_ID,
    });
    const after = Date.now();
    const joined = new Date(entry.joined_at).getTime();
    expect(joined).toBeGreaterThanOrEqual(before - 1000);
    expect(joined).toBeLessThanOrEqual(after + 1000);
  });

  it("Remove transitions to Removed and never deletes the record", async () => {
    const dataProvider = buildProvider();
    const { data: entry } = await addToWaitlist(dataProvider, {
      offerId: LE_OFFER_ID,
    });

    const result = await removeFromWaitlist(dataProvider, entry.id);
    expect(result.applied).toBe(true);

    // Still there — as history, not deleted.
    const { data: after } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: entry.id },
    );
    expect(after.status).toBe("removed");
    expect(after.removed_at).toBeTruthy();
    // The join evidence survives the removal.
    expect(after.joined_at).toBe(entry.joined_at);
    expect(after.offer_id).toBe(LE_OFFER_ID);
  });

  it("allows re-adding after removal, because the removed entry is no longer active", async () => {
    const dataProvider = buildProvider();
    const { data: entry } = await addToWaitlist(dataProvider, {
      offerId: LE_OFFER_ID,
    });
    await removeFromWaitlist(dataProvider, entry.id);

    const { data: rejoined } = await addToWaitlist(dataProvider, {
      offerId: LE_OFFER_ID,
    });
    expect(rejoined.status).toBe("waiting");

    const { data: all } = await dataProvider.getList<WaitlistEntry>(
      "waitlist_entries",
      {
        filter: { contact_id: CONTACT_ID },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    // Both the historical removal and the new membership are preserved.
    expect(all).toHaveLength(2);
    expect(all.map((e) => e.status).sort()).toEqual(["removed", "waiting"]);
  });

  it("leaves existing Invited semantics intact", async () => {
    const dataProvider = buildProvider();
    const { data: entry } = await addToWaitlist(dataProvider, {
      offerId: LE_OFFER_ID,
    });
    const result = await markInvited(dataProvider, entry.id);
    expect(result.applied).toBe(true);

    const { data: after } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: entry.id },
    );
    expect(after.status).toBe("invited");
    expect(after.invited_at).toBeTruthy();
  });

  it("never rewrites an imported historical waitlist row", async () => {
    const dataProvider = buildProvider([historicalEntry]);
    // A manual add for a DIFFERENT person/offer must not normalize history.
    await addToWaitlist(dataProvider, { offerId: LE_OFFER_ID });

    const { data: historical } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: historicalEntry.id },
    );
    expect(historical.joined_at).toBe("2026-08-20T17:49:18.000Z");
    expect(historical.priority).toBe(7);
    expect(historical.notes).toContain("NOT a confirmed join date");
    expect(historical.status).toBe("waiting");
  });
});
