import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import type { AcuityAppointmentDetails } from "./acuityApi.ts";
import {
  findActiveOpportunity,
  findOrCreateContact,
  resolveOfferCohort,
} from "./acuityMatching.ts";

// Live Acuity Connection slice. Mirrors (does not share code with — Deno
// Edge Functions can't import from src/) src/components/atomic-crm/
// sales-calls/bookSalesCall.ts + rescheduleSalesCall.ts + cancelSalesCall.ts,
// the fixture-tested "logic of record" for this same lifecycle. Acuity
// appointment occurrence never implies attendance (confirmed against
// Acuity's own public API docs: no "attended" signal exists at all) — none
// of these handlers write attendance; that stays
// completeSalesCallOutcome.ts's job, triggered by an explicit human action
// in the CRM UI.

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

type SalesCallRow = {
  id: number;
  opportunity_id: number | null;
  contact_id: number;
  status: string;
  scheduled_at: string;
  reschedule_count: number;
};

const resolveDefaultTaskSalesId = async (): Promise<number | undefined> => {
  const { data } = await supabaseAdmin
    .from("sales")
    .select("id")
    .eq("administrator", true)
    .limit(1);
  return data?.[0]?.id;
};

// Unmatched Sales Call Resolution slice: salesCallId is only ever passed
// for type "resolve_sales_call" — mirrors src/'s own resolveSalesCallTask.ts
// exactly (deterministic dedup by sales_call_id when known, since a
// returning Contact can have more than one unresolved booking at once).
const ensureTask = async (params: {
  contactId: number;
  type: string;
  text: string;
  dueDate: string;
  salesCallId?: number;
}) => {
  const { data: existingTasks } = await supabaseAdmin
    .from("tasks")
    .select("id, done_date, due_date, sales_call_id")
    .eq("contact_id", params.contactId)
    .eq("type", params.type);
  const pendingTasks = (
    (existingTasks ?? []) as {
      id: number;
      done_date: string | null;
      due_date: string;
      sales_call_id: number | null;
    }[]
  ).filter((task) => !task.done_date);
  const pending =
    (params.salesCallId != null
      ? pendingTasks.find((task) => task.sales_call_id === params.salesCallId)
      : undefined) ?? pendingTasks.find((task) => task.sales_call_id == null);
  if (pending) {
    if (pending.due_date !== params.dueDate) {
      await supabaseAdmin
        .from("tasks")
        .update({ due_date: params.dueDate })
        .eq("id", pending.id);
    }
    return;
  }

  const salesId = await resolveDefaultTaskSalesId();
  await supabaseAdmin.from("tasks").insert({
    contact_id: params.contactId,
    type: params.type,
    text: params.text,
    due_date: params.dueDate,
    status: "pending",
    ...(params.salesCallId != null
      ? { sales_call_id: params.salesCallId }
      : {}),
    ...(salesId != null ? { sales_id: salesId } : {}),
  });
};

// No date-fns in this Edge Function (Deno, kept dependency-light) —
// Intl.DateTimeFormat gives the same "human-readable date + time" result
// src/'s formatTimestampWithTimeString provides via date-fns.
const formatDateTime = (iso: string): string =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

// Completing manually here (rather than deleting) must never affect sales
// status — same rule as every completion helper in this app. A safe no-op
// when no such task is pending.
const completeTaskIfPending = async (params: {
  contactId: number;
  type: string;
  completedAt: string;
}) => {
  const { data: existingTasks } = await supabaseAdmin
    .from("tasks")
    .select("id, done_date")
    .eq("contact_id", params.contactId)
    .eq("type", params.type);
  const pending = (
    (existingTasks ?? []) as { id: number; done_date: string | null }[]
  ).find((task) => !task.done_date);
  if (!pending) return;
  await supabaseAdmin
    .from("tasks")
    .update({ done_date: params.completedAt, status: "completed" })
    .eq("id", pending.id);
};

// Only the exact "Approved -> Call Booked" transition — an Opportunity
// already further along is left exactly where it is. This is a plain
// `update deals set stage = ...`, so it goes through the same Postgres
// triggers (set_deal_stage_entered_at() / record_deal_stage_event(),
// supabase/schemas/02_functions.sql) every other stage-changing pathway
// does — no special-casing needed here for stage_entered_at/
// deal_stage_events to stay correct.
const advanceApprovedToCallBooked = async (opportunityId: number) => {
  const { data: deal } = await supabaseAdmin
    .from("deals")
    .select("id, stage")
    .eq("id", opportunityId)
    .maybeSingle();
  if (!deal || deal.stage !== "approved") return;
  await supabaseAdmin
    .from("deals")
    .update({ stage: "call_booked" })
    .eq("id", opportunityId);
};

