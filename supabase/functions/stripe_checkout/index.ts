// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.4.0";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

// Stripe test-mode integration slice: the production write path for
// "create a real Checkout Session for this Offer Page". Deliberately NOT
// gated by AuthMiddleware/UserMiddleware — a prospect has no CRM account,
// same shape as public_application/offer_page. Every table's RLS is
// `to authenticated` only, so this uses supabaseAdmin server-side.
//
// SECURITY-CRITICAL: mirrors (does not share code with — Deno can't import
// from src/) src/components/atomic-crm/deals/resolveAuthorizedCheckoutTerms.ts
// EXACTLY — the browser sends only an opaque token and a payment-option
// id; every commercial term actually charged (amount, currency,
// installment count) is resolved fresh from CRM state here, never trusted
// from the request. Keep the two in sync by hand if either changes, same
// dual-implementation convention as every other integration in this app.
//
// Deliberately does NOT freeze deals.selected_payment_option_id — a
// prospect's in-progress choice must stay freely changeable across an
// abandoned/retried Checkout attempt. That freeze happens in
// stripe_webhook/index.ts, exactly when a payment actually succeeds.
//
// Smoke-test locally: `make start-supabase-functions`, then:
//
//   curl -i --location --request POST \
//     'http://127.0.0.1:54321/functions/v1/stripe_checkout' \
//     --header 'Content-Type: application/json' \
//     --data '{"token":"<a-real-committed-deal-token>","paymentOptionId":6}'

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2025-08-27.basil",
});

type DealRow = {
  id: number;
  contact_id: number;
  offer_id: number;
  stage: string;
  pricing_mode: string;
  offer_name_snapshot: string | null;
  offer_price_snapshot: number | null;
  selected_payment_option_id: number | null;
};

type ContactRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email_jsonb: { email: string; type: string }[] | null;
  stripe_customer_id: string | null;
};

