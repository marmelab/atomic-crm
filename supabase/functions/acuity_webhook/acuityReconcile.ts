import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  fetchAcuityAppointment,
  fetchAcuityAppointments,
  type AcuityAppointmentDetails,
} from "./acuityApi.ts";
import {
  handleCanceled,
  handleRescheduled,
  handleScheduled,
} from "./acuitySalesCallHandlers.ts";

// Periodic reconciliation: the half a webhook cannot do.
//
// A webhook is a stream of events, and a stream can lose things. Every
// booking that predates the integration, every delivery that failed while
// the function was down, every event Acuity dropped, every reschedule that
// arrived out of order — none of them ever arrive again. The CRM would
// simply be quietly wrong, which is exactly how thirty-four live bookings
// came to be missing before this round.
//
// So the webhook keeps its job (low latency, event-shaped), and this runs
// on a schedule doing the same work from the other direction: take what
// Acuity says is true right now, and make the CRM agree.
//
// Two rules keep it safe to run forever:
//
//   IDEMPOTENT. Every decision is keyed on Acuity's own appointment id.
//   Re-running against unchanged upstream data changes nothing at all —
//   no Contacts, no Opportunities, no Sales Calls, no Tasks, no stage
//   events, not even a redundant UPDATE.
//
//   OWNER TRUTH WINS. A call Leif has cancelled in the CRM is never
//   resurrected because Acuity still lists the booking as live. Mihaela
//   Petrova is the standing case: her 18 September booking is still
//   `canceled: false` upstream, and reconciliation must leave her
//   Opportunity at Approved. A genuinely NEW booking (a new appointment
//   id) is a new fact and is ingested normally.

export type ReconcileDelta = {
  scanned: number;
  contactsCreated: number;
  opportunitiesCreated: number;
  salesCallsCreated: number;
  rescheduled: number;
  cancelled: number;
  skippedOwnerOverride: number;
  skippedUnresolvableType: number;
  skippedClientSession: number;
  unchanged: number;
  errors: string[];
};

const emptyDelta = (): ReconcileDelta => ({
  scanned: 0,
  contactsCreated: 0,
  opportunitiesCreated: 0,
  salesCallsCreated: 0,
  rescheduled: 0,
  cancelled: 0,
  skippedOwnerOverride: 0,
  skippedUnresolvableType: 0,
  skippedClientSession: 0,
  unchanged: 0,
  errors: [],
});

type CountedTables = {
  contacts: number;
  deals: number;
  sales_calls: number;
  tasks: number;
  deal_stage_events: number;
};

