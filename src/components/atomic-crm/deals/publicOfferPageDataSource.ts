import type { DataProvider, Identifier } from "ra-core";

import type { PublicOfferPageContext } from "./publicOfferPageContext";
import { getOfferPageContext } from "./publicOfferPageContext";
import { recordOfferPageOpened } from "./recordOfferPageOpened";
import { resolveAuthorizedCheckoutTerms } from "./resolveAuthorizedCheckoutTerms";
import { recordDealPaymentSucceeded } from "./recordDealPaymentSucceeded";

export type CreateCheckoutResult =
  | { status: "created"; url: string }
  | { status: "not-found" }
  | { status: "already-won" }
  | { status: "unauthorized-option" }
  | { status: "error" };

// The boundary the public Offer Page actually depends on — same dual-
// implementation convention as public-application/
// publicApplicationDataSource.ts: a FakeRest/dev implementation (reads go
// straight through the shared dataProvider) and a production one
// (supabase/publicOfferPageDataSource.ts, calling stripe_checkout — a real
// Stripe Checkout Session, since every table's RLS is `to authenticated`
// only and Stripe itself is server-side only). Each app entry picks the
// one that matches its own environment — the page component never knows
// which one it got.
//
// createCheckout's dev/demo implementation has no real Stripe to redirect
// to, so it completes the Deal directly through the same fulfillment path
// a real webhook would eventually reach — an honest demo (the click really
// does something), not a fake Stripe illusion.
export type PublicOfferPageDataSource = {
  getContext: (token: string) => Promise<PublicOfferPageContext>;
  recordOpened: (token: string) => Promise<void>;
  createCheckout: (
    token: string,
    paymentOptionId: Identifier,
  ) => Promise<CreateCheckoutResult>;
};

export const createDataProviderPublicOfferPageDataSource = (
  dataProvider: DataProvider,
): PublicOfferPageDataSource => ({
  getContext: (token) => getOfferPageContext(dataProvider, token),
  recordOpened: async (token) => {
    const deal = await findDealByToken(dataProvider, token);
    if (deal) await recordOfferPageOpened(dataProvider, deal.id);
  },
  createCheckout: async (token, paymentOptionId) => {
    const terms = await resolveAuthorizedCheckoutTerms(dataProvider, {
      token,
      paymentOptionId,
    });
    if (terms.status !== "authorized") {
      return { status: terms.status };
    }
    const result = await recordDealPaymentSucceeded(
      dataProvider,
      terms.dealId,
      {
        paymentOptionId: terms.paymentOptionId,
      },
    );
    if (result.status !== "won" && result.status !== "already-won") {
      return { status: "error" };
    }
    return { status: "created", url: `#/offer/${token}?checkout=success` };
  },
});

const findDealByToken = async (dataProvider: DataProvider, token: string) => {
  const { data: deals } = await dataProvider.getList("deals", {
    filter: { offer_page_token: token },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  return deals[0] ?? null;
};