type OfferPaymentOptionRow = {
  id: number;
  offer_id: number;
  name: string;
  total: number;
  installments: number;
  installment_amount: number;
  is_public: boolean;
  pricing_mode: string;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const findDealByToken = async (token: string): Promise<DealRow | null> => {
  const { data } = await supabaseAdmin
    .from("deals")
    .select(
      "id, contact_id, offer_id, stage, pricing_mode, offer_name_snapshot, offer_price_snapshot, selected_payment_option_id",
    )
    .eq("offer_page_token", token)
    .maybeSingle();
  return (data as DealRow | null) ?? null;
};

// Mirrors resolveAuthorizedCheckoutTerms.ts's own resolveAuthorizedOption
// exactly: exactly the one option Leif already authorized on the Deal, or
// every publicly-offered option of the Deal's Offer otherwise. Scholarship
// Pricing + Capacity slice: every path is also scoped by deal.pricing_mode
// — a standard-priced option (including a non-public Financial Need plan)
// can never become selectable for a scholarship Deal, and vice versa.
const resolveAuthorizedOption = async (
  deal: DealRow,
  requestedOptionId: number,
): Promise<OfferPaymentOptionRow | null> => {
  if (deal.selected_payment_option_id != null) {
    if (deal.selected_payment_option_id !== requestedOptionId) return null;
    const { data } = await supabaseAdmin
      .from("offer_payment_options")
      .select(
        "id, offer_id, name, total, installments, installment_amount, is_public, pricing_mode",
      )
      .eq("id", deal.selected_payment_option_id)
      .maybeSingle();
    const option = (data as OfferPaymentOptionRow | null) ?? null;
    return option && option.pricing_mode === deal.pricing_mode ? option : null;
  }

  const { data: options } = await supabaseAdmin
    .from("offer_payment_options")
    .select(
      "id, offer_id, name, total, installments, installment_amount, is_public, pricing_mode",
    )
    .eq("offer_id", deal.offer_id)
    .eq("is_public", true)
    .eq("pricing_mode", deal.pricing_mode);
  return (
    ((options ?? []) as OfferPaymentOptionRow[]).find(
      (option) => option.id === requestedOptionId,
    ) ?? null
  );
};

const resolveOrCreateStripeCustomer = async (
  contact: ContactRow,
): Promise<string> => {
  if (contact.stripe_customer_id) return contact.stripe_customer_id;

  const email = contact.email_jsonb?.[0]?.email;
  const name = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();
  const customer = await stripe.customers.create({
    name: name || undefined,
    email: email || undefined,
    metadata: { contact_id: String(contact.id) },
  });

  await supabaseAdmin
    .from("contacts")
    .update({ stripe_customer_id: customer.id })
    .eq("id", contact.id);

  return customer.id;
};

const handleCreate = async (body: Record<string, unknown>) => {
  const token = String(body.token ?? "");
  const paymentOptionId = Number(body.paymentOptionId);
  if (!token || !Number.isFinite(paymentOptionId)) {
    return jsonResponse({ status: "invalid-request" }, 400);
  }

  const deal = await findDealByToken(token);
  if (!deal || deal.offer_price_snapshot == null) {
    return jsonResponse({ status: "not-found" });
  }
  if (deal.stage === "won") {
    return jsonResponse({ status: "already-won" });
  }

  const option = await resolveAuthorizedOption(deal, paymentOptionId);
  if (!option) {
    return jsonResponse({ status: "unauthorized-option" });
  }

  const { data: contact } = await supabaseAdmin
    .from("contacts")
    .select("id, first_name, last_name, email_jsonb, stripe_customer_id")
    .eq("id", deal.contact_id)
    .maybeSingle();
  if (!contact) return jsonResponse({ status: "not-found" });

  const { data: configRecord } = await supabaseAdmin
    .from("configuration")
    .select("config")
    .eq("id", 1)
    .maybeSingle();
  const currency = (
    (configRecord as { config?: { currency?: string } } | null)?.config
      ?.currency ?? "USD"
  ).toLowerCase();

  const stripeCustomerId = await resolveOrCreateStripeCustomer(
    contact as ContactRow,
  );

  const baseUrl = (Deno.env.get("CRM_BASE_URL") ?? "").replace(/\/$/, "");
  const successUrl = `${baseUrl}/#/offer/${encodeURIComponent(token)}?checkout=success`;
  const cancelUrl = `${baseUrl}/#/offer/${encodeURIComponent(token)}?checkout=cancelled`;

  const isSubscription = option.installments > 1;
  const unitAmount = Math.round(
    (isSubscription ? option.installment_amount : option.total) * 100,
  );

  const session = await stripe.checkout.sessions.create({
    mode: isSubscription ? "subscription" : "payment",
    customer: stripeCustomerId,
    client_reference_id: String(deal.id),
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      deal_id: String(deal.id),
      payment_option_id: String(option.id),
      // Scholarship Pricing + Capacity slice: the reactive half of the
      // stale-Checkout-Session invariant ("old commercial terms must not
      // remain payable after Leif changes pricing mode") — stripe_webhook
      // compares this against the Deal's CURRENT pricing_mode at the
      // moment a payment actually succeeds, and refuses to mark Won on a
      // mismatch, regardless of whether the best-effort proactive
      // invalidation (stripe_invalidate_checkout) ever ran or succeeded.
      pricing_mode: deal.pricing_mode,
    },
    line_items: [
      {
        price_data: {
          currency,
          unit_amount: unitAmount,
          product_data: { name: deal.offer_name_snapshot ?? option.name },
          ...(isSubscription ? { recurring: { interval: "month" } } : {}),
        },
        quantity: 1,
      },
    ],
    ...(isSubscription
      ? {
          subscription_data: {
            metadata: {
              deal_id: String(deal.id),
              payment_option_id: String(option.id),
              total_installments: String(option.installments),
              pricing_mode: deal.pricing_mode,
            },
          },
        }
      : {
          payment_intent_data: {
            metadata: {
              deal_id: String(deal.id),
              payment_option_id: String(option.id),
              pricing_mode: deal.pricing_mode,
            },
          },
        }),
  });

  await supabaseAdmin
    .from("deals")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", deal.id);

  if (!session.url) {
    return jsonResponse({ status: "error" }, 500);
  }
  return jsonResponse({ status: "created", url: session.url });
};

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method Not Allowed");
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse(400, "Invalid JSON body");
    }

    try {
      return await handleCreate(body);
    } catch (error) {
      console.error("stripe_checkout error:", error);
      return createErrorResponse(
        500,
        `Failed to create checkout session: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }),
);
