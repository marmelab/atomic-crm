import type {
  CreateCheckoutResult,
  PublicOfferPageDataSource,
} from "../../deals/publicOfferPageDataSource";
import type { PublicOfferPageContext } from "../../deals/publicOfferPageContext";
import { getSupabaseClient } from "./supabase";

// Production implementation of the public Offer Page data source (Payment
// domain foundation slice) — same shape as publicApplicationDataSource.ts:
// every table's RLS is `to authenticated` only, so an anon client-side
// call can never read Deals/Contacts/Offers directly. getContext/
// recordOpened go through the offer_page Edge Function; createCheckout
// goes through stripe_checkout (a real Stripe Checkout Session — needs
// the Stripe secret key, server-side only). Both use supabaseAdmin
// server-side.
const invoke = async <T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> => {
  const { data, error } = await getSupabaseClient().functions.invoke<T>(
    functionName,
    { method: "POST", body },
  );
  if (!data || error) {
    console.error(`${functionName}.error`, error);
    throw new Error("Failed to reach the offer service.");
  }
  return data;
};

export const supabasePublicOfferPageDataSource: PublicOfferPageDataSource = {
  getContext: (token) =>
    invoke<PublicOfferPageContext>("offer_page", { action: "context", token }),
  recordOpened: (token) =>
    invoke<void>("offer_page", { action: "record-opened", token }),
  createCheckout: (token, paymentOptionId) =>
    invoke<CreateCheckoutResult>("stripe_checkout", { token, paymentOptionId }),
};
