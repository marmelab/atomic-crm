import type { Deal, SalesCall } from "../types";
import { isActiveOpportunity, type DealActivityFields } from "./dealActivity";

// A call is proof that a call was booked.
//
// Aurelie Boleor's Opportunity sat in `approved` holding a real Acuity
// call marked `cancelled`. Both cannot be true: you cannot cancel a
// meeting you never booked. Her stage-event log simply never recorded
// the transition, and a missing history row is not evidence that the
// stage never happened — the call is the stronger fact.
//
// The live rule already keeps this from recurring: booking advances the
// stage, and since the call-booked repair a cancellation or no-show no
// longer demotes it. What remains is imported and pre-tracking data,
// where the stage and the call can disagree. This is the predicate that
// says when they do.
//
// It answers a question about EVIDENCE and never performs a repair. What
// it must never do is drag a sale backwards: an Opportunity that reached
// Decision, Committed or Won, or that has ended with an outcome, is
// beyond the reach of an old call.

/** Stages that come before a call could have been booked. */
const PRE_CALL_STAGES = new Set([
  "interested",
  "application_received",
  "approved",
]);

export type CallEvidence = Pick<
  SalesCall,
  "opportunity_id" | "status" | "attendance"
>;

/**
 * Does this call prove a booking existed?
 *
 * Every state a real call can be in does, including the ones that ended
 * badly — booked, attended, missed and cancelled all require that
 * somebody put it in the calendar first. A call that belongs to no
 * Opportunity proves nothing about any Opportunity.
 */
export const callProvesBooking = (
  call: CallEvidence,
  opportunityId: Deal["id"],
): boolean => {
  if (call.opportunity_id == null) return false;
  if (String(call.opportunity_id) !== String(opportunityId)) return false;
  return (
    call.status === "booked" ||
    call.status === "completed" ||
    call.status === "cancelled" ||
    call.attendance === "attended" ||
    call.attendance === "no_show"
  );
};

/**
 * Should this Opportunity's stage be reconciled up to Call Booked?
 *
 * True only when the sale is still live, its stage still claims it never
 * got that far, and one of its own calls says otherwise. A later human
 * decision — a Decision-stage progression, a Won, an exit — is
 * authoritative over an old call and is never overruled here.
 */
export const stageContradictsItsOwnCall = (
  deal: DealActivityFields & Pick<Deal, "id" | "stage">,
  calls: readonly CallEvidence[] | undefined,
): boolean => {
  if (!isActiveOpportunity(deal)) return false;
  if (!PRE_CALL_STAGES.has(deal.stage)) return false;
  return (calls ?? []).some((call) => callProvesBooking(call, deal.id));
};
