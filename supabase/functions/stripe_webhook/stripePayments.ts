import type Stripe from "npm:stripe@18.5.0";

import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

// Money received, which is a different question from whether a plan exists.
//
// The reconciler used to ask Stripe one thing — "is there a live
// subscription or schedule?" — and treat "no" as "no payment". That is
// wrong in three ordinary situations, all of them live in this CRM:
//
//   A one-time payment creates no subscription at all. Emily Loeb paid
//   $3,700 in a single PaymentIntent and read as "setup pending".
//
//   A plan that has run its course reads as completed or canceled. Jules
//   Litman-Cleper's four collected installments sat behind a schedule
//   marked "completed", filtered out as not-live.
//
//   A client can pay everything and then remove their card. Jess
//   Beauchamp did exactly that, on purpose.
//
// So this ingests the money itself. Each collected payment becomes a paid
// row on the Opportunity's payment schedule, carrying the PaymentIntent
// that produced it — which is both the provenance and the idempotency key.

export type PaymentIngestResult = {
  ingested: number;
  alreadyRecorded: number;
  // Stripe evidence attached to a payment the CRM already knew about.
  merged: number;
  // More than one owner-stated payment could be the same money.
  ambiguousMerge: number;
  obligationsSatisfied: number;
  receivedMinor: number;
  currency: string | null;
  lastPaymentAt: string | null;
  // Set when the evidence does not fully explain itself. Absence of
  // evidence is never reported as absence of payment.
  reviewReason: string | null;
  errors: string[];
  // Endpoints this Stripe key cannot read. A degraded capability, not a
  // per-client problem, so it is reported once rather than turning every
  // client into a review.
  capabilityWarnings: string[];
};

export type CollectedPayment = {
  paymentIntentId: string;
  amountMinor: number;
  currency: string;
  paidAt: string;
};

const iso = (seconds: number | null | undefined): string | null =>
  seconds == null ? null : new Date(seconds * 1000).toISOString();

const idOf = (value: unknown): string | null =>
  typeof value === "string"
    ? value
    : ((value as { id?: string } | null)?.id ?? null);

// Invoices, charges and PaymentIntents describe overlapping money: an
// invoice is paid by a charge, and a charge belongs to a PaymentIntent.
// Keying everything on the PaymentIntent counts each payment exactly once.
export const collectPayments = async (
  stripe: Stripe,
  customerId: string,
): Promise<{
  payments: CollectedPayment[];
  errors: string[];
  capabilityWarnings: string[];
}> => {
  const byIntent = new Map<string, CollectedPayment>();
  const errors: string[] = [];
  const capabilityWarnings: string[] = [];

  // PaymentIntents are the PRIMARY record: every invoice payment and every
  // charge has one, so losing that call means the money picture is genuinely
  // unknown and the client must be reviewed. Invoices and charges are
  // supplementary — they only add payments that carry no PaymentIntent — so
  // losing those degrades capability without making any individual client
  // uncertain. Conflating the two would mark every client "needs review"
  // the moment a restricted key lacked one permission.
  const attempt = async (
    label: string,
    primary: boolean,
    run: () => Promise<void>,
  ) => {
    try {
      await run();
    } catch (error) {
      const message = `${label}: ${error instanceof Error ? error.message : String(error)}`;
      if (primary) errors.push(message);
      else capabilityWarnings.push(message);
    }
  };

  await attempt("payment_intents", true, async () => {
    const list = await stripe.paymentIntents.list({
      customer: customerId,
      limit: 100,
    });
    for (const intent of list.data) {
      const amount = intent.amount_received ?? 0;
      if (intent.status !== "succeeded" || amount <= 0) continue;
      byIntent.set(intent.id, {
        paymentIntentId: intent.id,
        amountMinor: amount,
        currency: intent.currency,
        paidAt: iso(intent.created)!,
      });
    }
  });

  await attempt("invoices", false, async () => {
    const list = await stripe.invoices.list({
      customer: customerId,
      limit: 100,
    });
    for (const invoice of list.data) {
      const amount = invoice.amount_paid ?? 0;
      if (invoice.status !== "paid" || amount <= 0) continue;
      const intentId = idOf(
        (invoice as unknown as { payment_intent?: unknown }).payment_intent,
      );
      // An invoice with no PaymentIntent cannot be recorded with
      // provenance, so it is left for a human rather than invented.
      if (!intentId || byIntent.has(intentId)) continue;
      byIntent.set(intentId, {
        paymentIntentId: intentId,
        amountMinor: amount,
        currency: invoice.currency ?? "usd",
        paidAt:
          iso(invoice.status_transitions?.paid_at) ?? iso(invoice.created)!,
      });
    }
  });

  await attempt("charges", false, async () => {
    const list = await stripe.charges.list({
      customer: customerId,
      limit: 100,
    });
    for (const charge of list.data) {
      if (charge.status !== "succeeded" || charge.refunded) continue;
      const intentId = idOf(
        (charge as unknown as { payment_intent?: unknown }).payment_intent,
      );
      if (!intentId || byIntent.has(intentId)) continue;
      byIntent.set(intentId, {
        paymentIntentId: intentId,
        amountMinor: charge.amount_captured ?? charge.amount,
        currency: charge.currency,
        paidAt: iso(charge.created)!,
      });
    }
  });

  const payments = [...byIntent.values()].sort((a, b) =>
    a.paidAt.localeCompare(b.paidAt),
  );
  return { payments, errors, capabilityWarnings };
};

