import type { DataProvider, Identifier } from "ra-core";

import type {
  Deal,
  DealPaymentScheduleItem,
  DealStripePlanObject,
} from "../types";

// Where the money stands, in the words Leif uses — reported, never a gate.
//
// An earlier version of this decided whether somebody was Won. Four live
// clients showed why that is wrong: Denise Cormier, Ava Frotton, Linda
// Turner and Emma Wijns were all stuck at Committed with no Enrollment —
// one PAID IN FULL, another already onboarded — purely because the CRM had
// not created their Stripe plan itself.
//
// Sales outcome, payment, enrollment and onboarding are four independent
// dimensions. This one describes payment and nothing else.
//
// The second correction, and the reason this file reads money rather than
// plans: A MISSING SUBSCRIPTION IS NOT EVIDENCE OF A MISSING PAYMENT.
// Emily Loeb paid $3,700 in one go, which creates no subscription at all.
// Jules Litman-Cleper is four installments into six behind a schedule
// Stripe marks "completed". Jess Beauchamp paid all four and then had her
// card removed on purpose. All three read as "Payment setup pending".
//
// So the distinctions that matter, and that the old logic blurred:
//
//   scheduled           is not  active
//   active              is not  paid in full
//   owner-confirmed     is not  Stripe-linked
//   setup pending       is not  unknown
//   no subscription     is not  no payment
//   no card on file     is not  unpaid
//   uncertain           is not  setup pending
//   one subscription    is not  the whole plan
//   transactions        is not  installments
//
// The last two are Jules Litman-Cleper and Jess Beauchamp. Jules agreed
// six payments of $666; his first subscription was built with only four
// cycles, ended, and a replacement now carries the remaining two — so his
// plan is neither finished nor missing. Jess agreed four installments and
// paid them in three transactions, one of which covered two.
export type PaymentState =
  | "paid_in_full"
  | "active_plan"
  | "scheduled_plan"
  | "owner_confirmed_plan"
  | "setup_pending"
  // Something does not add up and a human must look. It exists so that
  // uncertainty is never quietly filed as "this person owes you a payment
  // plan", which is what setup_pending reads as.
  | "needs_review"
  | "unknown";

export type PaymentStatus = {
  state: PaymentState;
  // The one-line headline, e.g. "Scheduled payment plan".
  headline: string;
  // Supporting facts, each already true — never a guess. e.g.
  // "Starts Sep 30, 2026", "4 of 6 payments received".
  detail: string[];
  // The single operational thing still to do, when there is one.
  outstanding: string | null;
  stripeLinked: boolean;
  // Why a human is being asked to look, verbatim. Shown alongside a
  // confident state too: "paid in full, but check this" is a real answer.
  reviewReason: string | null;
  // Where the figure that "paid in full" is measured against came from.
  // Every historical LE Opportunity carries the CURRENT $4,000 list price
  // from the import, and LE used to be $3,700 — so a list-price total is
  // reported as exactly that, never as the agreed price.
  agreedTotal: number | null;
  agreedTotalSource: "deal" | "offer_list_price" | "none";
  // Installments satisfied, which is not the number of transactions.
  installmentsSatisfied: number;
  installmentsAgreed: number;
  collected: number;
};

// due_date and paid_on are date-only. Passing "2026-09-30" to Date() parses
// it as UTC midnight, which renders as the 29th anywhere behind UTC — so a
// plan starting on the 30th would be shown starting a day early. Reading
// the parts directly keeps the day the day.
const formatDate = (value: string): string => {
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

const formatMoney = (amount: number): string =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);

const unknownStatus = (headline: string): PaymentStatus => ({
  state: "unknown",
  headline,
  detail: [],
  outstanding: null,
  stripeLinked: false,
  reviewReason: null,
  agreedTotal: null,
  agreedTotalSource: "none",
  installmentsSatisfied: 0,
  installmentsAgreed: 0,
  collected: 0,
});

export const assessPaymentStatus = async (
  dataProvider: DataProvider,
  opportunityId: Identifier,
): Promise<PaymentStatus> => {
  const { data: deal } = await dataProvider
    .getOne<Deal>("deals", { id: opportunityId })
    .catch(() => ({ data: null as Deal | null }));
  if (!deal) return unknownStatus("Payment status unknown");

  const { data: items } = await dataProvider
    .getList<DealPaymentScheduleItem>("deal_payment_schedule_items", {
      filter: { deal_id: opportunityId },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "sequence", order: "ASC" },
    })
    .catch(() => ({ data: [] as DealPaymentScheduleItem[] }));

  // Every Stripe object that has carried this plan, live or ended.
  const { data: planRows } = await dataProvider
    .getList<DealStripePlanObject>("deal_stripe_plan_objects", {
      filter: { deal_id: opportunityId },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    })
    .catch(() => ({ data: [] as DealStripePlanObject[] }));

  return derivePaymentStatus(deal, items ?? [], planRows ?? []);
};

