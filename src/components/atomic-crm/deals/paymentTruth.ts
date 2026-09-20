import type {
  Deal,
  DealPaymentScheduleItem,
  DealStripePlanObject,
} from "../types";

// The one place that decides what is true about a person's money.
//
// There were three. A panel computed the agreed total from the Deal with a
// fallback to the Offer's current list price; a card computed it by summing
// the ledger, so a part-paid client's "agreed total" was whatever they had
// paid so far; and a formatter announced "First payment of $X received"
// from the installment structure alone, with no row behind it at all.
//
// They disagreed on live clients. Jules Litman-Cleper read "settled, $0.00
// outstanding" and "5 of 6 · $666 remaining" on the same screen. Sam Milz,
// who has paid nothing, was told his first $175 had been received.
//
// So: one module, and every surface calls it. The rules below are the
// whole of the business logic, and nothing downstream may re-derive them.
//
//   AGREED comes from the Deal and only the Deal. The Offer's list price
//   is a fact about the product, not about this person — LE has sold at
//   $3,700 and at $4,000, and every historical Opportunity carries today's
//   price from the import. Terms we do not know are UNKNOWN, never
//   substituted.
//
//   COLLECTED is actual money. A subscription, a schedule, a SetupIntent,
//   a saved card, a scholarship and an installment plan are not money.
//
//   REMAINING is agreed minus collected. Not ledger minus paid: the ledger
//   is a record of events, not the agreement.
//
//   INSTALLMENTS SATISFIED is collected DIVIDED BY the agreed installment
//   amount, floored. Not the number of transactions — Jess Beauchamp paid
//   four installments with three payments — and never rounded up, because
//   $600 toward a $1,000 installment is no installments.
//
//   PAID IN FULL needs known terms. "Every row happens to be paid" is not
//   proof; that is what called Jules settled.

export type PaymentState =
  | "paid_in_full"
  | "active_plan"
  | "scheduled_plan"
  | "setup_pending"
  | "needs_review"
  | "unknown";

export type PaymentReviewCode =
  | "terms_unknown"
  | "evidence_incomplete"
  | "collected_exceeds_agreed"
  | "duplicate_economic_payment"
  | "identity_unresolved"
  | "owner_flagged";

export type PaymentTruth = {
  // --- what was agreed -------------------------------------------------
  agreedTotal: number | null;
  agreedInstallmentCount: number | null;
  agreedInstallmentAmount: number | null;
  termsKnown: boolean;

  // --- what actually happened -----------------------------------------
  collected: number;
  // Obligations still ahead: scheduled rows no payment has discharged.
  futureScheduled: number;
  // Null when terms are unknown, because "remaining" would be a guess.
  remaining: number | null;

  // --- progress --------------------------------------------------------
  installmentsSatisfied: number | null;
  installmentProgressKnown: boolean;

  // --- the arrangement -------------------------------------------------
  hasCurrentPlan: boolean;
  planReplaced: boolean;
  stripeLinked: boolean;

  // --- verdicts --------------------------------------------------------
  paidInFull: boolean;
  paymentSetupComplete: boolean;
  state: PaymentState;
  reviewCode: PaymentReviewCode | null;
  reviewReason: string | null;
};

// Money compares in cents. Floating point on decimal currency is how a
// $700.00 payment against a $700 agreement fails to be paid in full.
export const CENTS = (value: number): number => Math.round(value * 100);
// Half a cent, so arithmetic noise never decides a verdict.
export const TOLERANCE = 0.5;

