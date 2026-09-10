// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.4.0";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

// Scholarship Pricing + Capacity slice: the PROACTIVE (best-effort, never
// authoritative) half of the stale-Checkout-Session invariant — "old
// commercial terms must not remain payable after Leif changes a Deal's
// pricing mode" (Leif's own explicit decision). Called by the CRM right
// after grantScholarshipPricing.ts/releaseScholarshipReservation.ts
// successfully changes a pre-Won Deal's pricing_mode, so an already-open
// Stripe Checkout Session priced against the OLD terms stops being
// payable as soon as possible.
//
// Deliberately NOT the invariant's real guarantee — a Postgres UPDATE and
// an external Stripe API call can never share one transaction, so this
// call can itself fail (network blip, Stripe outage) without that ever
// being allowed to look like success. The caller surfaces this endpoint's
// outcome distinctly (see scholarshipCheckoutInvalidator.ts) rather than
// assuming consistency; the actual bulletproof backstop that does NOT
// depend on this endpoint ever succeeding is reactive:
// stripe_webhook/index.ts re-validates a Session's own stamped
// pricing_mode against the Deal's CURRENT pricing_mode at the moment a
// payment actually succeeds, and refuses to mark Won on a stale-terms
// match regardless of what happened here.
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2025-08-27.basil",
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

type DealRow = {
  id: number;
  stage: string;
  stripe_checkout_session_id: string | null;
};

const handleInvalidate = async (body: Record<string, unknown>) => {
  const dealId = Number(body.dealId);
  if (!Number.isFinite(dealId)) {
    return jsonResponse({ status: "invalid-request" }, 400);
  }

  const { data: deal } = await supabaseAdmin
    .from("deals")
    .select("id, stage, stripe_checkout_session_id")
    .eq("id", dealId)
    .maybeSingle();
  const dealRow = (deal as DealRow | null) ?? null;

  // Already Won, or never had a Checkout Session — nothing payable to
  // invalidate. Deliberately does not distinguish these two cases in the
  // response: both mean "no action needed", which is all the caller acts on.
  if (
    !dealRow ||
    dealRow.stage === "won" ||
    !dealRow.stripe_checkout_session_id
  ) {
    return jsonResponse({ status: "not-applicable" });
  }

  const session = await stripe.checkout.sessions.retrieve(
    dealRow.stripe_checkout_session_id,
  );
  if (session.status !== "open") {
    // Already completed, already expired, or otherwise no longer payable —
    // a safe no-op.
    return jsonResponse({ status: "not-applicable" });
  }

  await stripe.checkout.sessions.expire(dealRow.stripe_checkout_session_id);
  return jsonResponse({ status: "invalidated" });
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
      return await handleInvalidate(body);
    } catch (error) {
      console.error("stripe_invalidate_checkout error:", error);
      // A caught failure still returns a clean 200 "failed" JSON body
      // rather than an error status — this endpoint's own contract is
      // "report the outcome", including a failure outcome, never an
      // unhandled throw the caller has to guess about.
      return jsonResponse({ status: "failed" });
    }
  }),
);