export const handleScheduled = async (
  appointment: AcuityAppointmentDetails,
  acuityAppointmentId: string,
): Promise<Response> => {
  // Idempotent: a replayed/duplicate "scheduled" webhook for an
  // appointment id already recorded is a safe no-op, never a second row.
  const { data: existingByAcuityId } = await supabaseAdmin
    .from("sales_calls")
    .select("id")
    .eq("acuity_appointment_id", acuityAppointmentId)
    .limit(1);
  if (existingByAcuityId && existingByAcuityId.length > 0) {
    return jsonResponse({ status: "already-booked" });
  }

  const mapping = await resolveOfferCohort(
    String(appointment.appointmentTypeID),
  );
  if (!mapping) return jsonResponse({ status: "unknown-appointment-type" });

  const contact = await findOrCreateContact(appointment);
  const contactName =
    `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();

  const { deal, ambiguous } = await findActiveOpportunity({
    contactId: contact.id,
    offerId: mapping.offer.id,
    cohortId: mapping.cohort?.id ?? null,
  });

  const { data: salesCall, error } = await supabaseAdmin
    .from("sales_calls")
    .insert({
      opportunity_id: deal?.id ?? null,
      contact_id: contact.id,
      status: "booked",
      original_scheduled_at: appointment.datetime,
      scheduled_at: appointment.datetime,
      reschedule_count: 0,
      source: "acuity",
      acuity_appointment_id: acuityAppointmentId,
      acuity_appointment_type_id: String(appointment.appointmentTypeID),
    })
    .select("id")
    .single();
  if (error || !salesCall)
    throw new Error(error?.message ?? "Failed to create sales call");

  await supabaseAdmin.from("sales_call_events").insert({
    sales_call_id: salesCall.id,
    kind: "booked",
    occurred_at: new Date().toISOString(),
    new_scheduled_at: appointment.datetime,
  });

  if (deal) {
    await advanceApprovedToCallBooked(deal.id);
    await ensureTask({
      contactId: contact.id,
      type: "sales_call",
      text: `Sales call with ${contactName}`,
      dueDate: appointment.datetime,
    });
    // The person is back on the calendar — resolves any "sales call was
    // cancelled, decide next steps" task a prior cancellation on this same
    // Opportunity left open (GYU real-infrastructure slice, human-
    // acceptance repair pass). Mirrors bookSalesCall.ts's own call.
    await completeTaskIfPending({
      contactId: contact.id,
      type: "sales_call_cancelled",
      completedAt: new Date().toISOString(),
    });
  } else {
    // Never fabricate an Opportunity to make the webhook "succeed" — the
    // booking is preserved with opportunity_id null and surfaced via the
    // same "Sales call needs matching" Task the CRM UI already knows how
    // to render (self-describing text, Task.tsx) and resolve
    // (/sales-calls/:id/resolve, sales-calls/resolveUnmatchedSalesCall.ts).
    const offerLabel = mapping.cohort
      ? `${mapping.offer.name} — ${mapping.cohort.name}`
      : mapping.offer.name;
    await ensureTask({
      contactId: contact.id,
      type: "resolve_sales_call",
      text: `${contactName} · ${offerLabel} · ${formatDateTime(appointment.datetime)}`,
      dueDate: new Date().toISOString(),
      salesCallId: salesCall.id,
    });
  }

  return jsonResponse({
    status: "booked",
    matchReason: deal ? "matched" : ambiguous ? "ambiguous" : "none",
  });
};

export const handleRescheduled = async (
  appointment: AcuityAppointmentDetails,
  acuityAppointmentId: string,
): Promise<Response> => {
  const { data: existing } = await supabaseAdmin
    .from("sales_calls")
    .select("id, contact_id, scheduled_at, reschedule_count, status")
    .eq("acuity_appointment_id", acuityAppointmentId)
    .maybeSingle();
  if (!existing) return handleScheduled(appointment, acuityAppointmentId);

  const row = existing as SalesCallRow & {
    scheduled_at: string;
    reschedule_count: number;
    status: string;
  };
  // Out-of-order delivery guard: a "cancelled" call must never be silently
  // resurrected by a reschedule webhook that happens to arrive after the
  // cancellation was already processed — mirrors rescheduleSalesCall.ts's
  // own guard exactly (a real drift this slice's audit found and fixed:
  // this handler was previously missing it).
  if (row.status === "cancelled") {
    return jsonResponse({ status: "cancelled-call" });
  }
  if (row.scheduled_at === appointment.datetime) {
    return jsonResponse({ status: "already-current" });
  }

  await supabaseAdmin
    .from("sales_calls")
    .update({
      scheduled_at: appointment.datetime,
      reschedule_count: row.reschedule_count + 1,
      last_rescheduled_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  await supabaseAdmin.from("sales_call_events").insert({
    sales_call_id: row.id,
    kind: "rescheduled",
    occurred_at: new Date().toISOString(),
    previous_scheduled_at: row.scheduled_at,
    new_scheduled_at: appointment.datetime,
  });

  const { data: pendingTask } = await supabaseAdmin
    .from("tasks")
    .select("id, done_date")
    .eq("contact_id", row.contact_id)
    .eq("type", "sales_call");
  const pending = (
    (pendingTask ?? []) as { id: number; done_date: string | null }[]
  ).find((task) => !task.done_date);
  if (pending) {
    await supabaseAdmin
      .from("tasks")
      .update({ due_date: appointment.datetime })
      .eq("id", pending.id);
  }

  return jsonResponse({ status: "rescheduled" });
};

// GYU real-infrastructure slice, human-acceptance repair pass: mirrors
// src/components/atomic-crm/sales-calls/cancelSalesCall.ts's own
// ensureFollowUpIfStranded exactly — NO ACTIVE SALES CALL + OPPORTUNITY
// STILL CALL_BOOKED must always leave a human task visible, so a
// cancellation (which deliberately never regresses the Opportunity's
// stage) never lets a lead silently strand. See that file's own comment
// for the full rationale; this is the hand-mirrored production copy
// (Deno Edge Functions can't import from src/).
const ensureSalesCallCancelledFollowUp = async (params: {
  opportunityId: number | null;
  contactId: number;
}): Promise<void> => {
  if (params.opportunityId == null) return;

  const { data: deal } = await supabaseAdmin
    .from("deals")
    .select("id, stage")
    .eq("id", params.opportunityId)
    .maybeSingle();
  if (!deal || deal.stage !== "call_booked") return;

  const { data: otherBooked } = await supabaseAdmin
    .from("sales_calls")
    .select("id")
    .eq("opportunity_id", params.opportunityId)
    .eq("status", "booked")
    .limit(1);
  if (otherBooked && otherBooked.length > 0) return;

  const { data: existingTask } = await supabaseAdmin
    .from("tasks")
    .select("id, done_date")
    .eq("contact_id", params.contactId)
    .eq("type", "sales_call_cancelled");
  const pending = (
    (existingTask ?? []) as { id: number; done_date: string | null }[]
  ).find((task) => !task.done_date);
  if (pending) return;

  const { data: contact } = await supabaseAdmin
    .from("contacts")
    .select("first_name, last_name")
    .eq("id", params.contactId)
    .maybeSingle();
  const contactName = contact
    ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
    : "This contact";

  const salesId = await resolveDefaultTaskSalesId();
  await supabaseAdmin.from("tasks").insert({
    contact_id: params.contactId,
    type: "sales_call_cancelled",
    text: `${contactName}'s sales call was cancelled — decide next steps`,
    due_date: new Date().toISOString(),
    status: "pending",
    ...(salesId != null ? { sales_id: salesId } : {}),
  });
};

