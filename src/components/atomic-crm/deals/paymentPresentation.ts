import type { PaymentTruth } from "./paymentTruth";

// How payment truth is said, once, so two surfaces cannot word the same
// facts into different claims.
//
// Every string here is derived from `PaymentTruth` and nothing else. The
// rule that matters: nothing may assert money was received unless
// `collected` says so. The sentence "First payment of $175 received" was
// generated from an installment plan with no payment behind it, and this
// module exists so there is nowhere left to write one.

export type PaymentPresentation = {
  headline: string;
  detail: string[];
  // The single operational thing left to do, when there is one.
  outstanding: string | null;
};

export const formatMoney = (amount: number): string =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);

// due_date and paid_on are date-only. Passing "2026-09-22" to Date()
// parses it as UTC midnight, which renders as the 21st anywhere behind
// UTC, so a plan starting on the 22nd would be shown starting a day early.
export const formatPaymentDate = (value: string): string => {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      )
    : new Date(value);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// The agreed structure, stated as structure. "4 × $175" is terms; "first
// payment received" would be a receipt, and terms are not receipts.
export const describeAgreedTerms = (truth: PaymentTruth): string | null => {
  if (!truth.termsKnown) return null;
  const total = formatMoney(truth.agreedTotal!);
  if (
    truth.agreedInstallmentCount != null &&
    truth.agreedInstallmentCount > 1 &&
    truth.agreedInstallmentAmount != null
  ) {
    return `${total} — ${truth.agreedInstallmentCount} × ${formatMoney(truth.agreedInstallmentAmount)}`;
  }
  return `${total} — single payment`;
};

const describeProgress = (truth: PaymentTruth): string =>
  truth.installmentProgressKnown
    ? `${truth.installmentsSatisfied} of ${truth.agreedInstallmentCount} installments paid`
    : // Without equal agreed installments there is no honest X of Y, so
      // the amounts are shown instead of a fabricated fraction.
      `${formatMoney(truth.collected)} collected`;

export const presentPayment = (
  truth: PaymentTruth,
  options: { nextChargeOn?: string | null } = {},
): PaymentPresentation => {
  const nextCharge = options.nextChargeOn
    ? `First charge ${formatPaymentDate(options.nextChargeOn)}`
    : null;

  switch (truth.state) {
    case "paid_in_full":
      return {
        headline: "Paid in full",
        detail: [
          ...(truth.installmentProgressKnown &&
          truth.agreedInstallmentCount! > 1
            ? [
                `${truth.agreedInstallmentCount} of ${truth.agreedInstallmentCount} installments paid`,
              ]
            : []),
          `${formatMoney(truth.collected)} collected`,
          truth.stripeLinked
            ? "Confirmed in Stripe"
            : "Recorded outside Stripe",
        ],
        outstanding: null,
      };

    case "active_plan":
      return {
        headline: "Active payment plan",
        detail: [
          describeProgress(truth),
          `${formatMoney(truth.collected)} collected`,
          // A client whose first subscription ended is otherwise
          // indistinguishable from one who has finished paying.
          ...(truth.planReplaced
            ? [
                truth.hasCurrentPlan
                  ? "Replacement Stripe subscription carrying the rest"
                  : "Earlier Stripe subscription ended",
              ]
            : []),
          ...(truth.hasCurrentPlan ? [] : ["No live Stripe plan"]),
        ],
        outstanding:
          truth.remaining != null && truth.remaining > 0
            ? `${formatMoney(truth.remaining)} remaining`
            : null,
      };

    case "scheduled_plan":
      return {
        headline: "Scheduled payment plan",
        detail: [
          // Said in the order that prevents the old mistake: nothing has
          // been collected, and here is what is arranged.
          `${formatMoney(truth.collected)} paid`,
          ...(truth.termsKnown &&
          truth.agreedInstallmentCount != null &&
          truth.agreedInstallmentCount > 1 &&
          truth.agreedInstallmentAmount != null
            ? [
                `${truth.agreedInstallmentCount} × ${formatMoney(truth.agreedInstallmentAmount)} scheduled`,
              ]
            : truth.futureScheduled > 0
              ? [`${formatMoney(truth.futureScheduled)} scheduled`]
              : []),
          ...(nextCharge ? [nextCharge] : []),
          ...(truth.stripeLinked ? ["Stripe linked"] : []),
        ],
        outstanding: null,
      };

    case "setup_pending":
      return {
        headline: "Payment setup pending",
        detail: truth.termsKnown
          ? [describeAgreedTerms(truth)!, `${formatMoney(0)} paid`]
          : [],
        outstanding: "Create payment plan",
      };

    case "needs_review":
      return {
        headline: "Payment status needs review",
        detail: [
          ...(truth.termsKnown
            ? [describeAgreedTerms(truth)!]
            : ["Agreed terms not recorded"]),
          `${formatMoney(truth.collected)} collected`,
        ],
        outstanding: "Check this before acting on it",
      };

    case "unknown":
    default:
      return {
        headline: "Payment truth unknown",
        detail: [],
        outstanding: null,
      };
  }
};

// The review question, rendered against CURRENT figures rather than
// against amounts frozen into a sentence when it was raised.
export const describeReview = (truth: PaymentTruth): string | null => {
  if (truth.reviewCode == null && truth.reviewReason == null) return null;
  switch (truth.reviewCode) {
    case "terms_unknown":
      return "No agreed total is recorded for this Opportunity.";
    case "evidence_incomplete":
      return "Stripe evidence is incomplete, so payment cannot be confirmed either way.";
    case "collected_exceeds_agreed":
      return `${formatMoney(truth.collected)} is recorded against an agreed total of ${truth.agreedTotal != null ? formatMoney(truth.agreedTotal) : "an unrecorded amount"}.`;
    case "duplicate_economic_payment":
      return "The same money appears to be recorded twice, from two provenances.";
    case "identity_unresolved":
      return "Payments were found on a Stripe customer this person is not linked to.";
    case "owner_flagged":
    default:
      return truth.reviewReason;
  }
};
