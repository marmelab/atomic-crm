import type Stripe from "npm:stripe@18.5.0";

import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { ingestStripePayments } from "./stripePayments.ts";
import { recordPlanObjects } from "./stripePlanObjects.ts";

// Periodic Stripe reconciliation: the half the webhook cannot do.
//
// This CRM's Stripe webhook subscribes to exactly one event —
// checkout.session.completed — so it only ever learns about payment plans
// the CRM itself created. A subscription or Subscription Schedule set up
// by hand in the Stripe dashboard emits nothing it listens to, and the
// plan simply does not exist as far as the CRM is concerned.
//
// That is not a hypothetical. Denise Cormier and Ava Frotton each have a
// scheduled plan in Stripe and a stripe_customer_id on their Contact, and
// their Opportunities still read "no payment plan" because nothing ever
// linked the two.
//
// So, the same shape as the Acuity reconciliation: the webhook keeps its
// low-latency job, and this runs on a schedule doing the work from the
// other direction — ask Stripe what is true for each customer we already
// know, and make the CRM agree.
//
// Two rules make it safe to run forever:
//
//   IDEMPOTENT. Every decision keys on Stripe's own ids. A second run
//   against unchanged Stripe data writes nothing.
//
//   STRIPE OWNS STRIPE FIELDS, AND ONLY ONCE LINKED. A schedule's start
//   date, cadence, amount and status come from Stripe and the CRM mirrors
//   them. Where no Stripe record can be matched, owner-stated truth —
//   Linda Turner's paid-in-full — is left exactly as it is rather than
//   being erased by an empty answer.

export type StripeReconcileDelta = {
  customersScanned: number;
  schedulesLinked: number;
  subscriptionsLinked: number;
  paymentStatesUpdated: number;
  paymentsIngested: number;
  paymentsAlreadyRecorded: number;
  planObjectsRecorded: number;
  planObjectsUpdated: number;
  needsReview: { contactId: number; reason: string }[];
  alreadyLinked: number;
  noStripePlan: number;
  ambiguous: { contactId: number; candidates: string[] }[];
  errors: string[];
  capabilityWarnings: string[];
};

const emptyDelta = (): StripeReconcileDelta => ({
  customersScanned: 0,
  schedulesLinked: 0,
  subscriptionsLinked: 0,
  paymentStatesUpdated: 0,
  paymentsIngested: 0,
  paymentsAlreadyRecorded: 0,
  planObjectsRecorded: 0,
  planObjectsUpdated: 0,
  needsReview: [],
  alreadyLinked: 0,
  noStripePlan: 0,
  ambiguous: [],
  errors: [],
  capabilityWarnings: [],
});

type Candidate = {
  contactId: number;
  // Every Stripe Customer verified as this person's. Mia Cosme has five;
  // most people have one. Reading only the primary is what hid three of
  // her four payments.
  customerIds: string[];
  dealId: number;
  currentSubscriptionId: string | null;
  currentScheduleId: string | null;
  agreedTotal: number | null;
  reviewReason: string | null;
};