const countRows = async (): Promise<CountedTables> => {
  const counts = await Promise.all(
    (
      [
        "contacts",
        "deals",
        "sales_calls",
        "tasks",
        "deal_stage_events",
      ] as const
    ).map(async (table) => {
      const { count } = await supabaseAdmin
        .from(table)
        .select("id", { count: "exact", head: true });
      return [table, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(counts) as CountedTables;
};

type SalesCallRow = {
  id: number;
  acuity_appointment_id: string | null;
  acuity_appointment_type_id: string | null;
  opportunity_id: number | null;
  contact_id: number;
  status: string;
  scheduled_at: string | null;
  scheduled_on: string;
};

// Which appointment types this reconciliation is allowed to act on, and
// what each one means. Read live so adding a type is a data change.
const loadSalesCallTypes = async (): Promise<Set<string>> => {
  const { data } = await supabaseAdmin
    .from("acuity_appointment_type_map")
    .select("acuity_appointment_type_id, kind, resolution");
  const rows = (data ?? []) as {
    acuity_appointment_type_id: string;
    kind: string;
    resolution: string;
  }[];
  return new Set(
    rows
      .filter((r) => r.kind === "sales_call" && r.resolution === "mapped")
      .map((r) => r.acuity_appointment_type_id),
  );
};

const sameInstant = (a: string | null, b: string): boolean => {
  if (!a) return false;
  return new Date(a).getTime() === new Date(b).getTime();
};

// Pass 1 — everything Acuity currently says is booked.
const reconcileLiveAppointments = async (
  appointments: AcuityAppointmentDetails[],
  existingByAcuityId: Map<string, SalesCallRow>,
  salesCallTypes: Set<string>,
  delta: ReconcileDelta,
): Promise<void> => {
  for (const appointment of appointments) {
    const acuityId = String(appointment.id ?? "");
    if (!acuityId) continue;
    delta.scanned += 1;

    const typeId = String(appointment.appointmentTypeID);
    if (!salesCallTypes.has(typeId)) {
      // Either a client-session type (Zoom 1:1), an unmapped type, or one
      // whose meaning on this date is undetermined. None of them may
      // become a sales Opportunity by default.
      delta.skippedClientSession += 1;
      continue;
    }

    const existing = existingByAcuityId.get(acuityId);

    if (!existing) {
      const response = await handleScheduled(appointment, acuityId);
      const body = (await response.json()) as { status?: string };
      if (
        body.status === "unknown-appointment-type" ||
        body.status === "not-a-sales-call"
      ) {
        delta.skippedUnresolvableType += 1;
      } else if (body.status === "already-booked") {
        delta.unchanged += 1;
      } else {
        delta.salesCallsCreated += 1;
      }
      continue;
    }

    // The owner-override rule, stated once and applied everywhere below:
    // a cancellation recorded in the CRM is a decision, and stale upstream
    // state does not overturn a decision.
    if (existing.status === "cancelled") {
      delta.skippedOwnerOverride += 1;
      continue;
    }

    if (!sameInstant(existing.scheduled_at, appointment.datetime)) {
      await handleRescheduled(appointment, acuityId);
      delta.rescheduled += 1;
      continue;
    }

    delta.unchanged += 1;
  }
};

// Pass 2 — cancellations the webhook never delivered.
//
// Deliberately NOT inferred from absence: an appointment missing from the
// fetched page could equally mean a pagination edge or a window boundary.
// Each candidate is confirmed by asking Acuity about that specific id, and
// only a definite `canceled: true` cancels anything.
const reconcileMissedCancellations = async (
  booked: SalesCallRow[],
  liveIds: Set<string>,
  credentials: { userId: string; apiKey: string },
  delta: ReconcileDelta,
): Promise<void> => {
  for (const call of booked) {
    const acuityId = call.acuity_appointment_id;
    if (!acuityId || liveIds.has(acuityId)) continue;

    const upstream = await fetchAcuityAppointment(acuityId, credentials);
    if (!upstream) {
      delta.errors.push(`could not confirm appointment ${acuityId} upstream`);
      continue;
    }
    if (!upstream.canceled) {
      delta.unchanged += 1;
      continue;
    }

    await handleCanceled(acuityId);
    delta.cancelled += 1;
  }
};

export const reconcileAcuity = async (params: {
  credentials: { userId: string; apiKey: string };
  // How far back to look. Defaults to a day so a cancellation made just
  // after an appointment's start is still repaired.
  sinceDays?: number;
}): Promise<ReconcileDelta> => {
  const delta = emptyDelta();
  const sinceDays = params.sinceDays ?? 1;
  const minDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const appointments = await fetchAcuityAppointments(
    { minDate, canceled: false },
    params.credentials,
  );
  if (appointments === null) {
    delta.errors.push("could not read appointments from Acuity");
    return delta;
  }

  const salesCallTypes = await loadSalesCallTypes();

  const { data: callRows } = await supabaseAdmin
    .from("sales_calls")
    .select(
      "id, acuity_appointment_id, acuity_appointment_type_id, opportunity_id, contact_id, status, scheduled_at, scheduled_on",
    )
    .gte("scheduled_on", minDate);
  const calls = (callRows ?? []) as SalesCallRow[];

  const existingByAcuityId = new Map<string, SalesCallRow>();
  for (const call of calls) {
    if (call.acuity_appointment_id) {
      existingByAcuityId.set(call.acuity_appointment_id, call);
    }
  }

  await reconcileLiveAppointments(
    appointments,
    existingByAcuityId,
    salesCallTypes,
    delta,
  );

  const liveIds = new Set(appointments.map((a) => String(a.id ?? "")));
  await reconcileMissedCancellations(
    calls.filter((c) => c.status === "booked"),
    liveIds,
    params.credentials,
    delta,
  );

  return delta;
};

// Wraps a run with before/after row counts, so "this run created nothing"
// is measured rather than asserted by the same code that did the work.
export const reconcileAcuityWithCounts = async (params: {
  credentials: { userId: string; apiKey: string };
  sinceDays?: number;
}): Promise<{
  delta: ReconcileDelta;
  rowsBefore: CountedTables;
  rowsAfter: CountedTables;
}> => {
  const rowsBefore = await countRows();
  const delta = await reconcileAcuity(params);
  const rowsAfter = await countRows();
  return { delta, rowsBefore, rowsAfter };
};
