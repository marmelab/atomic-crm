import { addDays } from "date-fns/addDays";

import type { Deal, SalesCall } from "../../../types";
import type { Db } from "./types";
import { randomDate } from "./utils";

// Any Opportunity at Call Booked or later has, by definition, had a sales
// call scheduled — so it needs a real sales_calls record behind it, the
// same way a Won Opportunity needs a real Enrollment (see
// backfillEnrollmentsForWonDeals.ts, the precedent this mirrors). Without
// this, a randomly generated "Decision"/"Committed" card — or a named
// fixture like Judy Holloway's, added before sales_calls existed — reaches
// the Opportunity page with no Sales Call section to act on, exactly the
// "legacy/inconsistent record" gap DealSalesCallSection.tsx's own recovery
// state exists to catch (Human-acceptance repair pass, §Repair 2). Backfill
// closes the gap in fixture data so that recovery state is only ever seen
// for a genuinely inconsistent real-world record, never routine demo data.
//
// Never overwrites a deal's own owner_decision/prospect_decision if a named
// fixture (leifProofSliceFixtures.ts) already set them — only fills in a
// missing sales_calls row and, for stages that imply the call already
// happened, defaults the decision fields ONLY when genuinely absent (the
// randomly generated deals in deals.ts never set them at all).
const CALL_LIFECYCLE_STAGES = new Set([
  "call_booked",
  "decision",
  "committed",
  "won",
]);

export const backfillSalesCallsForCallLifecycleDeals = (db: Db): void => {
  const bookedOpportunityIds = new Set(
    db.sales_calls.map((call) => call.opportunity_id),
  );
  let nextCallId = db.sales_calls.length;
  let nextEventId = db.sales_call_events.length;
  const now = new Date();

  db.deals.forEach((deal, index) => {
    if (!CALL_LIFECYCLE_STAGES.has(deal.stage)) return;
    if (bookedOpportunityIds.has(deal.id)) return;

    const callAlreadyHappened = deal.stage !== "call_booked";
    const scheduledAt = callAlreadyHappened
      ? randomDate(new Date(deal.created_at), new Date(deal.updated_at))
      : randomDate(now, addDays(now, 14));
    const scheduledAtIso = scheduledAt.toISOString();

    const salesCall: SalesCall = {
      id: nextCallId++,
      opportunity_id: deal.id,
      contact_id: deal.contact_id,
      status: "booked",
      original_scheduled_at: scheduledAtIso,
      scheduled_at: scheduledAtIso,
      reschedule_count: 0,
      source: "manual",
      created_at: deal.created_at,
      updated_at: deal.created_at,
      ...(callAlreadyHappened
        ? { attendance: "attended", attendance_recorded_at: deal.updated_at }
        : {}),
    };

    db.sales_calls.push(salesCall);
    bookedOpportunityIds.add(deal.id);

    db.sales_call_events.push({
      id: nextEventId++,
      sales_call_id: salesCall.id,
      kind: "booked",
      occurred_at: deal.created_at,
      new_scheduled_at: scheduledAtIso,
      created_at: deal.created_at,
    });
    if (callAlreadyHappened) {
      db.sales_call_events.push({
        id: nextEventId++,
        sales_call_id: salesCall.id,
        kind: "attendance_recorded",
        occurred_at: deal.updated_at,
        attendance: "attended",
        created_at: deal.updated_at,
      });
    }

    // deals.sales_call_at mirrors the current sales_calls.scheduled_at —
    // same denormalized convenience field the real sync hook maintains.
    // A new Deal object, never a mutation of the one already in db.deals.
    db.deals[index] = {
      ...deal,
      sales_call_at: scheduledAtIso,
      ...(callAlreadyHappened ? missingDecisionFields(deal) : {}),
    };
  });
};

// Only meaningful for a deal that had no owner_decision at all — a named
// fixture that already set one (Marcus, Alex) is left exactly as written,
// this returns {} for it.
const missingDecisionFields = (
  deal: Deal,
):
  | Pick<Deal, "owner_decision" | "prospect_decision" | "follow_up_date">
  | Record<string, never> => {
  if (deal.owner_decision) return {};

  if (deal.stage === "decision") {
    return {
      owner_decision: "would_work_with",
      prospect_decision: "thinking",
      follow_up_date: addDays(new Date(), 4).toISOString().split("T")[0],
    };
  }
  // committed or won
  return { owner_decision: "would_work_with", prospect_decision: "yes" };
};
