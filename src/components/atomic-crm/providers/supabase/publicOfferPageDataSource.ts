import type { PublicOfferPageDataSource } from "../../deals/publicOfferPageDataSource";
import type { PublicOfferPageContext } from "../../deals/publicOfferPageContext";
import { getSupabaseClient } from "./supabase";

// Production implementation of the public Offer Page data source (Payment
// domain foundation slice) — same shape as publicApplicationDataSource.ts:
// every table's RLS is `to authenticated` only, so an anon client-side
// call can never read Deals/Contacts/Offers directly. Every operation goes
// through the offer_page Edge Function
// (supabase/functions/offer_page/index.ts), which uses supabaseAdmin
// server-side.
const invoke = async <T>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await getSupabaseClient().functions.invoke<T>(
    "offer_page",
    { method: "POST", body },
  );
  if (!data || error) {
    console.error("offer_page.error", error);
    throw new Error("Failed to reach the offer service.");
  }
  return data;
};

export const supabasePublicOfferPageDataSource: PublicOfferPageDataSource = {
  getContext: (token) =>
    invoke<PublicOfferPageContext>({ action: "context", token }),
  recordOpened: (token) => invoke<void>({ action: "record-opened", token }),
};