// Only people whose Stripe Customers have been VERIFIED as theirs — the
// contact_stripe_customers relation. Email matching is deliberately not an
// authority here: an address is a discovery hint, and guessing from one is
// exactly the kind of match that attaches somebody else's money to the
// wrong person. Every row in that relation got there through a checkout,
// a webhook, an import, or Leif saying so.
const loadCandidates = async (contactId?: number): Promise<Candidate[]> => {
  let identityQuery = supabaseAdmin
    .from("contact_stripe_customers")
    .select("contact_id, stripe_customer_id");
  if (contactId != null)
    identityQuery = identityQuery.eq("contact_id", contactId);

  const { data: identities } = await identityQuery;
  const byContact = new Map<number, string[]>();
  for (const row of (identities ?? []) as {
    contact_id: number;
    stripe_customer_id: string;
  }[]) {
    const list = byContact.get(row.contact_id) ?? [];
    list.push(row.stripe_customer_id);
    byContact.set(row.contact_id, list);
  }

  const rows = [...byContact.keys()].map((id) => ({ id }));
  if (rows.length === 0) return [];

  const { data: deals } = await supabaseAdmin
    .from("deals")
    .select(
      "id, contact_id, stage, outcome, archived_at, stripe_subscription_id, stripe_subscription_schedule_id, selected_payment_total, offer_price_snapshot, payment_review_reason",
    )
    .in(
      "contact_id",
      rows.map((r) => r.id),
    );

  const candidates: Candidate[] = [];
  for (const contact of rows) {
    const customerIds = byContact.get(contact.id) ?? [];
    if (customerIds.length === 0) continue;
    // The Opportunity a payment plan belongs to is the one that was sold:
    // Won, or still live. An exited Opportunity is not given somebody's
    // active subscription.
    const owned = ((deals ?? []) as Record<string, unknown>[]).filter(
      (d) =>
        d.contact_id === contact.id &&
        d.archived_at == null &&
        (d.stage === "won" || d.outcome == null),
    );
    if (owned.length !== 1) {
      if (owned.length > 1) {
        candidates.push({
          contactId: contact.id,
          customerIds,
          dealId: -1,
          currentSubscriptionId: null,
          currentScheduleId: null,
          agreedTotal: null,
          reviewReason: null,
        });
      }
      continue;
    }
    const deal = owned[0];
    candidates.push({
      contactId: contact.id,
      customerIds,
      dealId: deal.id as number,
      currentSubscriptionId: (deal.stripe_subscription_id as string) ?? null,
      currentScheduleId:
        (deal.stripe_subscription_schedule_id as string) ?? null,
      // The agreed total is what "paid in full" is measured against, and
      // it is not always the offer list price.
      agreedTotal:
        deal.selected_payment_total != null
          ? Number(deal.selected_payment_total)
          : deal.offer_price_snapshot != null
            ? Number(deal.offer_price_snapshot)
            : null,
      reviewReason: (deal.payment_review_reason as string) ?? null,
    });
  }
  return candidates;
};

// A Subscription Schedule exists — and has a real start date — BEFORE its
// first payment. Representing it only once it activates is the defect this
// whole module exists to remove, so "not_started" counts as found.
export const isLiveSchedule = (
  schedule: Stripe.SubscriptionSchedule,
): boolean => schedule.status === "not_started" || schedule.status === "active";

export const isLiveSubscription = (
  subscription: Stripe.Subscription,
): boolean =>
  subscription.status !== "canceled" &&
  subscription.status !== "incomplete_expired";

