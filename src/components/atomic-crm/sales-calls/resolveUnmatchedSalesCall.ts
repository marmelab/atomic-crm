import type { DataProvider, Identifier } from "ra-core";

import type { Contact, Deal, SalesCall } from "../types";
import { advanceApprovedToCallBooked } from "./bookSalesCall";
import { resolveOfferCohortForAppointmentType } from "./offerCohortAcuityMapping";
import { completeResolveSalesCallTask } from "./resolveSalesCallTask";
import { ensureSalesCallTask } from "./salesCallTask";
import { resolveDefaultTaskSalesId } from "./resolveDefaultTaskSalesId";

// Unmatched Sales Call Resolution slice: the three human decisions the
// dedicated resolution page (/sales-calls/:id/resolve) offers for a
// sales_call that couldn't be auto-matched — attach to an existing
// Opportunity, create the correct one, or dismiss it as not a sales
// situation. All three share the same idempotency shape as
// reviewApplication.ts/activateEnrollment.ts: re-fetch the sales_call
// fresh (never trust the caller's copy) and bail with a typed, non-error
// result if it's already resolved — a double-click, a stale tab, or two
// browser tabs both open on the same alert is always a safe no-op, never a
// second write. Every path preserves the EXISTING sales_call row (never
// creates a second one) and the append-only sales_call_events history.
export type ResolveOutcome =
  | { applied: true }
  | { applied: false; reason: "already-resolved" };

const fetchSalesCall = async (
  dataProvider: DataProvider,
  salesCallId: Identifier,
): Promise<SalesCall> =>
  (await dataProvider.getOne<SalesCall>("sales_calls", { id: salesCallId }))
    .data;

const isUnresolved = (salesCall: SalesCall): boolean =>
  salesCall.opportunity_id == null && salesCall.dismissed_at == null;

