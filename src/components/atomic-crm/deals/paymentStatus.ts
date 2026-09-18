import type { DataProvider, Identifier } from "ra-core";

import type { Deal, DealPaymentScheduleItem } from "../types";

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
// The distinctions that matter, and that the old established/outstanding
// lists blurred:
//
//   scheduled          is not  active
//   active             is not  paid in full
//   owner-confirmed    is not  Stripe-linked
//   setup pending      is not  unknown
//
// A Subscription Schedule exists, with a real start date, BEFORE its first
// payment — so a scheduled plan is a knowable state, not an absence.
export type PaymentState =
  | "paid_in_full"
  | "active_plan"
  | "scheduled_plan"
  | "owner_confirmed_plan"
  | "setup_pending"
  | "unknown";

export type PaymentStatus = {
  state: PaymentState;
  // The one-line headline, e.g. "Scheduled payment plan".
  headline: string;
  // Supporting facts, each already true — never a guess. e.g.
  // "Starts Sep 30, 2026", "Stripe linked".
  detail: string[];
  // The single operational thing still to do, when there is one.
  outstanding: string | null;
  stripeLinked: boolean;
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export const assessPaymentStatus = async (
  dataProvider: DataProvider,
  opportunityId: Identifier,
): Promise<PaymentStatus> => {
  const { data: deal } = await dataProvider
    .getOne<Deal>("deals", { id: opportunityId })
    .catch(() => ({ data: null as Deal | null }));
  if (!deal) {
    return {
      state: "unknown",
      headline: "Payment status unknown",
      detail: [],
      outstanding: null,
      stripeLinked: false,
    };
  }

  const { data: items } = await dataProvider
    .getList<DealPaymentScheduleItem>("deal_payment_schedule_items", {
      filter: { deal_id: opportunityId },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "sequence", order: "ASC" },
    })
    .catch(() => ({ data: [] as DealPaymentScheduleItem[] }));

  const scheduleItems = items ?? [];
  const paid = scheduleItems.filter((i) => i.status === "paid");
  const scheduled = scheduleItems.filter((i) => i.status === "scheduled");
  const stripeLinked = Boolean(
    deal.stripe_subscription_id || deal.stripe_subscription_schedule_id,
  );

  const paidTotal = paid.reduce((sum, i) => sum + Number(i.amount ?? 0), 0);
  const agreed = Number(
    deal.selected_payment_total ?? deal.offer_price_snapshot ?? 0,
  );

  // Paid in full outranks everything: the money is in, however it arrived.
  if (paid.length > 0 && agreed > 0 && paidTotal >= agreed) {
    return {
      state: "paid_in_full",
      headline: "Paid in full",
      detail: stripeLinked ? ["Stripe linked"] : ["Recorded outside Stripe"],
      outstanding: null,
      stripeLinked,
    };
  }

  if (stripeLinked) {
    // A schedule with no payment taken yet is SCHEDULED. Saying "no
    // payment plan" here is the defect this whole state machine exists to
    // remove — Denise and Ava both read that way for weeks.
    const startsFrom = scheduled.find((i) => i.due_date)?.due_date ?? null;
    const isScheduledOnly = paid.length === 0;

    return {
      state: isScheduledOnly ? "scheduled_plan" : "active_plan",
      headline: isScheduledOnly
        ? "Scheduled payment plan"
        : "Active payment plan",
      detail: [
        ...(startsFrom ? [`Starts ${formatDate(startsFrom)}`] : []),
        ...(paid.length > 0
          ? [`${paid.length} payment${paid.length === 1 ? "" : "s"} received`]
          : []),
        "Stripe linked",
      ],
      outstanding: null,
      stripeLinked,
    };
  }

  // Terms Leif has stated, with no Stripe record to back them yet. Real
  // truth, explicitly not the same as a linked plan.
  if (scheduled.length > 0 || paid.length > 0) {
    return {
      state: "owner_confirmed_plan",
      headline: "Payment plan — owner confirmed",
      detail: [
        ...(paid.length > 0 ? [`${paid.length} paid`] : []),
        ...(scheduled.length > 0 ? [`${scheduled.length} scheduled`] : []),
      ],
      outstanding: "Stripe link pending",
      stripeLinked: false,
    };
  }

  // Nothing anywhere. For a Won Opportunity that is a real outstanding
  // job — Emma Wijns is onboarded and this is the only thing left for her.
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
    headline: "No payment terms agreed yet",
    detail: [],
    outstanding: null,
    stripeLinked: false,
  };
};
