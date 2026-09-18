import type { DataProvider, Identifier } from "ra-core";

import type { Deal, DealPaymentScheduleItem } from "../types";

// Where the money stands — reported, never used as a gate.
//
// This deliberately does NOT decide whether somebody is Won. An earlier
// version did, and four live clients showed why that is wrong: Denise
// Cormier, Ava Frotton, Linda Turner and Emma Wijns were all stuck at
// Committed with no Enrollment — one PAID IN FULL, another already
// onboarded — purely because the CRM had not created their Stripe plan
// itself. Sales outcome, payment, enrollment and onboarding are four
// independent dimensions, and none of them may overwrite another.
//
// What this answers is the question the Opportunity and Client drawers
// need: what is established, and what is still outstanding, so neither
// screen is a dead end and "agreed" is never shown as "paid".
export type PaymentStatus = {
  // True when something external confirms money is arranged. Used to
  // describe state and to decide whether to nudge, never to decide Won.
  hasArrangement: boolean;
  // What is actually established, in Leif's words, for the drawer to show.
  established: string[];
  // What is missing, so Committed can say what it is waiting for.
  missing: string[];
};

export const assessPaymentStatus = async (
  dataProvider: DataProvider,
  opportunityId: Identifier,
): Promise<PaymentStatus> => {
  const { data: deal } = await dataProvider
    .getOne<Deal>("deals", { id: opportunityId })
    .catch(() => ({ data: null as Deal | null }));
  if (!deal) {
    return { hasArrangement: false, established: [], missing: ["Opportunity"] };
  }

  const { data: items } = await dataProvider
    .getList<DealPaymentScheduleItem>("deal_payment_schedule_items", {
      filter: { deal_id: opportunityId },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "sequence", order: "ASC" },
    })
    .catch(() => ({ data: [] as DealPaymentScheduleItem[] }));

  const established: string[] = [];
  const missing: string[] = [];

  const hasSubscription = Boolean(deal.stripe_subscription_id);
  const hasSchedule = Boolean(deal.stripe_subscription_schedule_id);
  const paidItems = (items ?? []).filter((item) => item.status === "paid");
  const scheduledItems = (items ?? []).filter(
    (item) => item.status === "scheduled",
  );

  if (hasSubscription) established.push("Stripe subscription linked");
  if (hasSchedule) established.push("Stripe payment schedule linked");
  if (paidItems.length > 0) {
    established.push(
      `${paidItems.length} payment${paidItems.length === 1 ? "" : "s"} recorded as paid`,
    );
  }
  if (scheduledItems.length > 0) {
    // Scheduled is explicitly NOT authority — it is a promise, and saying
    // otherwise is the exact conflation Leif has corrected before
    // (agreed / paid / scheduled are three different things).
    established.push(
      `${scheduledItems.length} payment${scheduledItems.length === 1 ? "" : "s"} scheduled`,
    );
  }

  if (!hasSubscription && !hasSchedule) {
    missing.push("No Stripe subscription or payment schedule linked");
  }
  if (paidItems.length === 0) {
    missing.push("No payment recorded as received");
  }
  if (!deal.offer_page_token) {
    missing.push("Offer page not yet created");
  }

  return {
    hasArrangement: hasSubscription || hasSchedule || paidItems.length > 0,
    established,
    missing,
  };
};
