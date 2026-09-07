import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import type { AcuityAppointmentDetails } from "./acuityApi.ts";
import { jsonResponse } from "./acuitySalesCallHandlers.ts";
import {
  findActiveEnrollmentForClientSession,
  findOrCreateContactForClientSession,
  resolveOfferForClientSession,
} from "./acuityClientSessionMatching.ts";

// Client + Session Operations slice A, cadence-corrected. Mirrors (does
// not share code with — Deno Edge Functions can't import from src/)
// src/components/atomic-crm/sessions/bookClientSession.ts +
// rescheduleClientSession.ts + cancelClientSession.ts, the fixture-tested
// "logic of record" for this same lifecycle. Deliberately does not
// create/touch any Task — Tasks/Needs Attention for client-session
// anomalies are explicitly out of scope for this slice (a rare
// unresolved/ambiguous session is preserved with enrollment_id null, same
// as sales_calls' own precedent, but without a resolution UI yet). A
// booked session is assumed attended BY DEFAULT (cadence correction — see
// types.ts's own ClientSession comment); none of these handlers ever set
// no_show_at, that stays the Enrollment page's own explicit human action.

type ClientSessionRow = {
  id: number;
  contact_id: number;
  status: string;
  scheduled_at: string;
  reschedule_count: number;
};

export const handleClientSessionScheduled = async (
  appointment: AcuityAppointmentDetails,
  acuityAppointmentId: string,
): Promise<Response> => {
  // Idempotent: a replayed/duplicate "scheduled" webhook for an
  // appointment id already recorded is a safe no-op, never a second row.
  const { data: existingByAcuityId } = await supabaseAdmin
    .from("client_sessions")
    .select("id")
    .eq("acuity_appointment_id", acuityAppointmentId)
    .limit(1);
  if (existingByAcuityId && existingByAcuityId.length > 0) {
    return jsonResponse({ status: "already-booked" });
  }

  const offer = await resolveOfferForClientSession(
    String(appointment.appointmentTypeID),
  );
  if (!offer) return jsonResponse({ status: "unknown-appointment-type" });

  const contact = await findOrCreateContactForClientSession(appointment);

  const { enrollment, ambiguous } = await findActiveEnrollmentForClientSession({
    contactId: contact.id,
    offerId: offer.id,
  });

  const { data: clientSession, error } = await supabaseAdmin
    .from("client_sessions")
    .insert({
      contact_id: contact.id,
      enrollment_id: enrollment?.id ?? null,
      offer_id: offer.id,
      status: "booked",
      scheduled_at: appointment.datetime,
      reschedule_count: 0,
      source: "acuity",
      acuity_appointment_id: acuityAppointmentId,
      acuity_appointment_type_id: String(appointment.appointmentTypeID),
    })
    .select("id")
    .single();
  if (error || !clientSession)
    throw new Error(error?.message ?? "Failed to create client session");

  await supabaseAdmin.from("client_session_events").insert({
    client_session_id: clientSession.id,
    kind: "booked",
    occurred_at: new Date().toISOString(),
    new_scheduled_at: appointment.datetime,
  });

  return jsonResponse({
    status: "booked",
    matchReason: enrollment ? "matched" : ambiguous ? "ambiguous" : "none",
  });
};

export const handleClientSessionRescheduled = async (
  appointment: AcuityAppointmentDetails,
  acuityAppointmentId: string,
): Promise<Response> => {
  const { data: existing } = await supabaseAdmin
    .from("client_sessions")
    .select("id, contact_id, status, scheduled_at, reschedule_count")
    .eq("acuity_appointment_id", acuityAppointmentId)
    .maybeSingle();
  if (!existing) {
    return handleClientSessionScheduled(appointment, acuityAppointmentId);
  }

  const row = existing as ClientSessionRow;
  // Out-of-order delivery guard, mirroring rescheduleClientSession.ts
  // exactly — a cancelled session must never be silently reopened by a
  // reschedule webhook.
  if (row.status === "cancelled") {
    return jsonResponse({ status: "cancelled-session" });
  }
  if (row.scheduled_at === appointment.datetime) {
    return jsonResponse({ status: "already-current" });
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("client_sessions")
    .update({
      scheduled_at: appointment.datetime,
      reschedule_count: row.reschedule_count + 1,
      last_rescheduled_at: now,
    })
    .eq("id", row.id);

  await supabaseAdmin.from("client_session_events").insert({
    client_session_id: row.id,
    kind: "rescheduled",
    occurred_at: now,
    previous_scheduled_at: row.scheduled_at,
    new_scheduled_at: appointment.datetime,
  });

  return jsonResponse({ status: "rescheduled" });
};

// Returns null (never a Response) when no client_sessions row matches this
// appointment id — the caller (index.ts) then falls through to the
// existing sales-call handleCanceled unchanged, since Acuity's own
// "canceled" webhook body carries no appointment type, only the id.
export const tryHandleClientSessionCanceled = async (
  acuityAppointmentId: string,
): Promise<Response | null> => {
  const { data: existing } = await supabaseAdmin
    .from("client_sessions")
    .select("id, status")
    .eq("acuity_appointment_id", acuityAppointmentId)
    .maybeSingle();
  if (!existing) return null;

  const row = existing as { id: number; status: string };
  if (row.status === "cancelled") {
    return jsonResponse({ status: "already-cancelled" });
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("client_sessions")
    .update({ status: "cancelled", cancelled_at: now })
    .eq("id", row.id);
  await supabaseAdmin.from("client_session_events").insert({
    client_session_id: row.id,
    kind: "cancelled",
    occurred_at: now,
  });

  return jsonResponse({ status: "cancelled" });
};
