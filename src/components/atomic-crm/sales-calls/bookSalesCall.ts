import type { DataProvider, Identifier } from "ra-core";

import type { Deal, SalesCall, SalesCallSource } from "../types";
import { completeSalesCallCancelledTask } from "./salesCallCancelledTask";
import { completeSalesCallNoShowTask } from "./salesCallNoShowTask";
import { ensureSalesCallNeedsMatchingTask } from "./salesCallNeedsMatchingTask";
import { resolveDefaultTaskSalesId } from "./resolveDefaultTaskSalesId";

export type BookSalesCallInput = {
  dataProvider: DataProvider;
  contactId: Identifier;
  contactName: string;
  // null: could not be safely matched to exactly one active Opportunity
  // (see matchAcuityBooking.ts) — preserved rather than guessed.
  opportunityId: Identifier | null;
  scheduledAt: string;
  source: SalesCallSource;
  acuityAppointmentId?: string | null;
  acuityAppointmentTypeId?: string | null;
  // Only meaningful (and only ever read) when opportunityId is null — the
  // mapped Offer/Cohort matchAcuityBooking.ts already resolved, so the
  // resulting resolve_sales_call Task's own text can name it (Unmatched
  // Sales Call Resolution slice, human-acceptance repair: "Sales call
  // needs matching" rows must show enough context to triage without
  // opening anything).
  offerName?: string;
  cohortName?: string | null;
};

export type BookSalesCallResult =
  | { status: "booked"; salesCall: SalesCall }
  // Same acuity_appointment_id already recorded — a duplicate webhook
  // delivery is a safe no-op, never a second row.
  | { status: "already-booked"; salesCall: SalesCall }
  // This Opportunity already has a currently-booked call — a second
  // "book" for it (e.g. an Acuity retry that produced a different
  // appointment id, or a re-booking call) reuses/retargets that row
  // instead of creating a duplicate, mirroring this app's established
  // "reuse the existing active thing" convention (submitApplication.ts's
  // findOrCreateDeal, waitlistActions.ts's convertToOpportunity).
  | { status: "reused-existing-booking"; salesCall: SalesCall };