// The same answer, from rows already in hand.
//
// The Kanban has to know every Won client's payment state at once to draw
// the Onboarding column, and asking per Opportunity would be sixty-odd
// round trips. Both callers share this so the board and the drawer can
// never disagree about the same person.
export const derivePaymentStatus = (
  deal: Deal,
  items: DealPaymentScheduleItem[],
  planObjects: DealStripePlanObject[],
): PaymentStatus => {
  const scheduleItems = items ?? [];
  const paid = scheduleItems.filter((i) => i.status === "paid");
  const scheduled = scheduleItems.filter((i) => i.status === "scheduled");

  const paidTotal = paid.reduce((sum, i) => sum + Number(i.amount ?? 0), 0);

  // A Deal-specific total is authoritative. The Offer's list price is only
  // a fallback, and is reported as such: every historical LE Opportunity
  // carries today's $4,000 from the import, and LE used to sell at $3,700.
  const agreedTotalSource: PaymentStatus["agreedTotalSource"] =
    deal.selected_payment_total != null
      ? "deal"
      : deal.offer_price_snapshot != null
        ? "offer_list_price"
        : "none";
  const agreed = Number(
    deal.selected_payment_total ?? deal.offer_price_snapshot ?? 0,
  );
  const expectedCount = Number(deal.selected_installment_count ?? 0);
  const installmentAmount = Number(deal.selected_installment_amount ?? 0);

  // Installments satisfied come from the MONEY, not from how many times a
  // card was charged. Jess Beauchamp's four installments arrived as three
  // transactions, because one payment of $2,000 covered two of them.
  const installmentsSatisfied =
    installmentAmount > 0
      ? Math.min(
          expectedCount > 0 ? expectedCount : Number.MAX_SAFE_INTEGER,
          Math.round(paidTotal / installmentAmount),
        )
      : paid.length;

  // A live plan is one kind of Stripe evidence. Collected money is
  // another, and it survives the plan being completed or cancelled.
  const planLinked = Boolean(
    deal.stripe_subscription_id ||
      deal.stripe_subscription_schedule_id ||
      planObjects.some((o) => o.is_current),
  );
  // More than one subscription behind one agreement means an earlier plan
  // was replaced — worth saying, because "your subscription ended" and
  // "you have finished paying" are different facts.
  const replacedPlan =
    planObjects.filter((o) => o.object_type === "subscription").length > 1;
  const moneyFromStripe = paid.some(
    (i) => i.source === "stripe" || i.stripe_payment_intent_id != null,
  );
  const stripeLinked = planLinked || moneyFromStripe;
  const reviewReason = deal.payment_review_reason ?? null;

  const provenance = moneyFromStripe
    ? "Confirmed in Stripe"
    : planLinked
      ? "Stripe linked"
      : "Recorded outside Stripe";

  const measures = {
    agreedTotal: agreedTotalSource === "none" ? null : agreed,
    agreedTotalSource,
    installmentsSatisfied,
    installmentsAgreed: expectedCount,
    collected: paidTotal,
  };

  const base = classify({
    deal,
    paid,
    scheduled,
    paidTotal,
    agreed,
    expectedCount,
    installmentsSatisfied,
    planLinked,
    stripeLinked,
    replacedPlan,
    provenance,
  });

  if (!reviewReason) return { ...base, ...measures, reviewReason: null };

  // A review outranks every state except a payment that fully reconciles
  // against agreed terms. Mia Cosme is why: her linked customer shows one
  // $925 payment, which looks exactly like an ordinary part-paid plan.
  // Calling that "Active payment plan" would state a fact nobody has
  // established.
  if (base.state === "paid_in_full")
    return { ...base, ...measures, reviewReason };

  return {
    state: "needs_review",
    headline: "Payment status needs review",
    detail: base.detail,
    outstanding: "Check this before acting on it",
    stripeLinked,
    reviewReason,
    ...measures,
  };
};