const number = (value: unknown): number | null => {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const assessPaymentTruth = ({
  deal,
  scheduleItems,
  planObjects,
}: {
  deal: Pick<
    Deal,
    | "id"
    | "stage"
    | "selected_payment_total"
    | "selected_installment_count"
    | "selected_installment_amount"
    | "stripe_subscription_id"
    | "stripe_subscription_schedule_id"
    | "payment_review_reason"
  > &
    Partial<Pick<Deal, "payment_review_code" | "payment_setup_confirmed_at">>;
  scheduleItems: DealPaymentScheduleItem[];
  planObjects: DealStripePlanObject[];
}): PaymentTruth => {
  // --- agreed ----------------------------------------------------------
  const agreedTotal = number(deal.selected_payment_total);
  const agreedInstallmentCount = number(deal.selected_installment_count);
  const agreedInstallmentAmount = number(deal.selected_installment_amount);
  const termsKnown = agreedTotal != null && CENTS(agreedTotal) > 0;

  // --- money -----------------------------------------------------------
  const paid = scheduleItems.filter((item) => item.status === "paid");
  const collectedCents = paid.reduce(
    (sum, item) => sum + CENTS(Number(item.amount ?? 0)),
    0,
  );
  const collected = collectedCents / 100;

  // A scheduled obligation a payment has already discharged is history,
  // not a future commitment.
  const futureScheduledCents = scheduleItems
    .filter(
      (item) =>
        item.status === "scheduled" &&
        item.satisfied_by_payment_intent_id == null,
    )
    .reduce((sum, item) => sum + CENTS(Number(item.amount ?? 0)), 0);
  const futureScheduled = futureScheduledCents / 100;

  const remaining = termsKnown
    ? Math.max(CENTS(agreedTotal!) - collectedCents, 0) / 100
    : null;

  // --- progress --------------------------------------------------------
  const installmentAmountCents =
    agreedInstallmentAmount != null ? CENTS(agreedInstallmentAmount) : 0;
  const installmentProgressKnown =
    installmentAmountCents > 0 && (agreedInstallmentCount ?? 0) > 0;
  const installmentsSatisfied = installmentProgressKnown
    ? Math.min(
        agreedInstallmentCount!,
        // Floored, never rounded: a part-paid installment is not paid.
        Math.floor((collectedCents + TOLERANCE) / installmentAmountCents),
      )
    : null;

  // --- arrangement -----------------------------------------------------
  const hasCurrentPlan =
    planObjects.some((object) => object.is_current) ||
    Boolean(
      deal.stripe_subscription_id || deal.stripe_subscription_schedule_id,
    );
  const planReplaced =
    planObjects.filter((object) => object.object_type === "subscription")
      .length > 1;
  const stripeLinked =
    hasCurrentPlan ||
    planObjects.length > 0 ||
    paid.some(
      (item) =>
        item.source === "stripe" || item.stripe_payment_intent_id != null,
    );

  // --- verdicts --------------------------------------------------------
  const paidInFull =
    termsKnown && collectedCents + TOLERANCE >= CENTS(agreedTotal!);

  // Setup is about whether an arrangement EXISTS, never about how much has
  // been collected under it. A six-month plan with five payments to come is
  // set up. A single historical payment with no live plan is not.
  const ownerConfirmedSetup = deal.payment_setup_confirmed_at != null;
  const paymentSetupComplete =
    paidInFull || hasCurrentPlan || ownerConfirmedSetup;

  const storedReason = deal.payment_review_reason ?? null;
  const storedCode = (deal.payment_review_code ??
    null) as PaymentReviewCode | null;

  // A sold Opportunity whose terms nobody recorded cannot be described.
  // Saying "setup pending" there would be a claim; saying the list price
  // would be a different person's number.
  const termsMissingOnSale =
    deal.stage === "won" && !termsKnown && storedReason == null;

  const reviewCode: PaymentReviewCode | null = termsMissingOnSale
    ? "terms_unknown"
    : storedCode;
  const reviewReason = termsMissingOnSale
    ? "No agreed total is recorded for this Opportunity."
    : storedReason;

  const base: PaymentState = paidInFull
    ? "paid_in_full"
    : collectedCents > 0
      ? "active_plan"
      : hasCurrentPlan || ownerConfirmedSetup
        ? "scheduled_plan"
        : deal.stage === "won"
          ? "setup_pending"
          : "unknown";

  // A review outranks everything except money that fully reconciles
  // against known terms — the one conclusion an open question cannot
  // undo.
  const state: PaymentState =
    (reviewCode != null || reviewReason != null) && !paidInFull
      ? "needs_review"
      : base;

  return {
    agreedTotal,
    agreedInstallmentCount,
    agreedInstallmentAmount,
    termsKnown,
    collected,
    futureScheduled,
    remaining,
    installmentsSatisfied,
    installmentProgressKnown,
    hasCurrentPlan,
    planReplaced,
    stripeLinked,
    paidInFull,
    paymentSetupComplete,
    state,
    reviewCode,
    reviewReason,
  };
};