// Records a newly booked sales call and its side effects: advances the
// Opportunity from Approved to Call Booked (only from Approved — an
// Opportunity already further along is left alone rather than guessed at,
// see the inline comment below), and ensures the right Task exists —
// "Sales Call: {Person}" when the Opportunity is known, "Resolve Sales
// Call: {Person}" when it isn't (Decision 3). Never marks
// Yes/Thinking/No or Committed/Won — those are human decisions made later
// via completeSalesCallOutcome.ts.
export const bookSalesCall = async (
  input: BookSalesCallInput,
): Promise<BookSalesCallResult> => {
  const { dataProvider } = input;

  if (input.acuityAppointmentId) {
    const { data: existingByAcuityId } = await dataProvider.getList<SalesCall>(
      "sales_calls",
      {
        filter: { acuity_appointment_id: input.acuityAppointmentId },
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "ASC" },
      },
    );
    if (existingByAcuityId[0]) {
      return { status: "already-booked", salesCall: existingByAcuityId[0] };
    }
  }

  if (input.opportunityId != null) {
    const { data: existingBooked } = await dataProvider.getList<SalesCall>(
      "sales_calls",
      {
        filter: { opportunity_id: input.opportunityId, status: "booked" },
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "ASC" },
      },
    );
    if (existingBooked[0]) {
      const salesCall = await retargetExistingBooking(
        dataProvider,
        existingBooked[0],
        input.scheduledAt,
      );
      return { status: "reused-existing-booking", salesCall };
    }
  }

  const now = new Date().toISOString();
  const { data: salesCall } = await dataProvider.create<SalesCall>(
    "sales_calls",
    {
      data: {
        opportunity_id: input.opportunityId,
        contact_id: input.contactId,
        status: "booked",
        original_scheduled_at: input.scheduledAt,
        scheduled_at: input.scheduledAt,
        reschedule_count: 0,
        source: input.source,
        acuity_appointment_id: input.acuityAppointmentId ?? null,
        acuity_appointment_type_id: input.acuityAppointmentTypeId ?? null,
      },
    },
  );

  await dataProvider.create("sales_call_events", {
    data: {
      sales_call_id: salesCall.id,
      kind: "booked",
      occurred_at: now,
      new_scheduled_at: input.scheduledAt,
    },
  });

  // A call whose time has already passed is not something to attend —
  // it is something whose outcome nobody has recorded. Logging Dax
  // Kara's call of 1 August is exactly that: Leif states it happened
  // and says nothing about how it went.
  //
  // resolution_requested_at is the canonical way to say "somebody
  // established that nobody knows what happened here", and the existing
  // reconciler turns it into the one "what happened on this call?"
  // question — with its own past-tense guard, so a FUTURE booking is
  // untouched and keeps ordinary booked semantics.
  const happensInThePast = new Date(input.scheduledAt).getTime() < Date.now();
  if (happensInThePast) {
    await dataProvider.update<SalesCall>("sales_calls", {
      id: salesCall.id,
      data: { resolution_requested_at: now },
      previousData: salesCall,
    });
  }

  const salesId = await resolveDefaultTaskSalesId(dataProvider);

  if (input.opportunityId != null) {
    await advanceApprovedToCallBooked(dataProvider, input.opportunityId);
    // The booking itself creates no Task. A Task means Leif has something
    // to do; a scheduled call is a calendar fact, already carried by the
    // Call Booked stage and the Opportunity's own Sales Call section. See
    // salesCallTask.ts for why that projection was retired.
    // The person is back on the calendar — resolves any "sales call was
    // cancelled, decide next steps" task a prior cancellation on this same
    // Opportunity left open (GYU real-infrastructure slice, human-
    // acceptance repair pass; see cancelSalesCall.ts). A safe no-op when
    // no such task is pending.
    await completeSalesCallCancelledTask(dataProvider, input.contactId, now);
    // Same resolution for a no-show's own "decide next steps" task
    // (Go-Live Blocker: Sales-Call No-Show/Rebooking slice) — a fresh
    // booking IS the rescheduling decision, so the task that asked "does
    // this person want to reschedule?" is answered. A safe no-op when no
    // such task is pending.
    await completeSalesCallNoShowTask(dataProvider, input.contactId, now);
  } else {
    await ensureSalesCallNeedsMatchingTask(dataProvider, {
      contactId: input.contactId,
      contactName: input.contactName,
      salesCallId: salesCall.id,
      scheduledAt: input.scheduledAt,
      offerName: input.offerName ?? "",
      cohortName: input.cohortName,
      salesId,
    });
  }

  return { status: "booked", salesCall };
};

// Only the exact "Approved -> Call Booked" transition the product model
// describes. An Opportunity already at Call Booked/Decision/Committed/Won
// (or anywhere unexpected) is left exactly where it is — a repeat/duplicate
// booking call must never regress or reinterpret a stage a human decision
// already advanced past.
// Exported: also reused by resolveUnmatchedSalesCall.ts's own attach/create
// paths — same rule applies whether the Opportunity was just matched by
// Acuity or resolved by hand later.
export const advanceApprovedToCallBooked = async (
  dataProvider: DataProvider,
  opportunityId: Identifier,
): Promise<void> => {
  const { data: deal } = await dataProvider.getOne<Deal>("deals", {
    id: opportunityId,
  });
  if (deal.stage !== "approved") return;
  await dataProvider.update("deals", {
    id: opportunityId,
    data: { stage: "call_booked" },
    previousData: deal,
  });
};

const retargetExistingBooking = async (
  dataProvider: DataProvider,
  existing: SalesCall,
  scheduledAt: string,
): Promise<SalesCall> => {
  if (existing.scheduled_at === scheduledAt) return existing;

  const now = new Date().toISOString();
  const { data: updated } = await dataProvider.update<SalesCall>(
    "sales_calls",
    {
      id: existing.id,
      data: {
        scheduled_at: scheduledAt,
        reschedule_count: existing.reschedule_count + 1,
        last_rescheduled_at: now,
      },
      previousData: existing,
    },
  );
  await dataProvider.create("sales_call_events", {
    data: {
      sales_call_id: existing.id,
      kind: "rescheduled",
      occurred_at: now,
      previous_scheduled_at: existing.scheduled_at,
      new_scheduled_at: scheduledAt,
    },
  });
  // Nothing to retarget: the appointment is not a Task, so moving it moves
  // the Sales Call row and the calendar, which is where the fact lives.
  return updated;
};