// The overage check reads the Opportunity's WHOLE paid ledger, not just
// what Stripe collected.
//
// Checking Stripe's own total alone missed the case that matters: Linda
// Turner had an owner-stated paid-in-full row for $4,000, Stripe held the
// real $4,000 payment behind it, and ingesting one alongside the other
// recorded her as having paid $8,000 on a $4,000 contract. Each half
// reconciled perfectly on its own. Only the sum showed the duplicate.
const describeLedger = (params: {
  stripePayments: number;
  agreedTotal: number | null;
  recordedMajor: number;
  hasOwnerStated: boolean;
  hasStripeSourced: boolean;
  errors: string[];
}): string | null => {
  const {
    stripePayments,
    agreedTotal,
    recordedMajor,
    hasOwnerStated,
    hasStripeSourced,
    errors,
  } = params;

  if (errors.length > 0) {
    return `Stripe evidence is incomplete, so payment cannot be confirmed either way: ${errors[0]}`;
  }
  if (stripePayments === 0 && recordedMajor === 0) return null;
  if (agreedTotal == null || agreedTotal <= 0) {
    if (stripePayments === 0) return null;
    return `Stripe holds ${stripePayments} successful payment(s), but no agreed total is recorded on this Opportunity.`;
  }
  // NOTE: the old "an owner-stated amount matching a Stripe amount" check
  // lived here. It is gone because the ingester no longer creates that
  // shape: a Stripe payment matching exactly one recorded payment is
  // ATTACHED to it, and an ambiguous match raises its own review. Detecting
  // a duplicate is a worse answer than not making one.
  if (recordedMajor > agreedTotal + 0.01) {
    // Both provenances present and the total too high is the duplicate
    // signature — said plainly, because the fix is to remove a record, and
    // no machine should do that on its own.
    if (hasOwnerStated && hasStripeSourced) {
      return `${recordedMajor.toFixed(2)} is recorded against an agreed total of ${agreedTotal.toFixed(2)}, from both an owner-stated payment and a Stripe payment. These are likely the same money recorded twice.`;
    }
    return `${recordedMajor.toFixed(2)} is recorded against an agreed total of ${agreedTotal.toFixed(2)}.`;
  }
  return null;
};

