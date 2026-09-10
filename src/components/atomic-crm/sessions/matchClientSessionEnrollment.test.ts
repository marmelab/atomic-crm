import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Deal, Enrollment, Offer } from "../types";
import { matchClientSessionEnrollment } from "./matchClientSessionEnrollment";

const leOffer: Offer = {
  id: 1,
  name: "The Living Example",
  type: "individual",
  duration: "4 months",
  current_price: 4000,
  is_active: true,
  client_session_acuity_appointment_type_id: "90522599",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const buildDeal = (overrides: Partial<Deal> = {}): Deal => ({
  pricing_mode: "standard",
  id: 10,
  name: "Ada Lovelace",
  contact_id: 1,
  offer_id: 1,
  stage: "won",
  outcome: null,
  amount: 4000,
  sales_id: 0,
  index: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  stage_entered_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildEnrollment = (overrides: Partial<Enrollment> = {}): Enrollment => ({
  id: 100,
  opportunity_id: 10,
  status: "active",
  start_date: "2026-01-01",
  end_date: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildProvider = ({
  deals = [],
  enrollments = [],
}: {
  deals?: Deal[];
  enrollments?: Enrollment[];
}) =>
  createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Ada", last_name: "Lovelace" }),
      ],
      offers: [leOffer],
      cohorts: [],
      deals,
      enrollments,
    } as any),
    silent: true,
  });

describe("matchClientSessionEnrollment", () => {
  it("matches the one legitimate active Enrollment", async () => {
    const dataProvider = buildProvider({
      deals: [buildDeal()],
      enrollments: [buildEnrollment()],
    });
    const result = await matchClientSessionEnrollment(dataProvider, {
      contactId: 1,
      offerId: 1,
    });
    expect(result).toEqual({ kind: "matched", enrollment: buildEnrollment() });
  });

  it("returns none when the Contact has no Deal for this Offer at all", async () => {
    const dataProvider = buildProvider({ deals: [], enrollments: [] });
    const result = await matchClientSessionEnrollment(dataProvider, {
      contactId: 1,
      offerId: 1,
    });
    expect(result).toEqual({ kind: "none" });
  });

  it("returns none when the only Enrollment for this Contact+Offer isn't active (onboarding/offboarding/completed don't count as legitimately serviceable)", async () => {
    const dataProvider = buildProvider({
      deals: [buildDeal()],
      enrollments: [buildEnrollment({ status: "onboarding" })],
    });
    const result = await matchClientSessionEnrollment(dataProvider, {
      contactId: 1,
      offerId: 1,
    });
    expect(result).toEqual({ kind: "none" });
  });

  it("returns ambiguous when 2+ active Enrollments exist for the same Contact+Offer, never guessing", async () => {
    const dataProvider = buildProvider({
      deals: [buildDeal({ id: 10 }), buildDeal({ id: 11 })],
      enrollments: [
        buildEnrollment({ id: 100, opportunity_id: 10 }),
        buildEnrollment({ id: 101, opportunity_id: 11 }),
      ],
    });
    const result = await matchClientSessionEnrollment(dataProvider, {
      contactId: 1,
      offerId: 1,
    });
    expect(result).toEqual({ kind: "ambiguous" });
  });
});
