import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Cohort, Deal, Offer, OfferPaymentOption } from "../types";
import { getOfferPageContext } from "./publicOfferPageContext";

const CONTACT_ID = 1;
const OFFER_ID = 2;
const COHORT_ID = 1;
const DEAL_ID = 9;
const TOKEN = "real-offer-page-token";

const buildOffer = (): Offer => ({
  id: OFFER_ID,
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
  offer_id: OFFER_ID,
  name: "Real-Infrastructure Cohort",
  status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

const buildPaymentOption = (
  overrides: Partial<OfferPaymentOption> = {},
): OfferPaymentOption => ({
  pricing_mode: "standard",
  id: 1,
  offer_id: OFFER_ID,
  name: "Pay in Full",
  total: 1400,
  installments: 1,
  installment_amount: 1400,
  is_public: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildDeal = (overrides: Partial<Deal> = {}): Deal => ({
  pricing_mode: "standard",
  id: DEAL_ID,
  name: "Ada Lovelace — Growing Yourself Up",
  contact_id: CONTACT_ID,
  offer_id: OFFER_ID,
  cohort_id: COHORT_ID,
  stage: "committed",
  outcome: null,
  amount: 1400,
  offer_name_snapshot: "Growing Yourself Up",
  offer_price_snapshot: 1400,
  offer_page_token: TOKEN,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  sales_id: 0,
  index: 0,
  stage_entered_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildFixtures = (
  dealOverrides: Partial<Deal> = {},
  offerPaymentOptions: OfferPaymentOption[] = [],
) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({
          id: CONTACT_ID,
          first_name: "Ada",
          last_name: "Lovelace",
        }),
      ],
      offers: [buildOffer()],
      cohorts: [buildCohort()],
      deals: [buildDeal(dealOverrides)],
      offer_payment_options: offerPaymentOptions,
    }),
    silent: true,
    latency: 0,
  });
  return { dataProvider };
};

describe("getOfferPageContext", () => {
  it("returns not-found for an unknown token", async () => {
    const { dataProvider } = buildFixtures();
    const result = await getOfferPageContext(dataProvider, "wrong-token");
    expect(result.kind).toBe("not-found");
  });

  it("returns the frozen price, person, offer, and cohort for a real token", async () => {
    const { dataProvider } = buildFixtures();
    const result = await getOfferPageContext(dataProvider, TOKEN);
    expect(result.kind).toBe("found");
    if (result.kind === "found") {
      expect(result.contactName).toBe("Ada Lovelace");
      expect(result.offerName).toBe("Growing Yourself Up");
      expect(result.cohortName).toBe("Real-Infrastructure Cohort");
      expect(result.frozenPrice).toBe(1400);
      expect(result.alreadyWon).toBe(false);
    }
  });

  it("when Leif has authorized exactly one option, shows only that one — not the full public list", async () => {
    const { dataProvider } = buildFixtures(
      {
        selected_payment_option_id: 3,
        selected_payment_total: 1400,
        selected_installment_count: 4,
        selected_installment_amount: 350,
      },
      [
        buildPaymentOption({ id: 1, name: "Pay in Full" }),
        buildPaymentOption({ id: 2, name: "Monthly", is_public: true }),
        buildPaymentOption({
          id: 3,
          name: "Financial Need",
          installments: 4,
          installment_amount: 350,
          is_public: false,
        }),
      ],
    );

    const result = await getOfferPageContext(dataProvider, TOKEN);
    expect(result.kind).toBe("found");
    if (result.kind === "found") {
      expect(result.paymentOptions).toHaveLength(1);
      expect(result.paymentOptions[0].name).toBe("Financial Need");
      expect(result.paymentOptions[0].installments).toBe(4);
    }
  });

  it("with no option pre-authorized, shows every public option and excludes non-public ones", async () => {
    const { dataProvider } = buildFixtures({}, [
      buildPaymentOption({ id: 1, name: "Pay in Full", is_public: true }),
      buildPaymentOption({
        id: 2,
        name: "Monthly",
        installments: 2,
        installment_amount: 700,
        is_public: true,
      }),
      buildPaymentOption({
        id: 3,
        name: "Financial Need",
        installments: 4,
        installment_amount: 350,
        is_public: false,
      }),
    ]);

    const result = await getOfferPageContext(dataProvider, TOKEN);
    expect(result.kind).toBe("found");
    if (result.kind === "found") {
      expect(result.paymentOptions.map((option) => option.name).sort()).toEqual(
        ["Monthly", "Pay in Full"],
      );
    }
  });

  it("reflects alreadyWon for a Deal that has already reached Won", async () => {
    const { dataProvider } = buildFixtures({ stage: "won" });
    const result = await getOfferPageContext(dataProvider, TOKEN);
    expect(result.kind).toBe("found");
    if (result.kind === "found") {
      expect(result.alreadyWon).toBe(true);
    }
  });
});
