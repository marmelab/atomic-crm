// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

// Acuity/Sales Call Lifecycle slice — the production webhook receiver.
// Business rules here MIRROR (do not share code with — Deno/Edge Functions
// don't import from src/) src/components/atomic-crm/sales-calls/
// acuityBookingService.ts + matchAcuityBooking.ts + bookSalesCall.ts +
// rescheduleSalesCall.ts + cancelSalesCall.ts, the FakeRest/dev-testable
// "logic of record" for this same slice — exhaustively unit-tested there
// with fixtures. Same dual-implementation convention as public_application/
// index.ts. Uses supabaseAdmin (service-role, bypasses RLS) the same way
// that function does, since Acuity is an external caller with no CRM
// session — every table's RLS is `to authenticated` only.
//
// NOT LIVE-CONNECTED. Two things remain before this can run against a real
// Acuity account, neither of which this session has:
//
//  1. ACUITY_USER_ID / ACUITY_API_KEY secrets, set via
//     `npx supabase secrets set` — used below to call Acuity's
//     GET /api/v1/appointments/:id (Basic Auth), which is REQUIRED: a real
//     Acuity webhook only POSTs {action, id, calendarID, appointmentTypeID}
//     — no name/email/time — confirmed against Acuity's own public API
//     docs (developers.acuityscheduling.com). Without these secrets this
//     function returns a clear "not configured" error rather than
//     fabricating appointment data.
//  2. A webhook actually registered in Acuity's own dashboard (Business
//     Settings -> Integrations -> API) pointing at this function's URL —
//     genuine external account setup, deferred per this slice's own
//     instruction not to ask Leif to do that until it's the next real step.
//
// UNVERIFIED THIS SESSION: no local Supabase/Docker was available to run
// or smoke-test this either. Once (1) and (2) above are done, smoke-test
// locally with a real Acuity sandbox appointment via:
//
//   curl -i --location --request POST \
//     'http://127.0.0.1:54321/functions/v1/acuity_webhook' \
//     --header 'Content-Type: application/x-www-form-urlencoded' \
//     --data 'action=scheduled&id=12345&calendarID=1&appointmentTypeID=67890'

type AcuityAction = "scheduled" | "rescheduled" | "canceled" | "changed";

type AcuityAppointmentDetails = {
  email: string;
  firstName: string;
  lastName: string;
  datetime: string;
  appointmentTypeID: number;
};

