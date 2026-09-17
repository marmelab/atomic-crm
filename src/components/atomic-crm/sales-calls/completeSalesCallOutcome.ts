import { addDays } from "date-fns/addDays";
import type { DataProvider, Identifier } from "ra-core";

import {
  applyDoNotEngageToContact,
  buildDoNotEngageDealUpdate,
} from "../deals/dneOutcome";
import type {
  Deal,
  OpportunityOwnerDecision,
  OpportunityProspectDecision,
  SalesCall,
  SalesCallAttendance,
} from "../types";
import { DEFAULT_THINKING_FOLLOW_UP_DAYS } from "./salesCallConstants";
import { completeSalesCallTask } from "./salesCallTask";
import { ensureFollowUpTask } from "./followUpTask";
import { resolveDefaultTaskSalesId } from "./resolveDefaultTaskSalesId";
import { ensureOfferPageToken } from "../deals/offerPageToken";
import { recordSalesCallNoShow } from "./recordSalesCallNoShow";

export type CompleteSalesCallOutcomeInput = {
  dataProvider: DataProvider;
  salesCallId: Identifier;
  contactName: string;
  attendance: SalesCallAttendance;
  // Required when attendance = "attended".
  ownerDecision?: OpportunityOwnerDecision | null;
  // Required when ownerDecision = "would_work_with".
  prospectDecision?: OpportunityProspectDecision | null;
  // Required when prospectDecision = "thinking"; defaults to +4 days if
  // omitted (the dialog always supplies one, editable — this default only
  // protects a non-UI caller, e.g. a test or a future Acuity-adjacent
  // automation, from an ambiguous write).
  followUpDate?: string | null;
};

export type CompleteSalesCallOutcomeResult =
  | { status: "completed" }
  | { status: "not-found" }
  // The call has no matched Opportunity yet (Decision 3 — an unmatched
  // booking) — nothing to decide until it's resolved onto one.
  | { status: "no-opportunity" }
  // attendance was already recorded — idempotent no-op, never a second
  // write (double-click, cached tab, Back/Forward — same convention as
  // reviewApplication.ts's "already-reviewed" guard).
  | { status: "already-completed" }
  | { status: "validation-error"; message: string };

