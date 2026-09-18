import type Stripe from "npm:stripe@18.5.0";

import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

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
  alreadyLinked: number;
  noStripePlan: number;
  ambiguous: { contactId: number; candidates: string[] }[];
  errors: string[];
};

const emptyDelta = (): StripeReconcileDelta => ({
  customersScanned: 0,
  schedulesLinked: 0,
  subscriptionsLinked: 0,
  paymentStatesUpdated: 0,
  alreadyLinked: 0,
  noStripePlan: 0,
  ambiguous: [],
  errors: [],
});

type Candidate = {
  contactId: number;
  customerId: string;
  dealId: number;
  currentSubscriptionId: string | null;
  currentScheduleId: string | null;
};

// Only people the CRM already knows a Stripe customer for. Email matching
// is deliberately NOT used here: a stripe_customer_id is a deterministic
// identity, and guessing from an address is exactly the kind of match that
// attaches somebody else's money to the wrong person.
const loadCandidates = async (contactId?: number): Promise<Candidate[]> => {
  let query = supabaseAdmin
    .from("contacts")
    .select("id, stripe_customer_id")
    .not("stripe_customer_id", "is", null);
  if (contactId != null) query = query.eq("id", contactId);

  const { data: contacts } = await query;
  const rows = (contacts ?? []) as {
    id: number;
    stripe_customer_id: string | null;
  }[];
  if (rows.length === 0) return [];

  const { data: deals } = await supabaseAdmin
    .from("deals")
    .select(
      "id, contact_id, stage, outcome, archived_at, stripe_subscription_id, stripe_subscription_schedule_id",
    )
    .in(
      "contact_id",
      rows.map((r) => r.id),
    );

  const candidates: Candidate[] = [];
  for (const contact of rows) {
    if (!contact.stripe_customer_id) continue;
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
          customerId: contact.stripe_customer_id,
          dealId: -1,
          currentSubscriptionId: null,
          currentScheduleId: null,
        });
      }
      continue;
    }
    const deal = owned[0];
    candidates.push({
      contactId: contact.id,
      customerId: contact.stripe_customer_id,
      dealId: deal.id as number,
      currentSubscriptionId: (deal.stripe_subscription_id as string) ?? null,
      currentScheduleId:
        (deal.stripe_subscription_schedule_id as string) ?? null,
    });
  }
  return candidates;
};

// A Subscription Schedule exists — and has a real start date — BEFORE its
// first payment. Representing it only once it activates is the defect this
// whole module exists to remove, so "not_started" counts as found.
const isLiveSchedule = (schedule: Stripe.SubscriptionSchedule): boolean =>
  schedule.status === "not_started" || schedule.status === "active";

const isLiveSubscription = (subscription: Stripe.Subscription): boolean =>
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

    let schedules: Stripe.SubscriptionSchedule[];
    let subscriptions: Stripe.Subscription[];
    try {
      const [scheduleList, subscriptionList] = await Promise.all([
        stripe.subscriptionSchedules.list({
          customer: candidate.customerId,
          limit: 10,
        }),
        stripe.subscriptions.list({
          customer: candidate.customerId,
          status: "all",
          limit: 10,
        }),
      ]);
      schedules = scheduleList.data.filter(isLiveSchedule);
      subscriptions = subscriptionList.data.filter(isLiveSubscription);
    } catch (error) {
      delta.errors.push(
        `customer ${candidate.customerId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }

    if (schedules.length === 0 && subscriptions.length === 0) {
      // No plan in Stripe. Critically, this does NOT clear anything the
      // CRM already holds — an owner-stated paid-in-full stays true.
      delta.noStripePlan += 1;
      continue;
    }

    if (schedules.length > 1 || subscriptions.length > 1) {
      delta.ambiguous.push({
        contactId: candidate.contactId,
        candidates: [
          ...schedules.map((s) => s.id),
          ...subscriptions.map((s) => s.id),
        ],
      });
      continue;
    }

    const schedule = schedules[0] ?? null;
    // A schedule's own subscription is the same plan, not a second one.
    const subscription =
      subscriptions.find(
        (s) => !schedule || s.id === scheduleSubscriptionId(schedule),
      ) ??
      subscriptions[0] ??
      null;

    const patch: Record<string, string> = {};
    if (schedule && candidate.currentScheduleId !== schedule.id) {
      patch.stripe_subscription_schedule_id = schedule.id;
    }
    if (subscription && candidate.currentSubscriptionId !== subscription.id) {
      patch.stripe_subscription_id = subscription.id;
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