export const ingestStripePayments = async (
  stripe: Stripe,
  params: {
    // Every verified Stripe Customer for this person. Mia Cosme's $3,700
    // arrived as four $925 payments through four different Customer
    // objects; reading only the primary one found $925.
    customerIds: string[];
    dealId: number;
    agreedTotal: number | null;
    existingReviewReason: string | null;
  },
): Promise<PaymentIngestResult> => {
  const byIntent = new Map<string, CollectedPayment>();
  const errors: string[] = [];
  const capabilityWarnings: string[] = [];

  for (const customerId of params.customerIds) {
    const found = await collectPayments(stripe, customerId);
    // Keyed on the PaymentIntent, so the same payment reached through two
    // customer objects is still one payment.
    for (const payment of found.payments) {
      byIntent.set(payment.paymentIntentId, payment);
    }
    errors.push(...found.errors);
    for (const warning of found.capabilityWarnings) {
      if (!capabilityWarnings.includes(warning)) {
        capabilityWarnings.push(warning);
      }
    }
  }

  const payments = [...byIntent.values()].sort((a, b) =>
    a.paidAt.localeCompare(b.paidAt),
  );

  const result: PaymentIngestResult = {
    ingested: 0,
    alreadyRecorded: 0,
    merged: 0,
    ambiguousMerge: 0,
    obligationsSatisfied: 0,
    receivedMinor: payments.reduce((sum, p) => sum + p.amountMinor, 0),
    currency: payments[0]?.currency ?? null,
    lastPaymentAt: payments[payments.length - 1]?.paidAt ?? null,
    reviewReason: null,
    errors,
    capabilityWarnings,
  };

  const { data: existingRows, error: readError } = await supabaseAdmin
    .from("deal_payment_schedule_items")
    .select(
      "id, sequence, amount, status, source, stripe_payment_intent_id, satisfied_by_payment_intent_id",
    )
    .eq("deal_id", params.dealId);
  if (readError) {
    result.errors.push(`deal ${params.dealId}: ${readError.message}`);
    return result;
  }

  const rows = (existingRows ?? []) as {
    id: number;
    sequence: number;
    amount: number | string | null;
    status: string;
    source: string;
    stripe_payment_intent_id: string | null;
    satisfied_by_payment_intent_id: string | null;
  }[];
  const recorded = new Set(
    rows
      .map((r) => r.stripe_payment_intent_id)
      .filter((id): id is string => id != null),
  );
  let nextSequence =
    rows.reduce((max, r) => Math.max(max, r.sequence ?? 0), 0) + 1;

  // Measured BEFORE this sweep inserts anything, so the ledger it compares
  // against is the one that already existed. Reading it afterwards would
  // count each new payment twice.
  const paidRowsBefore = rows.filter((r) => r.status === "paid");
  const alreadyRecordedMajor = paidRowsBefore.reduce(
    (sum, r) => sum + Number(r.amount ?? 0),
    0,
  );
  const hadOwnerStated = paidRowsBefore.some((r) => r.source !== "stripe");
  const hadStripeSourced = paidRowsBefore.some((r) => r.source === "stripe");

  for (const payment of payments) {
    if (recorded.has(payment.paymentIntentId)) {
      result.alreadyRecorded += 1;
      continue;
    }

    // ONE ECONOMIC PAYMENT, ONE ROW.
    //
    // Leif recording a payment and Stripe evidencing the same payment are
    // two facts about one event. Inserting a second row is what recorded
    // Linda Turner as having paid $8,000 on a $4,000 contract. When
    // exactly one unverified owner-stated payment of the same amount is
    // already on this Deal, Stripe's evidence is ATTACHED to it — both
    // provenances kept, the money counted once.
    //
    // More than one candidate is genuinely ambiguous, so nothing is
    // merged and a human is asked instead.
    const candidates = rows.filter(
      (row) =>
        row.status === "paid" &&
        row.source !== "stripe" &&
        row.stripe_payment_intent_id == null &&
        Math.abs(Number(row.amount ?? 0) * 100 - payment.amountMinor) < 1,
    );
    if (candidates.length === 1) {
      const { error } = await supabaseAdmin
        .from("deal_payment_schedule_items")
        .update({
          stripe_payment_intent_id: payment.paymentIntentId,
          verified_by_stripe_at: new Date().toISOString(),
        })
        .eq("id", candidates[0].id);
      if (error) {
        result.errors.push(
          `payment ${payment.paymentIntentId}: ${error.message}`,
        );
        continue;
      }
      candidates[0].stripe_payment_intent_id = payment.paymentIntentId;
      recorded.add(payment.paymentIntentId);
      result.merged += 1;
      continue;
    }
    if (candidates.length > 1) {
      result.ambiguousMerge += 1;
      // Falls through and records the payment on its own row; the caller
      // raises a review rather than guessing which one it matches.
    }
    const { error } = await supabaseAdmin
      .from("deal_payment_schedule_items")
      .insert({
        deal_id: params.dealId,
        amount: payment.amountMinor / 100,
        sequence: nextSequence,
        status: "paid",
        paid_on: payment.paidAt.slice(0, 10),
        source: "stripe",
        stripe_payment_intent_id: payment.paymentIntentId,
      });
    if (error) {
      // A unique-violation means another sweep already recorded it.
      if (error.code === "23505") {
        result.alreadyRecorded += 1;
        continue;
      }
      result.errors.push(
        `payment ${payment.paymentIntentId}: ${error.message}`,
      );
      continue;
    }
    nextSequence += 1;
    result.ingested += 1;

    // A future obligation this payment discharges is no longer future
    // money. The receipt stays on its own row; the obligation records
    // what settled it. One payment may settle several, so this is not a
    // one-to-one link.
    const obligation = rows.find(
      (row) =>
        row.status === "scheduled" &&
        row.satisfied_by_payment_intent_id == null &&
        Math.abs(Number(row.amount ?? 0) * 100 - payment.amountMinor) < 1,
    );
    if (obligation) {
      const { error } = await supabaseAdmin
        .from("deal_payment_schedule_items")
        .update({ satisfied_by_payment_intent_id: payment.paymentIntentId })
        .eq("id", obligation.id);
      if (!error) {
        obligation.satisfied_by_payment_intent_id = payment.paymentIntentId;
        result.obligationsSatisfied += 1;
      }
    }
  }

  const ingestedMajor =
    payments
      .filter((p) => !recorded.has(p.paymentIntentId))
      .reduce((sum, p) => sum + p.amountMinor, 0) / 100;

  const computed = describeLedger({
    stripePayments: payments.length,
    agreedTotal: params.agreedTotal,
    recordedMajor: alreadyRecordedMajor + ingestedMajor,
    hasOwnerStated: hadOwnerStated,
    hasStripeSourced: hadStripeSourced || result.ingested > 0,
    errors: result.errors,
  });

  // A review, once raised, is never lifted by this sweep.
  //
  // The tempting rule — "clear it when nothing looks wrong" — silently
  // erased the one review that mattered. Mia Cosme's linked customer holds
  // a single $925 payment against a $4,000 offer, which looks exactly like
  // an ordinary part-paid plan; the reason it is not is that her other
  // three payments sit on Customer objects the CRM is not linked to, and
  // this sweep cannot see them. Quiet evidence is not an explanation.
  //
  // A human lifts a review, having actually looked.
  // A Stripe payment that could be either of two recorded payments is the
  // one case merging must not guess at.
  const ambiguity =
    result.ambiguousMerge > 0
      ? "A Stripe payment matches more than one payment Leif recorded by hand. They may be the same money; nothing was merged."
      : null;

  result.reviewReason = params.existingReviewReason ?? ambiguity ?? computed;

  return result;
};
