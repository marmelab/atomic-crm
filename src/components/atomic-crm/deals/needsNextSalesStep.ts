import type { Deal, SalesCall } from "../types";
import {
  latestCallEndedWithoutRebooking,
  selectSalesCalls,
  selectSalesCallsByOpportunity,
  type SalesCallForSelection,
  type SalesCallView,
} from "../sales-calls/salesCallSelection";
import { isActiveOpportunity, type DealActivityFields } from "./dealActivity";

// "Leif needs to decide the next sales step."
//
// A cancellation says the meeting is not happening. A no-show says the
// person did not turn up. Neither says whether to rebook, wait, or stop —
// that is a human decision, and the old code made it automatically by
// setting outcome = 'lost' on every no-show. Alva Winsa is still terminal
// because of it.
//
// So no-show and cancellation no longer end anything, which leaves a real
// question open: somebody has to decide what happens next. That question
// is DERIVED here, from canonical data:
//
//   the sales attempt is still active
//   + the latest call was cancelled or a no-show
//   + nothing is booked since
//
// Deliberately not stored. A Task may project this condition and probably
// should, but deleting or completing that Task must not make the condition
// disappear — the person really is waiting on a decision either way. Slice
// 3 hardens the projection; the truth lives here.
//
// It resolves on its own: the moment a genuine rebooking exists, `booked`
// is non-null and the premise is false. Nothing needs to be cleaned up.

export type NextSalesStepReason = "call_cancelled" | "call_no_show";

export type NextSalesStepNeed = {
  opportunityId: string;
  reason: NextSalesStepReason;
  /** The call that left the question open. */
  salesCallId: string | null;
  /** When that call was, where it is known. */
  at: string | null;
};

const reasonFor = (
  view: SalesCallView<SalesCallForSelection>,
): NextSalesStepReason | null => {
  const last = view.mostRecentConcluded;
  if (!last) return null;
  // A cancelled call that was also marked no-show is a cancellation: the
  // meeting was called off, so nobody failed to attend it.
  if (last.status === "cancelled") return "call_cancelled";
  if (last.attendance === "no_show") return "call_no_show";
  return null;
};

/** Does this one Opportunity need a decision about its next sales step? */
export const needsNextSalesStep = (
  deal: DealActivityFields,
  salesCalls: readonly SalesCallForSelection[] | undefined,
): NextSalesStepReason | null => {
  if (!isActiveOpportunity(deal)) return null;
  const view = selectSalesCalls(salesCalls);
  if (!latestCallEndedWithoutRebooking(view)) return null;
  return reasonFor(view);
};

/**
 * Every Opportunity currently waiting on that decision.
 *
 * Takes the full working set rather than querying, so the same function
 * serves a list already in memory and, later, a server-side projection.
 */
export const opportunitiesNeedingNextSalesStep = (
  deals: readonly (DealActivityFields & Pick<Deal, "id">)[] | undefined,
  salesCalls: readonly SalesCallForSelection[] | undefined,
): NextSalesStepNeed[] => {
  const views = selectSalesCallsByOpportunity(salesCalls);
  const needs: NextSalesStepNeed[] = [];

  for (const deal of deals ?? []) {
    if (!isActiveOpportunity(deal)) continue;
    const view = views.get(String(deal.id));
    if (!view || !latestCallEndedWithoutRebooking(view)) continue;
    const reason = reasonFor(view);
    if (!reason) continue;
    const last = view.mostRecentConcluded;
    needs.push({
      opportunityId: String(deal.id),
      reason,
      salesCallId: last ? String(last.id) : null,
      at: last?.scheduled_at ?? last?.scheduled_on ?? null,
    });
  }

  return needs;
};

/** How to say it on screen. */
export const NEXT_SALES_STEP_LABELS: Record<NextSalesStepReason, string> = {
  call_cancelled: "Call cancelled — decide the next step",
  call_no_show: "No-show — decide the next step",
};

export type SalesCallForNeed = Pick<
  SalesCall,
  | "id"
  | "opportunity_id"
  | "status"
  | "attendance"
  | "scheduled_at"
  | "scheduled_on"
>;
