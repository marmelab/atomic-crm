import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Cohort, Contact, Deal, Offer } from "../types";
import {
  findActiveOpportunityMatch,
  matchAcuityBooking,
} from "./matchAcuityBooking";

const CONTACT_ID = 1;
const OFFER_ID = 1;
const COHORT_ID = 1;
const DEAL_ID = 1;

const buildIndividualOffer = (): Offer => ({
  id: OFFER_ID,
  name: "The Living Example",
  type: "individual",
  duration: "6 months",
  current_price: 4000,
  is_active: true,
  acuity_appointment_type_id: "le-type",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

const buildGroupOffer = (): Offer => ({
  id: 2,
  name: "Growing Yourself Up",
  type: "group",
  duration: "8 weeks",
  current_price: 1400,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

const buildCohort = (): Cohort => ({
  id: COHORT_ID,
  offer_id: 2,
  name: "September Cohort",
  status: "active",
  acuity_appointment_type_id: "gyu-sept-type",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

const buildDeal = (overrides: Partial<Deal> = {}): Deal => ({
  pricing_mode: "standard",
  id: DEAL_ID,
  name: "Ada Lovelace",
  contact_id: CONTACT_ID,
  offer_id: OFFER_ID,
  stage: "approved",
  outcome: null,
  owner_decision: null,
  amount: 4000,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  sales_id: 0,
  index: 0,
  stage_entered_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("matchAcuityBooking", () => {
  it("matches an existing Contact by normalized email and the one active Opportunity for that offer", async () => {
    const contact = buildContact({
      id: CONTACT_ID,
      email_jsonb: [{ email: "Ada@Example.com", type: "Work" }],
    });
    const deal = buildDeal();
    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [contact],
        offers: [buildIndividualOffer()],
        deals: [deal],
      }),
      silent: true,
      latency: 0,
    });

    const result = await matchAcuityBooking(dataProvider, {
      email: "  ada@example.com  ",
      firstName: "Ada",
      lastName: "Lovelace",
      acuityAppointmentTypeId: "le-type",
    });

    expect(result.status).toBe("matched");
    if (result.status === "matched") {
      expect(result.contact.id).toBe(CONTACT_ID);
      expect(result.opportunity.id).toBe(DEAL_ID);
      expect(result.cohort).toBeNull();
    }

    const { total: contactCount } = await dataProvider.getList("contacts", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(contactCount).toBe(1);
  });

  it("creates a new Contact when no email matches, without inventing a name-only match", async () => {
    const contact = buildContact({
      id: CONTACT_ID,
      email_jsonb: [{ email: "someone-else@example.com", type: "Work" }],
    });
    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [contact],
        offers: [buildIndividualOffer()],
        deals: [],
      }),
      silent: true,
      latency: 0,
    });

    const result = await matchAcuityBooking(dataProvider, {
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      acuityAppointmentTypeId: "le-type",
    });

    expect(result.status).toBe("unmatched-opportunity");
    if (result.status === "unmatched-opportunity") {
      expect(result.reason).toBe("none");
      expect(result.contact.id).not.toBe(CONTACT_ID);
    }

    const { total: contactCount } = await dataProvider.getList("contacts", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(contactCount).toBe(2);
  });

  it("resolves a group Offer's Cohort via acuity_appointment_type_id, never a display-name match", async () => {
    const contact = buildContact({ id: CONTACT_ID });
    const deal = buildDeal({ offer_id: 2, cohort_id: COHORT_ID });
    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [contact],
        offers: [buildGroupOffer()],
        cohorts: [buildCohort()],
        deals: [deal],
      }),
      silent: true,
      latency: 0,
    });

    const result = await matchAcuityBooking(dataProvider, {
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      acuityAppointmentTypeId: "gyu-sept-type",
    });

    expect(result.status).toBe("matched");
    if (result.status === "matched") {
      expect(result.offer.id).toBe(2);
      expect(result.cohort?.id).toBe(COHORT_ID);
    }
  });

  it("resolves a group Offer's own canonical appointment type (mapped at the Offer level, not per-Cohort), matching by Contact+Offer alone and trusting the Deal's own already-set cohort_id", async () => {
    // GYU real-infrastructure slice, sealing pass: GYU's real appointment
    // type ("Let's Meet") is one canonical type shared by every Cohort,
    // durably mapped on the Offer itself — not a per-Cohort mapping. This
    // must still resolve as a group Offer match (never mislabeled
    // "individual" merely because the match came from the offers table),
    // with cohort left null (the appointment type alone can't identify a
    // specific Cohort) — offerCohortAcuityMapping.ts's own resolver
    // comment explains why this is safe: the matched Deal already carries
    // its own correct cohort_id from application time, untouched here.
    const groupOfferWithOwnMapping: Offer = {
      ...buildGroupOffer(),
      acuity_appointment_type_id: "gyu-canonical-type",
    };
    const contact = buildContact({ id: CONTACT_ID });
    const deal = buildDeal({ offer_id: 2, cohort_id: COHORT_ID });
    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [contact],
        offers: [groupOfferWithOwnMapping],
        cohorts: [buildCohort()],
        deals: [deal],
      }),
      silent: true,
      latency: 0,
    });

    const result = await matchAcuityBooking(dataProvider, {
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      acuityAppointmentTypeId: "gyu-canonical-type",
    });

    expect(result.status).toBe("matched");
    if (result.status === "matched") {
      expect(result.offer.id).toBe(2);
      expect(result.offer.type).toBe("group");
      // The match came from the Offer, not the Cohort — matchAcuityBooking
      // never derives a cohort from an Offer-level mapping.
      expect(result.cohort).toBeNull();
      // But the matched Opportunity's own cohort_id survives untouched.
      expect(result.opportunity.cohort_id).toBe(COHORT_ID);
    }
  });

  it("does not fabricate a match for an unmapped Acuity appointment type — no Contact is even created", async () => {
    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [],
        offers: [buildIndividualOffer()],
        cohorts: [],
        deals: [],
      }),
      silent: true,
      latency: 0,
    });

    const result = await matchAcuityBooking(dataProvider, {
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      acuityAppointmentTypeId: "unknown-type",
    });

    expect(result.status).toBe("unknown-appointment-type");
    const { total: contactCount } = await dataProvider.getList("contacts", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(contactCount).toBe(0);
  });

  it("treats two active Opportunities for the same Contact+Offer as ambiguous, never guessing", async () => {
    const dealA = buildDeal({ id: 1 });
    const dealB = buildDeal({ id: 2 });
    const dataProvider = createDataProvider({
      db: createCrmDb({ deals: [dealA, dealB] }),
      silent: true,
      latency: 0,
    });

    const match = await findActiveOpportunityMatch(dataProvider, {
      contactId: CONTACT_ID,
      offerId: OFFER_ID,
      cohortId: null,
    });
    expect(match.kind).toBe("ambiguous");
  });

  it("existing Contact data is never overwritten on match, only last_seen touched", async () => {
    const contact = buildContact({
      id: CONTACT_ID,
      first_name: "Original",
      last_name: "Name",
    });
    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [contact],
        offers: [buildIndividualOffer()],
        deals: [],
      }),
      silent: true,
      latency: 0,
    });

    await matchAcuityBooking(dataProvider, {
      email: contact.email_jsonb![0]!.email,
      firstName: "Different",
      lastName: "Person",
      acuityAppointmentTypeId: "le-type",
    });

    const { data: updated } = await dataProvider.getOne<Contact>("contacts", {
      id: CONTACT_ID,
    });
    expect(updated.first_name).toBe("Original");
    expect(updated.last_name).toBe("Name");
  });
});
