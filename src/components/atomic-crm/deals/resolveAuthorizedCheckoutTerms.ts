import type { DataProvider, Identifier } from "ra-core";

import type { Contact, Deal, OfferPaymentOption } from "../types";
import type { ConfigurationContextValue } from "../root/ConfigurationContext";

// Stripe test-mode integration slice: the SECURITY-CRITICAL authorization
// boundary between the public Offer Page and real money. The browser only
// ever sends a Deal's opaque token and the id of the payment option it
// wants — every commercial term actually charged (amount, currency,
// installment count) is resolved fresh from CRM state here, never trusted
// from the request. Mirrors publicOfferPageContext.ts's own token
// resolution and payment-option-authorization logic exactly (both must
// agree on "which options are valid for this Deal" — see
// publicOfferPageContext.test.ts for the shared cases).
//
// Deliberately READ-ONLY — never writes selected_payment_option_id itself.
// An earlier version of this function froze the Deal's commercial snapshot
// the moment a Checkout attempt was authorized, which turned out wrong:
// it conflated two different meanings of that one field — Leif explicitly
// pre-authorizing ONE specific option before the Offer Page ever existed
// (the case this function's own "only that option is valid" rule is
// about), versus a prospect's own still-changeable in-progress choice
// during checkout (which must stay free to change — including across an
// abandoned attempt — until money actually changes hands). Freezing the
// snapshot now belongs to the payment-success path instead (the Edge
// Function's fulfillment step, alongside the Won transition) — commercial
// terms become durable exactly when a real payment succeeds, not merely
// when a Checkout Session was created. This function only ever reads.
//
// Never calls the Stripe API itself — that's the Edge Function's job
// (untestable via FakeRest); this module stays the FakeRest-testable
// "logic of record" it mirrors by hand, same dual-implementation
// convention as every other integration in this app.
export type CheckoutTermsResult =
  | { status: "not-found" }
  | { status: "already-won" }
  | { status: "unauthorized-option" }
  | {
      status: "authorized";
      dealId: Identifier;
      contactId: Identifier;
      contactName: string;
      contactEmail: string | null;
      existingStripeCustomerId: string | null;
      currency: string;
      offerName: string;
      paymentOptionId: Identifier;
      // installments === 1 means a one-time payment (PIF); > 1 means the
      // fixed-installment plan (Architecture B, approved 2026-09).
      installments: number;
      // Always the amount of ONE charge in the smallest currency unit
      // (cents for USD) — total for PIF, per-installment amount
      // otherwise. Stripe's own unit, computed here so the Edge Function
      // never does its own arithmetic on a client-supplied number.
      unitAmountCents: number;
    };

export const resolveAuthorizedCheckoutTerms = async (
  dataProvider: DataProvider,
  { token, paymentOptionId }: { token: string; paymentOptionId: Identifier },
): Promise<CheckoutTermsResult> => {
  const { data: deals } = await dataProvider.getList<Deal>("deals", {
    filter: { offer_page_token: token },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  const deal = deals[0];
  if (!deal || deal.offer_price_snapshot == null)
    return { status: "not-found" };
  if (deal.stage === "won") return { status: "already-won" };

  const option = await resolveAuthorizedOption(
    dataProvider,
    deal,
    paymentOptionId,
  );
  if (!option) return { status: "unauthorized-option" };

  const contact = await dataProvider
    .getOne<Contact>("contacts", { id: deal.contact_id! })
    .then(({ data }) => data)
    .catch(() => null);
  if (!contact) return { status: "not-found" };

  const { data: configRecord } = await dataProvider
    .getOne<{
      id: number;
      config: ConfigurationContextValue;
    }>("configuration", { id: 1 })
    .catch(() => ({
      data: null as { config: ConfigurationContextValue } | null,
    }));
  const currency = configRecord?.config?.currency ?? "USD";

  const unitAmountCents = Math.round(
    (option.installments === 1 ? option.total : option.installment_amount) *
      100,
  );

  return {
    status: "authorized",
    dealId: deal.id,
    contactId: contact.id,
    contactName:
      `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim(),
    contactEmail: contact.email_jsonb?.[0]?.email ?? null,
    existingStripeCustomerId: contact.stripe_customer_id ?? null,
    currency,
    offerName: deal.offer_name_snapshot ?? "",
    paymentOptionId: option.id,
    installments: option.installments,
    unitAmountCents,
  };
};

// Same rule publicOfferPageContext.ts's own resolvePaymentOptions applies:
// exactly the one option Leif already authorized for this Deal (set
// through the normal Deal edit form, never by this function), or every
// publicly-offered option of the Deal's Offer otherwise. Returns the live
// offer_payment_options row (never the Deal's own snapshot, which may not
// exist yet before a payment has ever succeeded).
//
// Scholarship Pricing + Capacity slice: every path below is also scoped by
// deal.pricing_mode — a standard-priced option (including a non-public
// Financial Need plan) can never become selectable for a scholarship Deal,
// and a scholarship option can never become selectable for a standard
// Deal, even if a stale/mismatched selected_payment_option_id somehow
// reached this Deal (the DB's own handle_deal_saved() cross-validation is
// the authoritative backstop for that — see this function's own header).
const resolveAuthorizedOption = async (
  dataProvider: DataProvider,
  deal: Deal,
  requestedOptionId: Identifier,
): Promise<OfferPaymentOption | null> => {
  if (deal.selected_payment_option_id != null) {
    if (String(deal.selected_payment_option_id) !== String(requestedOptionId)) {
      return null;
    }
    const option = await dataProvider
      .getOne<OfferPaymentOption>("offer_payment_options", {
        id: deal.selected_payment_option_id,
      })
      .then(({ data }) => data)
      .catch(() => null);
    return option &&
      (option.pricing_mode ?? "standard") === (deal.pricing_mode ?? "standard")
      ? option
      : null;
  }

  const { data: options } = await dataProvider.getList<OfferPaymentOption>(
    "offer_payment_options",
    {
      filter: {
        offer_id: deal.offer_id,
        is_public: true,
        pricing_mode: deal.pricing_mode ?? "standard",
      },
      pagination: { page: 1, perPage: 20 },
      sort: { field: "id", order: "ASC" },
    },
  );
  return (
    options.find((option) => String(option.id) === String(requestedOptionId)) ??
    null
  );
};
