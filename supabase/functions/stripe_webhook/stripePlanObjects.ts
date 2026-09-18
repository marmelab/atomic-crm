import type Stripe from "npm:stripe@18.5.0";

import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { isLiveSchedule, isLiveSubscription } from "./stripeReconcile.ts";

// The Stripe objects that have carried a Deal's payment plan — all of
// them, not the latest one.
//
// Jules Litman-Cleper agreed six payments of $666. His first subscription
// was built with four cycles, so Stripe ended it after payment four, and
// Leif created a replacement for the remaining two. That is ONE commercial
// agreement with two subscriptions behind it.
//
// Storing only the newest id would lose where four collected payments came
// from. Storing only the oldest would say his plan had ended. Both are
// kept, the live one marked current, and payment truth is computed from
// the agreement rather than from any single subscription's status.

export type PlanObjectDelta = {
  recorded: number;
  updated: number;
  currentSubscriptionId: string | null;
  currentScheduleId: string | null;
  errors: string[];
};

type PlanRow = {
  deal_id: number;
  stripe_object_id: string;
  object_type: "subscription" | "schedule";
  status: string | null;
  started_at: string | null;
  ended_at: string | null;
  is_current: boolean;
  link_source: string;
};

const iso = (seconds: number | null | undefined): string | null =>
  seconds == null ? null : new Date(seconds * 1000).toISOString();

const subscriptionRow = (
  dealId: number,
  subscription: Stripe.Subscription,
): PlanRow => ({
  deal_id: dealId,
  stripe_object_id: subscription.id,
  object_type: "subscription",
  status: subscription.status,
  started_at: iso(subscription.start_date),
  ended_at: iso(subscription.ended_at) ?? iso(subscription.canceled_at) ?? null,
  is_current: isLiveSubscription(subscription),
  link_source: "reconciliation",
});

const scheduleRow = (
  dealId: number,
  schedule: Stripe.SubscriptionSchedule,
): PlanRow => ({
  deal_id: dealId,
  stripe_object_id: schedule.id,
  object_type: "schedule",
  status: schedule.status,
  started_at: iso(schedule.phases?.[0]?.start_date),
  ended_at: iso(schedule.completed_at) ?? iso(schedule.canceled_at) ?? null,
  is_current: isLiveSchedule(schedule),
  link_source: "reconciliation",
});

export const recordPlanObjects = async (params: {
  dealId: number;
  subscriptions: Stripe.Subscription[];
  schedules: Stripe.SubscriptionSchedule[];
}): Promise<PlanObjectDelta> => {
  const delta: PlanObjectDelta = {
    recorded: 0,
    updated: 0,
    currentSubscriptionId: null,
    currentScheduleId: null,
    errors: [],
  };

  const rows: PlanRow[] = [
    ...params.subscriptions.map((s) => subscriptionRow(params.dealId, s)),
    ...params.schedules.map((s) => scheduleRow(params.dealId, s)),
  ];
  if (rows.length === 0) return delta;

  const { data: existingData, error: readError } = await supabaseAdmin
    .from("deal_stripe_plan_objects")
    .select("stripe_object_id, status, is_current")
    .eq("deal_id", params.dealId);
  if (readError) {
    delta.errors.push(`deal ${params.dealId}: ${readError.message}`);
    return delta;
  }
  const existing = new Map(
    (
      (existingData ?? []) as {
        stripe_object_id: string;
        status: string | null;
        is_current: boolean;
      }[]
    ).map((row) => [row.stripe_object_id, row]),
  );

  for (const row of rows) {
    const previous = existing.get(row.stripe_object_id);

    if (!previous) {
      const { error } = await supabaseAdmin
        .from("deal_stripe_plan_objects")
        .insert(row);
      // Another Deal already owns this object: that is a real conflict a
      // human must settle, not something to overwrite.
      if (error) {
        delta.errors.push(`${row.stripe_object_id}: ${error.message}`);
        continue;
      }
      delta.recorded += 1;
    } else if (
      previous.status !== row.status ||
      previous.is_current !== row.is_current
    ) {
      // Stripe owns status. A subscription that has ended since the last
      // sweep is updated in place, never removed.
      const { error } = await supabaseAdmin
        .from("deal_stripe_plan_objects")
        .update({
          status: row.status,
          started_at: row.started_at,
          ended_at: row.ended_at,
          is_current: row.is_current,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_object_id", row.stripe_object_id);
      if (error) {
        delta.errors.push(`${row.stripe_object_id}: ${error.message}`);
        continue;
      }
      delta.updated += 1;
    }

    if (row.is_current) {
      if (row.object_type === "subscription") {
        delta.currentSubscriptionId = row.stripe_object_id;
      } else {
        delta.currentScheduleId = row.stripe_object_id;
      }
    }
  }

  return delta;
};
