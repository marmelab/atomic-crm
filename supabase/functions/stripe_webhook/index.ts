// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.4.0";
import { corsHeaders } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

// Stripe test-mode integration slice: the real Stripe webhook endpoint.
// Signature verified via Stripe's own official library (constructEventAsync
// — Deno's crypto is async-only, so the sync constructEvent can't be used
// here). Every table's RLS is `to authenticated` only, so this uses
// supabaseAdmin server-side, same shape as acuity_webhook/index.ts.
//
// RECOVERABLE STATE MACHINE, not a happy-path sequence (Leif's own
// explicit requirement): every step below re-inspects authoritative
// Stripe + CRM state and only does what that state says is still missing.
// Safe to re-enter at ANY point — a retried/duplicate/concurrent delivery
// for the same event can land at any of these five states and always
// converges to the same end state without duplicating anything:
//   1. Checkout paid, no schedule yet (installment plans only)
//   2. Schedule created (from_subscription), future phase not configured
//   3. Schedule fully configured, CRM fulfillment not done
//   4. CRM already reached Won, webhook redelivered
//   5. An existing schedule/Won state is encountered mid-retry
// None of this needs a separate persisted state-machine/events-log table
// — the real Stripe objects (a schedule's own phase count) and the Deal's
// own existing fields (stage, stripe_subscription_schedule_id) already
// ARE the observable state, checked live every time.
//
// Business rules here MIRROR (do not share code with — Deno can't import
// from src/) src/components/atomic-crm/deals/recordDealPaymentSucceeded.ts
// (the Won/Enrollment fulfillment step) and the Architecture B schedule-
// adoption lifecycle approved 2026-09 (from_subscription, preserve the
// current phase unchanged, add a future phase with the remaining
// iterations, end_behavior: cancel). Keep in sync by hand if either
// changes.
//
// Deploy: `supabase secrets set STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=...`
// (test-mode values only). Register the endpoint in the Stripe Dashboard
// (Test mode -> Developers -> Webhooks) pointing at this function's real
// URL, subscribed to checkout.session.completed.
//
// Smoke-test locally with the Stripe CLI: `stripe listen --forward-to
// http://127.0.0.1:54321/functions/v1/stripe_webhook`, then trigger a real
// test event with `stripe trigger checkout.session.completed`.

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2025-08-27.basil",
});
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