type OfferRow = {
  id: number;
  type: "individual" | "group";
  acuity_appointment_type_id: string | null;
};
type CohortRow = {
  id: number;
  offer_id: number;
  acuity_appointment_type_id: string | null;
};
type ContactRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email_jsonb: { email: string; type: string }[] | null;
};
type DealRow = {
  id: number;
  contact_id: number;
  offer_id: number;
  cohort_id: number | null;
  stage: string;
  outcome: string | null;
  archived_at: string | null;
};
type SalesCallRow = {
  id: number;
  opportunity_id: number | null;
  contact_id: number;
  status: string;
  scheduled_at: string;
  reschedule_count: number;
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

// Acuity's own GET /appointments/:id shape (developers.acuityscheduling.com)
// — this is what a real webhook's minimal {action, id} requires a follow-up
// authenticated call to fetch.
const fetchAcuityAppointment = async (
  appointmentId: string,
): Promise<AcuityAppointmentDetails | null> => {
  const userId = Deno.env.get("ACUITY_USER_ID");
  const apiKey = Deno.env.get("ACUITY_API_KEY");
  if (!userId || !apiKey) return null;

  const auth = btoa(`${userId}:${apiKey}`);
  const response = await fetch(
    `https://acuityscheduling.com/api/v1/appointments/${appointmentId}`,
    { headers: { Authorization: `Basic ${auth}` } },
  );
  if (!response.ok) return null;
  const data = await response.json();
  return {
    email: String(data.email ?? ""),
    firstName: String(data.firstName ?? ""),
    lastName: String(data.lastName ?? ""),
    datetime: String(data.datetime ?? ""),
    appointmentTypeID: Number(data.appointmentTypeID),
  };
};

const isActiveDeal = (
  deal: Pick<DealRow, "stage" | "outcome" | "archived_at">,
) => deal.archived_at == null && deal.stage !== "won" && deal.outcome == null;

const resolveOfferCohort = async (
  appointmentTypeId: string,
): Promise<{ offer: OfferRow; cohort: CohortRow | null } | null> => {
  const { data: offers } = await supabaseAdmin
    .from("offers")
    .select("id, type, acuity_appointment_type_id")
    .eq("acuity_appointment_type_id", appointmentTypeId)
    .limit(1);
  if (offers && offers.length > 0) {
    return { offer: offers[0] as OfferRow, cohort: null };
  }

  const { data: cohorts } = await supabaseAdmin
    .from("cohorts")
    .select("id, offer_id, acuity_appointment_type_id")
    .eq("acuity_appointment_type_id", appointmentTypeId)
    .limit(1);
  if (!cohorts || cohorts.length === 0) return null;
  const cohort = cohorts[0] as CohortRow;

  const { data: offer } = await supabaseAdmin
    .from("offers")
    .select("id, type, acuity_appointment_type_id")
    .eq("id", cohort.offer_id)
    .maybeSingle();
  if (!offer) return null;
  return { offer: offer as OfferRow, cohort };
};

const findOrCreateContact = async (params: {
  firstName: string;
  lastName: string;
  email: string;
}): Promise<ContactRow> => {
  const normalized = normalizeEmail(params.email);
  const { data: contacts } = await supabaseAdmin
    .from("contacts")
    .select("id, first_name, last_name, email_jsonb");
  const existing = ((contacts ?? []) as ContactRow[]).find((contact) =>
    (contact.email_jsonb ?? []).some(
      (entry) => entry.email && normalizeEmail(entry.email) === normalized,
    ),
  );
  if (existing) {
    await supabaseAdmin
      .from("contacts")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", existing.id);
    return existing;
  }

  const { data: created, error } = await supabaseAdmin
    .from("contacts")
    .insert({
      first_name: params.firstName,
      last_name: params.lastName,
      email_jsonb: [{ email: normalized, type: "Other" }],
      phone_jsonb: [],
      tags: [],
      has_newsletter: false,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      sales_eligibility: "normal",
    })
    .select("id, first_name, last_name, email_jsonb")
    .single();
  if (error || !created)
    throw new Error(error?.message ?? "Failed to create contact");
  return created as ContactRow;
};

const findActiveOpportunity = async (params: {
  contactId: number;
  offerId: number;
  cohortId: number | null;
}): Promise<{ deal: DealRow | null; ambiguous: boolean }> => {
  let query = supabaseAdmin
    .from("deals")
    .select("id, contact_id, offer_id, cohort_id, stage, outcome, archived_at")
    .eq("contact_id", params.contactId)
    .eq("offer_id", params.offerId);
  query =
    params.cohortId != null ? query.eq("cohort_id", params.cohortId) : query;
  const { data } = await query;
  const active = ((data ?? []) as DealRow[]).filter(isActiveDeal);
  if (active.length === 0) return { deal: null, ambiguous: false };
  if (active.length > 1) return { deal: null, ambiguous: true };
  return { deal: active[0], ambiguous: false };
};

const resolveDefaultTaskSalesId = async (): Promise<number | undefined> => {
  const { data } = await supabaseAdmin
    .from("sales")
    .select("id")
    .eq("administrator", true)
    .limit(1);
  return data?.[0]?.id;
};

const ensureTask = async (params: {
  contactId: number;
  type: string;
  text: string;
  dueDate: string;
}) => {
  const { data: existingTasks } = await supabaseAdmin
    .from("tasks")
    .select("id, done_date, due_date")
    .eq("contact_id", params.contactId)
    .eq("type", params.type);
  const pending = (
    (existingTasks ?? []) as {
      id: number;
      done_date: string | null;
      due_date: string;
    }[]
  ).find((task) => !task.done_date);
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
    ...(salesId != null ? { sales_id: salesId } : {}),
  });
};