type Classified = Pick<
  PaymentStatus,
  "state" | "headline" | "detail" | "outstanding" | "stripeLinked"
>;

const classify = ({
  deal,
  paid,
  scheduled,
  paidTotal,
  agreed,
  expectedCount,
  installmentsSatisfied,
  planLinked,
  stripeLinked,
  replacedPlan,
  provenance,
}: {
  deal: Deal;
  paid: DealPaymentScheduleItem[];
  scheduled: DealPaymentScheduleItem[];
  paidTotal: number;
  agreed: number;
  expectedCount: number;
  installmentsSatisfied: number;
  planLinked: boolean;
  stripeLinked: boolean;
  replacedPlan: boolean;
  provenance: string;
}): Classified => {
  // Paid in full outranks everything: the money is in, however it arrived
  // — one payment, four installments, or outside Stripe entirely. Nothing
  // about a card on file enters into it.
  if (paid.length > 0 && agreed > 0 && paidTotal >= agreed) {
    const paidOn = paid[paid.length - 1]?.paid_on ?? null;
    return {
      state: "paid_in_full",
      headline: "Paid in full",
      detail: [
        // What was agreed, satisfied — not how many times a card was
        // charged. Jess's four installments arrived in three payments.
        ...(expectedCount > 1
          ? [`${expectedCount} of ${expectedCount} installments paid`]
          : []),
        ...(paid.length > 1 ? [`${paid.length} transactions`] : []),
        ...(paidOn ? [`Settled ${formatDate(paidOn)}`] : []),
        provenance,
      ],
      outstanding: null,
      stripeLinked,
    };
  }

  // Money is arriving. This is true whether or not the subscription that
  // produced it is still live — Jules's schedule reads "completed" and he
  // is four of six installments in.
  if (paid.length > 0) {
    const remaining = agreed > 0 ? agreed - paidTotal : 0;
    const remainingCount =
      expectedCount > installmentsSatisfied
        ? expectedCount - installmentsSatisfied
        : 0;
    return {
      state: "active_plan",
      headline: "Active payment plan",
      detail: [
        expectedCount > 0
          ? `${installmentsSatisfied} of ${expectedCount} installments paid`
          : `${paid.length} payment${paid.length === 1 ? "" : "s"} received`,
        `${formatMoney(paidTotal)} collected`,
        // Said plainly, because a client whose first subscription ended is
        // otherwise indistinguishable from one who has finished paying.
        ...(replacedPlan
          ? [
              planLinked
                ? "Replacement Stripe subscription carrying the rest"
                : "Earlier Stripe subscription ended",
            ]
          : []),
        provenance,
      ],
      outstanding:
        remaining > 0
          ? remainingCount > 0
            ? `${formatMoney(remaining)} remaining over ${remainingCount} payment${remainingCount === 1 ? "" : "s"}`
            : `${formatMoney(remaining)} remaining`
          : null,
      stripeLinked,
    };
  }

  // A schedule with no payment taken yet is SCHEDULED. Saying "no payment
  // plan" here is the defect this state machine exists to remove — Denise
  // and Ava both read that way for weeks.
  if (planLinked) {
    const startsFrom = scheduled.find((i) => i.due_date)?.due_date ?? null;
    return {
      state: "scheduled_plan",
      headline: "Scheduled payment plan",
      detail: [
        ...(startsFrom ? [`Starts ${formatDate(startsFrom)}`] : []),
        "Stripe linked",
      ],
      outstanding: null,
      stripeLinked,
    };
  }

  // Terms Leif has stated, with no Stripe record to back them yet. Real
  // truth, explicitly not the same as a linked plan.
  if (scheduled.length > 0) {
    return {
      state: "owner_confirmed_plan",
      headline: "Payment plan — owner confirmed",
      detail: [`${scheduled.length} scheduled`],
      outstanding: "Stripe link pending",
      stripeLinked: false,
    };
  }

  // Nothing anywhere, and we looked. For a Won Opportunity that is a real
  // outstanding job — Emma Wijns is onboarded and this is all that is left
  // for her. Reached only when no payment and no review exist, so it never
  // stands in for uncertainty.
  if (deal.stage === "won") {
    return {
      state: "setup_pending",
      headline: "Payment setup pending",
      detail: [],
      outstanding: "Create payment plan",
      stripeLinked: false,
    };
  }

  return {
    state: "unknown",
    headline: "Payment truth unknown",
    detail: [],
    outstanding: null,
    stripeLinked: false,
  };
};
