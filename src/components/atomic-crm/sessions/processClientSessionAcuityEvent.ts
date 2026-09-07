import type { DataProvider } from "ra-core";

import type { ClientSession } from "../types";
import {
  bookClientSession,
  type BookClientSessionResult,
} from "./bookClientSession";
import {
  cancelClientSession,
  type CancelClientSessionResult,
} from "./cancelClientSession";
import { matchClientSessionAppointment } from "./matchClientSessionAppointment";
import {
  rescheduleClientSession,
  type RescheduleClientSessionResult,
} from "./rescheduleClientSession";

// The fixture-testable "domain service" boundary for paid-client-session
// Acuity events — mirrors sales-calls/acuityBookingService.ts's own shape
// exactly (same dual-implementation convention: supabase/functions/
// acuity_webhook/acuityClientSessionHandlers.ts is its production mirror).
// Callers (the Deno webhook, this module's own tests) are expected to have
// ALREADY determined the incoming appointment type maps to a paid-client-
// session Offer (via clientSessionAcuityMapping.ts) before reaching here —
// this module never touches sales_calls/resolve_sales_call Tasks/
// Opportunity sales stage in any way.
export type AcuityAppointmentPayload = {
  acuityAppointmentId: string;
  acuityAppointmentTypeId: string;
  email: string;
  firstName: string;
  lastName: string;
  datetime: string;
};

export type ProcessClientSessionEventResult =
  | {
      status: "booked";
      matchReason: "matched" | "none" | "ambiguous";
      booking: BookClientSessionResult;
    }
  | { status: "unknown-appointment-type" }
  | { status: "rescheduled"; result: RescheduleClientSessionResult }
  | { status: "cancelled"; result: CancelClientSessionResult }
  // A reschedule/cancel event referencing an appointment id this CRM never
  // recorded a session for (e.g. the original "scheduled" webhook was
  // missed) — same as acuityBookingService.ts's own "unknown-appointment".
  | { status: "unknown-appointment" };

export const processClientSessionAcuityEvent = async (
  dataProvider: DataProvider,
  action: "scheduled" | "rescheduled" | "canceled",
  appointment: AcuityAppointmentPayload,
): Promise<ProcessClientSessionEventResult> => {
  if (action === "canceled") {
    const existing = await findByAcuityAppointmentId(
      dataProvider,
      appointment.acuityAppointmentId,
    );
    if (!existing) return { status: "unknown-appointment" };
    const result = await cancelClientSession(dataProvider, existing.id);
    return { status: "cancelled", result };
  }

  if (action === "rescheduled") {
    const existing = await findByAcuityAppointmentId(
      dataProvider,
      appointment.acuityAppointmentId,
    );
    if (!existing) {
      return handleScheduled(dataProvider, appointment);
    }
    const result = await rescheduleClientSession(dataProvider, {
      clientSessionId: existing.id,
      newScheduledAt: appointment.datetime,
    });
    return { status: "rescheduled", result };
  }

  return handleScheduled(dataProvider, appointment);
};

const findByAcuityAppointmentId = async (
  dataProvider: DataProvider,
  acuityAppointmentId: string,
): Promise<ClientSession | null> => {
  const { data } = await dataProvider.getList<ClientSession>(
    "client_sessions",
    {
      filter: { acuity_appointment_id: acuityAppointmentId },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
  );
  return data[0] ?? null;
};

const handleScheduled = async (
  dataProvider: DataProvider,
  appointment: AcuityAppointmentPayload,
): Promise<ProcessClientSessionEventResult> => {
  const match = await matchClientSessionAppointment(dataProvider, {
    email: appointment.email,
    firstName: appointment.firstName,
    lastName: appointment.lastName,
    acuityAppointmentTypeId: appointment.acuityAppointmentTypeId,
  });
  if (match.status === "unknown-appointment-type") {
    return { status: "unknown-appointment-type" };
  }

  const enrollmentId = match.status === "matched" ? match.enrollment.id : null;

  const booking = await bookClientSession({
    dataProvider,
    contactId: match.contact.id,
    enrollmentId,
    offerId: match.offer.id,
    scheduledAt: appointment.datetime,
    source: "acuity",
    acuityAppointmentId: appointment.acuityAppointmentId,
    acuityAppointmentTypeId: appointment.acuityAppointmentTypeId,
  });

  return {
    status: "booked",
    matchReason: match.status === "matched" ? "matched" : match.reason,
    booking,
  };
};