const resolveContactName = async (
  dataProvider: DataProvider,
  contactId: Identifier,
): Promise<string> => {
  const { data: contact } = await dataProvider.getOne<Contact>("contacts", {
    id: contactId,
  });
  return `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();
};

// Shared tail of the attach/create paths: point the EXISTING sales_call at
// the resolved Opportunity, advance Approved -> Call Booked (a no-op for an
// Opportunity already further along, or one freshly created directly at
// Call Booked), ensure the normal "Sales Call: {Person}" task exists, and
// resolve the "Needs Attention" alert — exactly bookSalesCall.ts's own
// matched-branch behavior, applied by hand instead of by a live Acuity
// webhook.
const finishAttaching = async (
  dataProvider: DataProvider,
  salesCall: SalesCall,
  opportunityId: Identifier,
): Promise<void> => {
  const now = new Date().toISOString();
  await dataProvider.update("sales_calls", {
    id: salesCall.id,
    data: { opportunity_id: opportunityId },
    previousData: salesCall,
  });
  await dataProvider.create("sales_call_events", {
    data: {
      sales_call_id: salesCall.id,
      kind: "opportunity_attached",
      occurred_at: now,
    },
  });

  await advanceApprovedToCallBooked(dataProvider, opportunityId);

  const contactName = await resolveContactName(
    dataProvider,
    salesCall.contact_id,
  );
  const salesId = await resolveDefaultTaskSalesId(dataProvider);
  await ensureSalesCallTask(dataProvider, {
    contactId: salesCall.contact_id,
    contactName,
    scheduledAt: salesCall.scheduled_at,
    salesId,
  });
  await completeResolveSalesCallTask(
    dataProvider,
    salesCall.contact_id,
    now,
    salesCall.id,
  );
};

// Path 1: attach to a compatible existing Opportunity Leif picked. Never
// re-derives compatibility here beyond a defensive re-check — the picker
// itself only ever offers compatible options (findCompatibleActiveOpportunities),
// but this is the actual write path, so it never trusts the browser's
// selection alone (same "never trust the browser" principle as Stripe
// Slice B's own authorization boundary).
export const attachSalesCallToOpportunity = async (
  dataProvider: DataProvider,
  {
    salesCallId,
    opportunityId,
  }: { salesCallId: Identifier; opportunityId: Identifier },
): Promise<
  ResolveOutcome | { applied: false; reason: "incompatible-opportunity" }
> => {
  const salesCall = await fetchSalesCall(dataProvider, salesCallId);
  if (!isUnresolved(salesCall)) {
    return { applied: false, reason: "already-resolved" };
  }

  const { data: deal } = await dataProvider.getOne<Deal>("deals", {
    id: opportunityId,
  });
  if (String(deal.contact_id) !== String(salesCall.contact_id)) {
    return { applied: false, reason: "incompatible-opportunity" };
  }
  if (salesCall.acuity_appointment_type_id) {
    const mapping = await resolveOfferCohortForAppointmentType(
      dataProvider,
      salesCall.acuity_appointment_type_id,
    );
    if (mapping) {
      const cohortId = mapping.kind === "group" ? mapping.cohort?.id : null;
      const compatible =
        String(deal.offer_id) === String(mapping.offer.id) &&
        (cohortId == null || String(deal.cohort_id) === String(cohortId));
      if (!compatible) {
        return { applied: false, reason: "incompatible-opportunity" };
      }
    }
  }

  await finishAttaching(dataProvider, salesCall, opportunityId);
  return { applied: true };
};

// Path 2: no appropriate Opportunity exists yet — create exactly the one
// the appointment-type mapping authoritatively determines (Leif is never
// asked to pick an Offer the booking itself already answers), then attach
// this SAME sales_call to it. Idempotent the same way as every other path:
// a retry/double-click re-fetches the sales_call first and finds it
// already resolved (attached to the Deal the first call created) before
// ever creating a second one.
export const createOpportunityAndAttachSalesCall = async (
  dataProvider: DataProvider,
  { salesCallId }: { salesCallId: Identifier },
): Promise<
  ResolveOutcome | { applied: false; reason: "unknown-appointment-type" }
> => {
  const salesCall = await fetchSalesCall(dataProvider, salesCallId);
  if (!isUnresolved(salesCall)) {
    return { applied: false, reason: "already-resolved" };
  }
  if (!salesCall.acuity_appointment_type_id) {
    return { applied: false, reason: "unknown-appointment-type" };
  }
  const mapping = await resolveOfferCohortForAppointmentType(
    dataProvider,
    salesCall.acuity_appointment_type_id,
  );
  if (!mapping) {
    return { applied: false, reason: "unknown-appointment-type" };
  }
  const cohort = mapping.kind === "group" ? mapping.cohort : null;

  const { data: deal } = await dataProvider.create<Deal>("deals", {
    data: {
      contact_id: salesCall.contact_id,
      offer_id: mapping.offer.id,
      cohort_id: cohort?.id ?? null,
      // Created directly at Call Booked — a call is already booked (this
      // whole slice exists because of it), so there is no earlier funnel
      // stage to skip past or advance from.
      stage: "call_booked",
      amount: mapping.offer.current_price,
      entry_path: "other",
      description: "",
    },
  });

  await finishAttaching(dataProvider, salesCall, deal.id);
  return { applied: true };
};

// Path 3: this booking should never enter the sales pipeline (a test
// booking, a mistake, a non-sales situation). Durable and distinct from
// "unresolved" — see sales_calls.dismissed_at's own schema comment — so a
// duplicate Acuity webhook replay can never resurrect the alert, and this
// is never confused with a genuine match.
export const dismissSalesCall = async (
  dataProvider: DataProvider,
  { salesCallId, reason }: { salesCallId: Identifier; reason?: string | null },
): Promise<ResolveOutcome> => {
  const salesCall = await fetchSalesCall(dataProvider, salesCallId);
  if (!isUnresolved(salesCall)) {
    return { applied: false, reason: "already-resolved" };
  }

  const now = new Date().toISOString();
  const dismissalReason = reason?.trim() || null;
  await dataProvider.update("sales_calls", {
    id: salesCall.id,
    data: { dismissed_at: now, dismissal_reason: dismissalReason },
    previousData: salesCall,
  });
  await dataProvider.create("sales_call_events", {
    data: {
      sales_call_id: salesCall.id,
      kind: "dismissed",
      occurred_at: now,
      dismissal_reason: dismissalReason,
    },
  });
  await completeResolveSalesCallTask(
    dataProvider,
    salesCall.contact_id,
    now,
    salesCall.id,
  );

  return { applied: true };
};