type DealRow = {
  id: number;
  stage: string;
  outcome: string | null;
  pricing_mode: string;
  selected_payment_option_id: number | null;
  stripe_subscription_id: string | null;
  stripe_subscription_schedule_id: string | null;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const fetchDeal = async (dealId: number): Promise<DealRow | null> => {
  const { data } = await supabaseAdmin
    .from("deals")
    .select(
      "id, stage, outcome, pricing_mode, selected_payment_option_id, stripe_subscription_id, stripe_subscription_schedule_id",
    )
    .eq("id", dealId)
    .maybeSingle();
  return (data as DealRow | null) ?? null;
};

// Mirrors recordDealPaymentSucceeded.ts exactly: idempotent-via-refetch,
// never overrides a Deal someone already explicitly exited, freezes the
// commercial snapshot to the actually-paid option exactly here (never
// earlier — see resolveAuthorizedCheckoutTerms.ts's own header for why),
// never creates the Enrollment itself (handle_deal_won() already does,
// see that file's own header for the full rationale).
const recordDealPaymentSucceeded = async (
  deal: DealRow,
  paymentOptionId: number | null,
): Promise<
  | { status: "won" }
  | { status: "already-won" }
  | { status: "outcome-conflict"; outcome: string }
> => {
  if (deal.stage === "won") return { status: "already-won" };
  if (deal.outcome != null) {
    return { status: "outcome-conflict", outcome: deal.outcome };
  }

  const needsOptionFreeze =
    paymentOptionId != null &&
    deal.selected_payment_option_id !== paymentOptionId;

  await supabaseAdmin
    .from("deals")
    .update({
      stage: "won",
      ...(needsOptionFreeze
        ? { selected_payment_option_id: paymentOptionId }
        : {}),
    })
    .eq("id", deal.id);

  return { status: "won" };
};

// Architecture B (approved 2026-09): adopts the Checkout-created
// Subscription under a Schedule preserving its already-paid current phase
// unchanged, then adds a future phase for the remaining N-1 iterations,
// then sets end_behavior to cancel. Every step re-checks live Stripe
// state first — never blindly creates a second schedule or appends a
// second future phase.
const ensureInstallmentScheduleConfigured = async (
  deal: DealRow,
  subscriptionId: string,
  totalInstallments: number,
): Promise<void> => {
  if (totalInstallments <= 1) return; // defensive: PIF never reaches here

  let scheduleId = deal.stripe_subscription_schedule_id;

  if (!scheduleId) {
    try {
      const schedule = await stripe.subscriptionSchedules.create({
        from_subscription: subscriptionId,
      });
      scheduleId = schedule.id;
    } catch (error) {
      // Lost a genuine race to a concurrent/duplicate delivery that
      // already adopted this subscription — Stripe sets the
      // subscription's own `schedule` field once one governs it, so
      // recover the id from there instead of failing.
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const existingScheduleId =
        typeof subscription.schedule === "string"
          ? subscription.schedule
          : subscription.schedule?.id;
      if (!existingScheduleId) throw error;
      scheduleId = existingScheduleId;
    }

    await supabaseAdmin
      .from("deals")
      .update({ stripe_subscription_schedule_id: scheduleId })
      .eq("id", deal.id);
  }

  const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
  // Already configured (a prior delivery completed this step) — the
  // observable, live-Stripe signal this whole function trusts instead of
  // a separate CRM-side "is it done" flag.
  if (schedule.phases.length > 1 || schedule.end_behavior === "cancel") {
    return;
  }

  const currentPhase = schedule.phases[0];
  if (!currentPhase) return;

  await stripe.subscriptionSchedules.update(scheduleId, {
    end_behavior: "cancel",
    phases: [
      {
        // Preserved EXACTLY unchanged — Stripe's own documented pattern
        // for "keep this phase as-is" — never re-priced, never
        // re-dated, no proration.
        items: currentPhase.items.map((item) => ({
          price: typeof item.price === "string" ? item.price : item.price.id,
          quantity: item.quantity ?? 1,
        })),
        start_date: currentPhase.start_date,
        end_date: currentPhase.end_date,
        proration_behavior: "none",
      },
      {
        items: currentPhase.items.map((item) => ({
          price: typeof item.price === "string" ? item.price : item.price.id,
          quantity: item.quantity ?? 1,
        })),
        iterations: totalInstallments - 1,
        proration_behavior: "none",
      },
    ],
  });
};

const handleCheckoutSessionCompleted = async (
  eventSessionId: string,
): Promise<Response> => {
  // Authoritative re-fetch — never trust the event payload alone (Leif's
  // own explicit requirement) — mirrors public_application/offer_page's
  // own "read current state before acting" convention.
  const session = await stripe.checkout.sessions.retrieve(eventSessionId, {
    expand: ["subscription"],
  });

  if (session.payment_status === "unpaid") {
    // Checkout not actually completed successfully — a safe no-op
    // (matches "abandoned Checkout leaves Deal committed").
    return jsonResponse({ status: "not-paid" });
  }

  const dealId = Number(session.client_reference_id);
  if (!Number.isFinite(dealId)) {
    return jsonResponse({ status: "no-deal-reference" });
  }
  const deal = await fetchDeal(dealId);
  if (!deal) return jsonResponse({ status: "deal-not-found" });

  // Scholarship Pricing + Capacity slice: the BULLETPROOF half of the
  // stale-Checkout-Session invariant ("old commercial terms must not
  // remain payable after Leif changes pricing mode") — this re-validation
  // does not depend on the best-effort proactive invalidation
  // (stripe_invalidate_checkout) ever having run or succeeded. The Session
  // was priced against whatever pricing_mode was authoritative at
  // Checkout-creation time (stripe_checkout/index.ts stamps it into
  // metadata); if Leif has since changed this Deal's pricing_mode, this
  // Session's terms are stale and must NEVER silently become Won at the
  // old amount. Logged loudly (not silently dropped) — this is a genuine,
  // rare anomaly needing Leif's manual reconciliation (refund via the
  // Stripe dashboard + fix the Deal by hand), the same restraint this
  // codebase already applies to an outcome-conflict.
  const sessionPricingMode = session.metadata?.pricing_mode ?? null;
  if (sessionPricingMode != null && sessionPricingMode !== deal.pricing_mode) {
    console.error(
      `stripe_webhook: stale pricing_mode for deal ${deal.id} — session was priced as "${sessionPricingMode}", Deal is now "${deal.pricing_mode}". Refusing to mark Won; needs manual reconciliation.`,
    );
    return jsonResponse({
      status: "stale-pricing-mode-conflict",
      sessionPricingMode,
      dealPricingMode: deal.pricing_mode,
    });
  }

  const paymentOptionId = session.metadata?.payment_option_id
    ? Number(session.metadata.payment_option_id)
    : null;

  if (session.mode === "subscription" && session.subscription) {
    const subscription =
      typeof session.subscription === "string"
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription;

    if (!deal.stripe_subscription_id) {
      await supabaseAdmin
        .from("deals")
        .update({ stripe_subscription_id: subscription.id })
        .eq("id", deal.id);
    }

    const totalInstallments = subscription.metadata?.total_installments
      ? Number(subscription.metadata.total_installments)
      : null;
    if (totalInstallments) {
      await ensureInstallmentScheduleConfigured(
        deal,
        subscription.id,
        totalInstallments,
      );
    }
  }

  const result = await recordDealPaymentSucceeded(deal, paymentOptionId);
  return jsonResponse({ status: result.status });
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return createErrorResponse(405, "Method Not Allowed");
  }

  const signature = req.headers.get("Stripe-Signature");
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("Missing Stripe-Signature header");
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch (error) {
    console.error("stripe_webhook signature verification failed:", error);
    return createErrorResponse(
      400,
      `Webhook signature verification failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      return await handleCheckoutSessionCompleted(session.id);
    }
    // Every other event type is a safe, explicit no-op — this function
    // only subscribes to checkout.session.completed in the Stripe
    // Dashboard, but acknowledging anything else Stripe might still send
    // avoids Stripe's own retry machinery treating an unhandled type as a
    // delivery failure.
    return jsonResponse({ status: "ignored", type: event.type });
  } catch (error) {
    console.error("stripe_webhook processing error:", error);
    return createErrorResponse(
      500,
      `Failed to process webhook: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
});
