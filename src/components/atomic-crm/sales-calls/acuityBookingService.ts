import type { DataProvider } from "ra-core";

import type { SalesCall } from "../types";
import { bookSalesCall, type BookSalesCallResult } from "./bookSalesCall";
import { cancelSalesCall, type CancelSalesCallResult } from "./cancelSalesCall";
import { matchAcuityBooking } from "./matchAcuityBooking";
import {
  rescheduleSalesCall,
  type RescheduleSalesCallResult,
} from "./rescheduleSalesCall";

// This is the fixture-testable "domain service" boundary the Acuity/Sales
// Call Lifecycle slice's integration point is built against — see this
// slice's report for exactly what remains to connect against a real
// Acuity account. supabase/functions/acuity_webhook/index.ts is its
// production mirror (same dual-implementation convention as every other
// integration in this app): a real Acuity webhook only POSTs
// {action, id, calendarID, appointmentTypeID} and requires a follow-up
// authenticated GET to Acuity's API for the fields below (email, name,
// datetime) — this module's input IS the shape that GET call returns, so
// it is exercised end-to-end here with fixtures standing in for that call.
export type AcuityAppointmentPayload = {
  acuityAppointmentId: string;
  acuityAppointmentTypeId: string;
  email: string;
  firstName: string;
  lastName: string;
  // ISO 8601 — Acuity's own `datetime` field.
  datetime: string;
};

export type AcuityWebhookAction = "scheduled" | "rescheduled" | "canceled";

export type ProcessAcuityWebhookInput = {
  dataProvider: DataProvider;
  action: AcuityWebhookAction;
  appointment: AcuityAppointmentPayload;
};

export type ProcessAcuityWebhookResult =
  | {
      status: "booked";
      matchReason: "matched" | "none" | "ambiguous";
      booking: BookSalesCallResult;
    }
  | { status: "unknown-appointment-type" }
  | { status: "rescheduled"; result: RescheduleSalesCallResult }
  | { status: "cancelled"; result: CancelSalesCallResult }
  // A reschedule/cancel event referencing an appointment id this CRM never
  // recorded a booking for (e.g. the original "scheduled" webhook was
  // missed) — nothing to safely act on without the identity/offer context
  // only the "scheduled" flow resolves.
  | { status: "unknown-appointment" };

// Routes one Acuity lifecycle action to the right domain function. Acuity
// appointment occurrence never implies attendance (confirmed against
// Acuity's own public API docs: a canceled appointment can carry a
// noShow flag, but only an admin sets it in Acuity itself, and there is no
// "attended" signal at all) — this service never writes attendance;
// that stays completeSalesCallOutcome.ts's job, triggered by an explicit
// human action in the CRM.
export const processAcuityWebhookEvent = async (
  input: ProcessAcuityWebhookInput,
): Promise<ProcessAcuityWebhookResult> => {
  const { dataProvider, action, appointment } = input;

  if (action === "canceled") {
    const existing = await findByAcuityAppointmentId(
      dataProvider,
      appointment.acuityAppointmentId,
    );
    if (!existing) return { status: "unknown-appointment" };
    const result = await cancelSalesCall(dataProvider, existing.id);
    return { status: "cancelled", result };
  }

  if (action === "rescheduled") {
    const existing = await findByAcuityAppointmentId(
      dataProvider,
      appointment.acuityAppointmentId,
    );
    if (!existing) {
      // Never recorded the original booking — treat this as the first
      // booking we're able to record rather than dropping a real
      // scheduling fact on the floor.
      return handleScheduled(dataProvider, appointment);
    }
    const result = await rescheduleSalesCall(dataProvider, {
      salesCallId: existing.id,
      newScheduledAt: appointment.datetime,
    });
    return { status: "rescheduled", result };
  }

  return handleScheduled(dataProvider, appointment);
};

const findByAcuityAppointmentId = async (
  dataProvider: DataProvider,
  acuityAppointmentId: string,
): Promise<SalesCall | null> => {
  const { data } = await dataProvider.getList<SalesCall>("sales_calls", {
    filter: { acuity_appointment_id: acuityAppointmentId },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  return data[0] ?? null;
};

const handleScheduled = async (
  dataProvider: DataProvider,
  appointment: AcuityAppointmentPayload,
): Promise<ProcessAcuityWebhookResult> => {
  const match = await matchAcuityBooking(dataProvider, {
    email: appointment.email,
    firstName: appointment.firstName,
    lastName: appointment.lastName,
    acuityAppointmentTypeId: appointment.acuityAppointmentTypeId,
  });
  if (match.status === "unknown-appointment-type") {
    return { status: "unknown-appointment-type" };
  }

  const opportunityId =
    match.status === "matched" ? match.opportunity.id : null;
  const contactName =
    `${match.contact.first_name ?? ""} ${match.contact.last_name ?? ""}`.trim();

  const booking = await bookSalesCall({
    dataProvider,
    contactId: match.contact.id,
    contactName,
    opportunityId,
    scheduledAt: appointment.datetime,
    source: "acuity",
    acuityAppointmentId: appointment.acuityAppointmentId,
    acuityAppointmentTypeId: appointment.acuityAppointmentTypeId,
    offerName: match.offer.name,
    cohortName: match.cohort?.name,
  });

  return {
    status: "booked",
    matchReason: match.status === "matched" ? "matched" : match.reason,
    booking,
  };
};
