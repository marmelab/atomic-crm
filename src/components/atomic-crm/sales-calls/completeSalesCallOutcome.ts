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
    data: { attendance: input.attendance, attendance_recorded_at: now },
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

  if (input.attendance === "no_show") {
    // Explicitly no further Opportunity write: a no-show is not a
    // decision about fit or interest, and this slice does not auto-guess
    // what happens next (rebooking is a human call).
    return { status: "completed" };
  }

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