// The single domain function behind the "Complete Sales Call" dialog
// (Acuity/Sales Call Lifecycle slice). Idempotent-via-refetch, same
// convention as applications/reviewApplication.ts: re-reads the current
// sales_calls row rather than trusting the caller's copy, so a stale UI
// can never silently overwrite a newer outcome. Every branch below mirrors
// the ticket's own decision table exactly — see this slice's report for
// the stage/outcome reasoning.
export const completeSalesCallOutcome = async (
  input: CompleteSalesCallOutcomeInput,
): Promise<CompleteSalesCallOutcomeResult> => {
  const { dataProvider } = input;
  const { data: salesCall } = await dataProvider
    .getOne<SalesCall>("sales_calls", { id: input.salesCallId })
    .catch(() => ({ data: null as SalesCall | null }));
  if (!salesCall) return { status: "not-found" };

  // Gate B: a No-show is a single atomic domain operation, so it branches
  // BEFORE any of the writes below. Routing it through the same
  // sequential path as an attended call is what allowed the half-states
  // this rule forbids (call recorded no_show, Opportunity still active).
  // It is also allowed to run on an already-no-showed call, so the guard
  // below deliberately does not short-circuit it — re-running converges
  // rather than duplicating.
  if (input.attendance === "no_show") {
    const result = await recordSalesCallNoShow(dataProvider, salesCall.id);
    switch (result.status) {
      case "completed":
      case "already-no-show":
        return { status: "completed" };
      case "already-completed":
        return { status: "already-completed" };
      case "no-opportunity":
        return { status: "no-opportunity" };
      default:
        return { status: "not-found" };
    }
  }

  if (salesCall.attendance != null) return { status: "already-completed" };
  if (salesCall.opportunity_id == null) return { status: "no-opportunity" };

  if (input.attendance === "attended" && !input.ownerDecision) {
    return {
      status: "validation-error",
      message: "An owner-fit decision is required for an attended call.",
    };
  }
  if (input.ownerDecision === "would_work_with" && !input.prospectDecision) {
    return {
      status: "validation-error",
      message: "A prospect decision is required when Would Work With.",
    };
  }
  if (input.prospectDecision === "thinking" && input.followUpDate === "") {
    return {
      status: "validation-error",
      message: "A follow-up date is required when Thinking.",
    };
  }

  const now = new Date().toISOString();
  await dataProvider.update<SalesCall>("sales_calls", {
    id: salesCall.id,
    // Go-Live Blocker: Sales-Call No-Show/Rebooking slice — status also
    // leaves 'booked' the instant an outcome is recorded (attended or
    // no-show), never just before. sales_calls_one_booked_per_opportunity_idx
    // is a partial unique index on (opportunity_id) WHERE status='booked';
    // leaving a concluded call at 'booked' forever either silently
    // corrupts a genuine rebooking (bookSalesCall.ts's own "existing
    // booked call" matching reuses/retargets THIS row instead of creating
    // a fresh one, leaving attendance permanently stuck) or blocks the
    // fresh row's INSERT outright with a unique-violation. See migration
    // 20260914165113.
    data: {
      attendance: input.attendance,
      attendance_recorded_at: now,
      status: "completed",
    },
    previousData: salesCall,
  });
  await dataProvider.create("sales_call_events", {
    data: {
      sales_call_id: salesCall.id,
      kind: "attendance_recorded",
      occurred_at: now,
      attendance: input.attendance,
    },
  });

  // The call happened (attended or no-show) either way — its task is done.
  // Never the reverse: completing/cancelling this task must not itself
  // mutate sales status (that already happened above; this only reflects
  // it on the Task).
  await completeSalesCallTask(dataProvider, salesCall.contact_id, now);

  const { data: deal } = await dataProvider.getOne<Deal>("deals", {
    id: salesCall.opportunity_id,
  });
  const dealUpdate = buildAttendedDealUpdate({
    ownerDecision: input.ownerDecision!,
    prospectDecision: input.prospectDecision ?? null,
    followUpDate: input.followUpDate || null,
  });
  await dataProvider.update("deals", {
    id: deal.id,
    data: dealUpdate,
    previousData: deal,
  });

  if (dealUpdate.owner_decision === "do_not_engage") {
    await applyDoNotEngageToContact(dataProvider, deal.contact_id);
  }

  if (
    dealUpdate.owner_decision === "would_work_with" &&
    dealUpdate.prospect_decision === "thinking"
  ) {
    await ensureFollowUpTask(dataProvider, {
      contactId: deal.contact_id,
      contactName: input.contactName,
      followUpDate: dealUpdate.follow_up_date!,
      salesId: await resolveDefaultTaskSalesId(dataProvider),
    });
  }

  // Payment domain foundation slice: reaching Committed is what generates
  // the personalized Offer Page's access token — see offerPageToken.ts's
  // own comment for why it's idempotent and never rotates an
  // already-issued link.
  if (dealUpdate.stage === "committed") {
    await ensureOfferPageToken(dataProvider, deal.id);
  }

  return { status: "completed" };
};

const buildAttendedDealUpdate = ({
  ownerDecision,
  prospectDecision,
  followUpDate,
}: {
  ownerDecision: OpportunityOwnerDecision;
  prospectDecision: OpportunityProspectDecision | null;
  followUpDate: string | null;
}): Partial<Deal> => {
  if (ownerDecision === "do_not_engage") {
    return buildDoNotEngageDealUpdate();
  }

  if (ownerDecision === "workshops_only") {
    // A genuine pipeline exit, explicitly NOT a lost sale (§ Workshops
    // Only) — the prospect was never offered LE/GYU, so it must not read
    // as a decline in later conversion analytics.
    return { outcome: "workshops_only", owner_decision: "workshops_only" };
  }

  // ownerDecision === "would_work_with"
  if (prospectDecision === "yes") {
    return {
      owner_decision: "would_work_with",
      prospect_decision: "yes",
      follow_up_date: null,
      stage: "committed",
    };
  }
  if (prospectDecision === "no") {
    return {
      owner_decision: "would_work_with",
      prospect_decision: "no",
      follow_up_date: null,
      outcome: "lost",
    };
  }
  // prospectDecision === "thinking"
  return {
    owner_decision: "would_work_with",
    prospect_decision: "thinking",
    follow_up_date:
      followUpDate ??
      addDays(new Date(), DEFAULT_THINKING_FOLLOW_UP_DAYS)
        .toISOString()
        .split("T")[0],
    stage: "decision",
  };
};