export const reconcileStripe = async (
  stripe: Stripe,
  options: { contactId?: number } = {},
): Promise<StripeReconcileDelta> => {
  const delta = emptyDelta();
  const candidates = await loadCandidates(options.contactId);

  for (const candidate of candidates) {
    delta.customersScanned += 1;

    if (candidate.dealId === -1) {
      // More than one Opportunity could own this money. Fail closed and
      // surface it rather than picking one.
      delta.ambiguous.push({
        contactId: candidate.contactId,
        candidates: ["multiple active or won Opportunities"],
      });
      continue;
    }

    // MONEY FIRST, and independently of any arrangement. Whether a
    // subscription exists has no bearing on whether money was collected,
    // and reversing that order is what made three paid clients read as
    // "payment setup pending".
    const ingest = await ingestStripePayments(stripe, {
      customerIds: candidate.customerIds,
      dealId: candidate.dealId,
      agreedTotal: candidate.agreedTotal,
      existingReviewReason: candidate.reviewReason,
    });
    delta.paymentsIngested += ingest.ingested;
    delta.paymentsAlreadyRecorded += ingest.alreadyRecorded;
    delta.errors.push(...ingest.errors);
    for (const warning of ingest.capabilityWarnings) {
      if (!delta.capabilityWarnings.includes(warning)) {
        delta.capabilityWarnings.push(warning);
      }
    }

    if (ingest.reviewReason !== candidate.reviewReason) {
      const { error: reviewError } = await supabaseAdmin
        .from("deals")
        .update({ payment_review_reason: ingest.reviewReason })
        .eq("id", candidate.dealId);
      if (reviewError) {
        delta.errors.push(`deal ${candidate.dealId}: ${reviewError.message}`);
      }
    }
    if (ingest.reviewReason) {
      delta.needsReview.push({
        contactId: candidate.contactId,
        reason: ingest.reviewReason,
      });
    }

    // Every Stripe plan object across every verified customer, LIVE AND
    // HISTORICAL. A subscription that ended is where earlier payments came
    // from; discarding it loses that, and Jules's plan would look finished
    // at four of six.
    const allSchedules: Stripe.SubscriptionSchedule[] = [];
    const allSubscriptions: Stripe.Subscription[] = [];
    let arrangementFailed = false;

    for (const customerId of candidate.customerIds) {
      try {
        const [scheduleList, subscriptionList] = await Promise.all([
          stripe.subscriptionSchedules.list({
            customer: customerId,
            limit: 50,
          }),
          stripe.subscriptions.list({
            customer: customerId,
            status: "all",
            limit: 50,
          }),
        ]);
        allSchedules.push(...scheduleList.data);
        allSubscriptions.push(...subscriptionList.data);
      } catch (error) {
        delta.errors.push(
          `customer ${customerId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        arrangementFailed = true;
      }
    }
    if (arrangementFailed) continue;

    if (allSchedules.length === 0 && allSubscriptions.length === 0) {
      // No arrangement of any kind — which is not the same as no payment,
      // and is the distinction this module was missing. Money found above
      // is already recorded, and nothing the CRM holds is cleared.
      delta.noStripePlan += 1;
      continue;
    }

    const planDelta = await recordPlanObjects({
      dealId: candidate.dealId,
      subscriptions: allSubscriptions,
      schedules: allSchedules,
    });
    delta.planObjectsRecorded += planDelta.recorded;
    delta.planObjectsUpdated += planDelta.updated;
    delta.errors.push(...planDelta.errors);

    const liveSchedules = allSchedules.filter(isLiveSchedule);
    const liveSubscriptions = allSubscriptions.filter(isLiveSubscription);

    // A schedule that has not begun is the NEXT part of the arrangement,
    // not a rival to the one running. Lara Spagnola is the case: her $400
    // plan is active and the $1,000 due 2027-01-01 is scheduled behind it,
    // and treating that as a conflict stopped the CRM linking either.
    //
    // Two plans RUNNING AT ONCE is the genuine ambiguity, because only one
    // of them can be this agreement. A schedule and its own subscription
    // are one plan, not two.
    const runningSchedules = liveSchedules.filter((s) => s.status === "active");
    const upcomingSchedules = liveSchedules.filter(
      (s) => s.status === "not_started",
    );
    const distinctLiveSubscriptions = liveSubscriptions.filter(
      (s) =>
        !liveSchedules.some(
          (sched) => scheduleSubscriptionId(sched) === s.id,
        ) || liveSchedules.length === 0,
    );
    if (runningSchedules.length > 1 || distinctLiveSubscriptions.length > 1) {
      delta.ambiguous.push({
        contactId: candidate.contactId,
        candidates: [
          ...runningSchedules.map((s) => s.id),
          ...distinctLiveSubscriptions.map((s) => s.id),
        ],
      });
      continue;
    }

    // The single-id columns keep meaning "the object carrying this plan
    // now". The history lives in deal_stripe_plan_objects beside them.
    // The single-id pointer names what is running now; when nothing is
    // running yet it names what is about to.
    const currentScheduleId =
      runningSchedules[0]?.id ?? upcomingSchedules[0]?.id ?? null;

    const patch: Record<string, string> = {};
    if (
      currentScheduleId &&
      candidate.currentScheduleId !== currentScheduleId
    ) {
      patch.stripe_subscription_schedule_id = currentScheduleId;
    }
    if (
      planDelta.currentSubscriptionId &&
      candidate.currentSubscriptionId !== planDelta.currentSubscriptionId
    ) {
      patch.stripe_subscription_id = planDelta.currentSubscriptionId;
    }

    if (Object.keys(patch).length === 0) {
      delta.alreadyLinked += 1;
      continue;
    }

    const { error } = await supabaseAdmin
      .from("deals")
      .update(patch)
      .eq("id", candidate.dealId);
    if (error) {
      delta.errors.push(`deal ${candidate.dealId}: ${error.message}`);
      continue;
    }

    if (patch.stripe_subscription_schedule_id) delta.schedulesLinked += 1;
    if (patch.stripe_subscription_id) delta.subscriptionsLinked += 1;
    delta.paymentStatesUpdated += 1;
  }

  return delta;
};

const scheduleSubscriptionId = (
  schedule: Stripe.SubscriptionSchedule,
): string | null =>
  typeof schedule.subscription === "string"
    ? schedule.subscription
    : (schedule.subscription?.id ?? null);

// What Stripe says about this customer's plan, for the drawer to show.
// Read-only: it never writes, so a Sync that finds nothing cannot damage
// anything the CRM already knows.
export type StripePlanSummary = {
  state:
    | "paid_in_full"
    | "active_plan"
    | "scheduled_plan"
    | "setup_pending"
    | "payment_issue"
    | "unknown";
  scheduleId: string | null;
  subscriptionId: string | null;
  startsAt: string | null;
  amount: number | null;
  currency: string | null;
  interval: string | null;
};

export const summarizeStripePlan = async (
  stripe: Stripe,
  customerId: string,
): Promise<StripePlanSummary> => {
  const empty: StripePlanSummary = {
    state: "unknown",
    scheduleId: null,
    subscriptionId: null,
    startsAt: null,
    amount: null,
    currency: null,
    interval: null,
  };

  const [scheduleList, subscriptionList] = await Promise.all([
    stripe.subscriptionSchedules.list({ customer: customerId, limit: 10 }),
    stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    }),
  ]);

  const schedule = scheduleList.data.find(isLiveSchedule) ?? null;
  const subscription = subscriptionList.data.find(isLiveSubscription) ?? null;

  if (!schedule && !subscription) return { ...empty, state: "setup_pending" };

  const phase = schedule?.phases?.[0] ?? null;
  const item = phase?.items?.[0] ?? null;
  const price = subscription?.items?.data?.[0]?.price ?? null;

  // A schedule that has not begun is SCHEDULED, which is a real, knowable
  // state — not "unknown" and not "no plan".
  const state: StripePlanSummary["state"] =
    subscription?.status === "past_due" || subscription?.status === "unpaid"
      ? "payment_issue"
      : schedule?.status === "not_started"
        ? "scheduled_plan"
        : subscription?.status === "active"
          ? "active_plan"
          : "setup_pending";

  return {
    state,
    scheduleId: schedule?.id ?? null,
    subscriptionId:
      subscription?.id ?? scheduleSubscriptionId(schedule!) ?? null,
    startsAt: schedule?.phases?.[0]?.start_date
      ? new Date(schedule.phases[0].start_date * 1000).toISOString()
      : subscription?.start_date
        ? new Date(subscription.start_date * 1000).toISOString()
        : null,
    amount:
      (typeof item?.price === "object" ? item.price?.unit_amount : null) ??
      price?.unit_amount ??
      null,
    currency:
      (typeof item?.price === "object" ? item.price?.currency : null) ??
      price?.currency ??
      null,
    interval: price?.recurring?.interval ?? null,
  };
};
