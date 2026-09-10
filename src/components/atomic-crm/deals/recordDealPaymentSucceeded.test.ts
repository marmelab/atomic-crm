import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type {
  Cohort,
  Deal,
  Enrollment,
  Offer,
  OfferPaymentOption,
} from "../types";
import { recordDealPaymentSucceeded } from "./recordDealPaymentSucceeded";

// Payment domain foundation slice: the Won boundary is the FIRST
// successful payment (Leif's own explicit decision) — full installment-
// plan completion is not required. This function does NOT create the
// Enrollment itself — audited before writing it and confirmed against two
// independent, already-live pieces of infrastructure this codebase
// already had: the real handle_deal_won() Postgres trigger (production)
// and providers/fakerest/dataProvider.ts's own ensureEnrollmentForWonDeal
// (dev/demo), both of which already create an Enrollment at status
// "onboarding" the instant deals.stage genuinely becomes 'won'. This
// function's own job is the idempotent stage transition, then handing
// back the id of the Enrollment that infrastructure already created.

const CONTACT_ID = 1;
const OFFER_ID = 2;
const COHORT_ID = 1;
const DEAL_ID = 9;

const buildOffer = (): Offer => ({
  id: OFFER_ID,
  name: "Growing Yourself Up",
  type: "group",
  duration: "8 weeks",
  current_price: 1400,
  is_active: true,
  acuity_appointment_type_id: "64654501",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

const buildCohort = (): Cohort => ({
  id: COHORT_ID,
  offer_id: OFFER_ID,
  name: "Real-Infrastructure Cohort",
  status: "active",
  program_start_at: "2026-10-01",
  program_end_at: "2026-11-26",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

const buildDeal = (overrides: Partial<Deal> = {}): Deal => ({
  id: DEAL_ID,
  name: "Ada Lovelace — Growing Yourself Up",
  contact_id: CONTACT_ID,
  offer_id: OFFER_ID,
  cohort_id: COHORT_ID,
  stage: "committed",
  outcome: null,
  owner_decision: "would_work_with",
  prospect_decision: "yes",
  amount: 1400,
  offer_name_snapshot: "Growing Yourself Up",
  offer_price_snapshot: 1400,
  offer_page_token: "test-token",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  sales_id: 0,
  index: 0,
  stage_entered_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildPaymentOption = (
  overrides: Partial<OfferPaymentOption> = {},
): OfferPaymentOption => ({
  pricing_mode: "standard",
  id: 5,
  offer_id: OFFER_ID,
  name: "Monthly",
  total: 1400,
  installments: 2,
  installment_amount: 700,
  is_public: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildFixtures = (
  dealOverrides: Partial<Deal> = {},
  offerPaymentOptions: OfferPaymentOption[] = [buildPaymentOption()],
) => {
  const contact = buildContact({ id: CONTACT_ID });
  const offer = buildOffer();
  const cohort = buildCohort();
  const deal = buildDeal(dealOverrides);

  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [contact],
      offers: [offer],
      cohorts: [cohort],
      deals: [deal],
      enrollments: [],
      offer_payment_options: offerPaymentOptions,
    }),
    silent: true,
    latency: 0,
  });

  return { dataProvider, deal };
};

describe("recordDealPaymentSucceeded", () => {
  it("first payment on a Committed Deal: advances to Won and creates exactly one Enrollment at status onboarding, dates from the Cohort", async () => {
    const { dataProvider } = buildFixtures();

    const result = await recordDealPaymentSucceeded(dataProvider, DEAL_ID);
    expect(result.status).toBe("won");

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.stage).toBe("won");

    const { data: enrollments } = await dataProvider.getList<Enrollment>(
      "enrollments",
      {
        filter: { opportunity_id: DEAL_ID },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(enrollments).toHaveLength(1);
    expect(enrollments[0].status).toBe("onboarding");
    expect(enrollments[0].start_date).toBe("2026-10-01");
    expect(enrollments[0].end_date).toBe("2026-11-26");
  });

  it("a Deal with no Cohort (an individual Offer like LE) gets an Enrollment with null dates", async () => {
    const { dataProvider } = buildFixtures({ cohort_id: null });

    const result = await recordDealPaymentSucceeded(dataProvider, DEAL_ID);
    expect(result.status).toBe("won");

    const { data: enrollments } = await dataProvider.getList<Enrollment>(
      "enrollments",
      {
        filter: { opportunity_id: DEAL_ID },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(enrollments[0].start_date).toBeFalsy();
    expect(enrollments[0].end_date).toBeFalsy();
  });

  it("is idempotent: a duplicate/replayed payment-succeeded event for an already-Won Deal is a safe no-op, never a second Won transition or Enrollment", async () => {
    const { dataProvider } = buildFixtures();

    const first = await recordDealPaymentSucceeded(dataProvider, DEAL_ID);
    const second = await recordDealPaymentSucceeded(dataProvider, DEAL_ID);
    expect(first.status).toBe("won");
    expect(second.status).toBe("already-won");
    if (second.status === "already-won" && first.status === "won") {
      expect(second.enrollmentId).toBe(first.enrollmentId);
    }

    const { total } = await dataProvider.getList("enrollments", {
      filter: { opportunity_id: DEAL_ID },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(1);
  });

  it("does not silently override a Deal someone already explicitly exited (outcome set) — surfaces a conflict instead", async () => {
    const { dataProvider } = buildFixtures({
      stage: "call_booked",
      outcome: "lost",
    });

    const result = await recordDealPaymentSucceeded(dataProvider, DEAL_ID);
    expect(result.status).toBe("outcome-conflict");
    if (result.status === "outcome-conflict") {
      expect(result.outcome).toBe("lost");
    }

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.stage).toBe("call_booked");

    const { total } = await dataProvider.getList("enrollments", {
      filter: { opportunity_id: DEAL_ID },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(0);
  });

  it("returns not-found for a nonexistent Deal id, without throwing", async () => {
    const { dataProvider } = buildFixtures();

    const result = await recordDealPaymentSucceeded(dataProvider, 999999);
    expect(result.status).toBe("not-found");
  });

  it("does not itself create the Enrollment — a Deal that reached Won by some other path (e.g. a direct edit) is recognized as already-won using the Enrollment that path's own infrastructure already created, never a duplicate", async () => {
    // Audited before writing recordDealPaymentSucceeded.ts: an
    // Opportunity's Enrollment is already created automatically — a real,
    // already-deployed Postgres trigger in production
    // (handle_deal_won()/on_deal_won) and its FakeRest mirror
    // (providers/fakerest/dataProvider.ts's own ensureEnrollmentForWonDeal)
    // in dev/demo — the instant deals.stage genuinely becomes 'won',
    // regardless of which code path set it. This proves this function
    // never duplicates that: a Deal already at Won via ANY route (here,
    // seeded directly at fixture-construction time, simulating an edit
    // made outside this function entirely) already has its Enrollment,
    // and this function correctly recognizes and returns it.
    const { dataProvider } = buildFixtures({ stage: "won" });
    const { data: enrollments } = await dataProvider.getList<Enrollment>(
      "enrollments",
      {
        filter: { opportunity_id: DEAL_ID },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    // FakeRest's own afterUpdate/afterCreate hook only fires on an actual
    // write through the dataProvider — seeding the fixture's initial state
    // directly doesn't trigger it, so create the Enrollment the same way
    // the real trigger would have, to accurately simulate "already won via
    // another path" rather than a state FakeRest could never really reach.
    if (enrollments.length === 0) {
      await dataProvider.create("enrollments", {
        data: {
          opportunity_id: DEAL_ID,
          status: "onboarding",
          start_date: "2026-10-01",
          end_date: "2026-11-26",
        },
      });
    }

    const result = await recordDealPaymentSucceeded(dataProvider, DEAL_ID);
    expect(result.status).toBe("already-won");
    if (result.status === "already-won") {
      // 0 is a valid id in this app's own convention (e.g. the seeded
      // administrator Sale) — assert non-null, not merely truthy.
      expect(result.enrollmentId).not.toBeNull();
    }

    const { total } = await dataProvider.getList("enrollments", {
      filter: { opportunity_id: DEAL_ID },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(1);
  });

  it("freezes the commercial snapshot to the actually-paid option exactly at Won — not before", async () => {
    // resolveAuthorizedCheckoutTerms.ts is deliberately read-only, so
    // nothing froze this Deal's payment option during Checkout — this is
    // where that freeze happens, via the option Stripe actually charged.
    const { dataProvider } = buildFixtures();

    const result = await recordDealPaymentSucceeded(dataProvider, DEAL_ID, {
      paymentOptionId: 5,
    });
    expect(result.status).toBe("won");

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.selected_payment_option_id).toBe(5);
    expect(deal.selected_installment_count).toBe(2);
    expect(deal.selected_installment_amount).toBe(700);
  });

  it("is a no-op on the option freeze when the Deal already has that exact option set (e.g. Leif pre-authorized it)", async () => {
    const { dataProvider } = buildFixtures({ selected_payment_option_id: 5 });

    const result = await recordDealPaymentSucceeded(dataProvider, DEAL_ID, {
      paymentOptionId: 5,
    });
    expect(result.status).toBe("won");

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.selected_payment_option_id).toBe(5);
  });
});