export const handleCanceled = async (
  acuityAppointmentId: string,
): Promise<Response> => {
  const { data: existing } = await supabaseAdmin
    .from("sales_calls")
    .select("id, contact_id, opportunity_id, status")
    .eq("acuity_appointment_id", acuityAppointmentId)
    .maybeSingle();
  if (!existing) return jsonResponse({ status: "unknown-appointment" });
  const row = existing as {
    id: number;
    contact_id: number;
    opportunity_id: number | null;
    status: string;
  };
  if (row.status === "cancelled") {
    return jsonResponse({ status: "already-cancelled" });
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("sales_calls")
    .update({ status: "cancelled", cancelled_at: now })
    .eq("id", row.id);
  await supabaseAdmin.from("sales_call_events").insert({
    sales_call_id: row.id,
    kind: "cancelled",
    occurred_at: now,
  });

  const { data: pendingTask } = await supabaseAdmin
    .from("tasks")
    .select("id, done_date")
    .eq("contact_id", row.contact_id)
    .eq("type", "sales_call");
  const pending = (
    (pendingTask ?? []) as { id: number; done_date: string | null }[]
  ).find((task) => !task.done_date);
  if (pending) {
    await supabaseAdmin
      .from("tasks")
      .update({ status: "cancelled" })
      .eq("id", pending.id);
  }

  await ensureSalesCallCancelledFollowUp({
    opportunityId: row.opportunity_id,
    contactId: row.contact_id,
  });

  return jsonResponse({ status: "cancelled" });
};
