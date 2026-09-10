import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Deal, Offer, OfferPaymentOption } from "../types";
import { resolveAuthorizedCheckoutTerms } from "./resolveAuthorizedCheckoutTerms";

const CONTACT_ID = 1;
const OFFER_ID = 2;
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
  offerPaymentOptions: OfferPaymentOption[] = [buildPaymentOption()],
  contactOverrides: Record<string, unknown> = {},
) =>
  createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({
          id: CONTACT_ID,
          first_name: "Ada",
          last_name: "Lovelace",
          email_jsonb: [{ email: "ada@example.com", type: "Work" }],
          ...contactOverrides,
        }),
      ],
      offers: [buildOffer()],
      deals: [buildDeal(dealOverrides)],
      offer_payment_options: offerPaymentOptions,
      configuration: [{ id: 1, config: { currency: "USD" } }] as any,
    } as any),
    silent: true,
    latency: 0,
  });

describe("resolveAuthorizedCheckoutTerms", () => {
  it("authorizes a public payment option and computes the correct one-time (PIF) amount in cents", async () => {
    const dataProvider = buildFixtures();

    const result = await resolveAuthorizedCheckoutTerms(dataProvider, {
      token: TOKEN,
      paymentOptionId: 1,
    });
    expect(result.status).toBe("authorized");
    if (result.status === "authorized") {
      expect(result.dealId).toBe(DEAL_ID);
      expect(result.contactName).toBe("Ada Lovelace");
      expect(result.contactEmail).toBe("ada@example.com");
      expect(result.currency).toBe("USD");
      expect(result.installments).toBe(1);
      expect(result.unitAmountCents).toBe(140000);
    }
  });

  it("computes the correct per-installment amount in cents for a multi-installment option", async () => {
    const dataProvider = buildFixtures({}, [
      buildPaymentOption({
        id: 2,
        name: "Monthly",
        installments: 2,
        installment_amount: 700,
      }),
    ]);

    const result = await resolveAuthorizedCheckoutTerms(dataProvider, {
      token: TOKEN,
      paymentOptionId: 2,
    });
    expect(result.status).toBe("authorized");
    if (result.status === "authorized") {
      expect(result.installments).toBe(2);
      expect(result.unitAmountCents).toBe(70000);
    }
  });

  it("rejects a payment option that is not public and not pre-authorized on this Deal", async () => {
    const dataProvider = buildFixtures({}, [
      buildPaymentOption({ id: 1, is_public: true }),
      buildPaymentOption({ id: 3, name: "Financial Need", is_public: false }),
    ]);

    const result = await resolveAuthorizedCheckoutTerms(dataProvider, {
      token: TOKEN,
      paymentOptionId: 3,
    });
    expect(result.status).toBe("unauthorized-option");
  });

  it("when Leif has pre-authorized exactly one option (through the normal Deal edit form), rejects any other id even if publicly listed elsewhere", async () => {
    const dataProvider = buildFixtures({ selected_payment_option_id: 3 }, [
      buildPaymentOption({ id: 1, is_public: true }),
      buildPaymentOption({ id: 3, name: "Financial Need", is_public: false }),
    ]);

    const result = await resolveAuthorizedCheckoutTerms(dataProvider, {
      token: TOKEN,
      paymentOptionId: 1,
    });
    expect(result.status).toBe("unauthorized-option");
  });

  it("rejects a wrong/unknown token", async () => {
    const dataProvider = buildFixtures();
    const result = await resolveAuthorizedCheckoutTerms(dataProvider, {
      token: "wrong-token",
      paymentOptionId: 1,
    });
    expect(result.status).toBe("not-found");
  });

  it("rejects a Deal that has already reached Won — nothing left to pay for", async () => {
    const dataProvider = buildFixtures({ stage: "won" });
    const result = await resolveAuthorizedCheckoutTerms(dataProvider, {
      token: TOKEN,
      paymentOptionId: 1,
    });
    expect(result.status).toBe("already-won");
  });

  it("is read-only: never writes selected_payment_option_id or any other Deal field — a prospect's in-progress choice (including an abandoned attempt) must stay freely changeable until payment actually succeeds", async () => {
    const dataProvider = buildFixtures({}, [
      buildPaymentOption({ id: 1, name: "Pay in Full", is_public: true }),
      buildPaymentOption({
        id: 2,
        name: "Monthly",
        installments: 2,
        installment_amount: 700,
        is_public: true,
      }),
    ]);

    const first = await resolveAuthorizedCheckoutTerms(dataProvider, {
      token: TOKEN,
      paymentOptionId: 1,
    });
    expect(first.status).toBe("authorized");

    const { data: dealAfterFirst } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(dealAfterFirst.selected_payment_option_id).toBeFalsy();

    // Freely switches to a different option next — never blocked by the
    // first (abandoned) attempt, because nothing was frozen by it.
    const second = await resolveAuthorizedCheckoutTerms(dataProvider, {
      token: TOKEN,
      paymentOptionId: 2,
    });
    expect(second.status).toBe("authorized");
    if (second.status === "authorized") {
      expect(second.installments).toBe(2);
      expect(second.unitAmountCents).toBe(70000);
    }

    const { data: dealAfterSecond } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(dealAfterSecond.selected_payment_option_id).toBeFalsy();
  });

  it("passes through an existing Stripe Customer id for reuse, never creating a duplicate", async () => {
    const dataProvider = buildFixtures({}, [buildPaymentOption()], {
      stripe_customer_id: "cus_existing123",
    });

    const result = await resolveAuthorizedCheckoutTerms(dataProvider, {
      token: TOKEN,
      paymentOptionId: 1,
    });
    expect(result.status).toBe("authorized");
    if (result.status === "authorized") {
      expect(result.existingStripeCustomerId).toBe("cus_existing123");
    }
  });
});