// Only the exact "Approved -> Call Booked" transition — an Opportunity
// already further along is left exactly where it is.
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

const handleScheduled = async (
  appointment: AcuityAppointmentDetails,
  acuityAppointmentId: string,
) => {
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
  } else {
    await ensureTask({
      contactId: contact.id,
      type: "resolve_sales_call",
      text: `${contactName} booked a call that couldn't be matched to one Opportunity — pick the right one`,
      dueDate: new Date().toISOString(),
    });
  }

  return jsonResponse({
    status: "booked",
    matchReason: deal ? "matched" : ambiguous ? "ambiguous" : "none",
  });
};

const handleRescheduled = async (
  appointment: AcuityAppointmentDetails,
  acuityAppointmentId: string,
) => {
  const { data: existing } = await supabaseAdmin
    .from("sales_calls")
    .select("id, contact_id, scheduled_at, reschedule_count")
    .eq("acuity_appointment_id", acuityAppointmentId)
    .maybeSingle();
  if (!existing) return handleScheduled(appointment, acuityAppointmentId);

  const row = existing as SalesCallRow & {
    scheduled_at: string;
    reschedule_count: number;
  };
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

const handleCanceled = async (acuityAppointmentId: string) => {
  const { data: existing } = await supabaseAdmin
    .from("sales_calls")
    .select("id, contact_id, status")
    .eq("acuity_appointment_id", acuityAppointmentId)
    .maybeSingle();
  if (!existing) return jsonResponse({ status: "unknown-appointment" });
  const row = existing as { id: number; contact_id: number; status: string };
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

  return jsonResponse({ status: "cancelled" });
};

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method Not Allowed");
    }

    let body: Record<string, string>;
    const contentType = req.headers.get("content-type") ?? "";
    try {
      if (contentType.includes("application/json")) {
        body = await req.json();
      } else {
        const form = await req.formData();
        body = Object.fromEntries(
          Array.from(form.entries()).map(([key, value]) => [
            key,
            String(value),
          ]),
        );
      }
    } catch {
      return createErrorResponse(400, "Invalid request body");
    }

    const action = body.action as AcuityAction | undefined;
    const appointmentId = body.id;
    if (!action || !appointmentId) {
      return createErrorResponse(400, "Missing action or appointment id");
    }

    // "changed" also fires for incidental edits (email/forms updated), not
    // only lifecycle transitions — Acuity's own scheduled/rescheduled/
    // canceled webhooks already cover the events this CRM cares about, so
    // "changed" is deliberately a no-op rather than risking a spurious
    // rebooking on every minor edit.
    if (action === "changed") {
      return jsonResponse({ status: "ignored-changed-event" });
    }

    try {
      const appointment = await fetchAcuityAppointment(appointmentId);
      if (!appointment) {
        // Either Acuity credentials aren't configured (see this file's own
        // header) or the GET call failed — never fabricate appointment
        // data to keep going.
        return createErrorResponse(
          503,
          "Acuity API credentials are not configured, or the appointment could not be fetched.",
        );
      }

      if (action === "scheduled") {
        return await handleScheduled(appointment, appointmentId);
      }
      if (action === "rescheduled") {
        return await handleRescheduled(appointment, appointmentId);
      }
      if (action === "canceled") {
        return await handleCanceled(appointmentId);
      }
      return createErrorResponse(400, `Unknown action: ${action}`);
    } catch (error) {
      console.error("acuity_webhook error:", error);
      return createErrorResponse(
        500,
        `Failed to process Acuity webhook: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }),
);
