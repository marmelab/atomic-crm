import type { DataProvider, Identifier } from "ra-core";

import type { ClientSession, ClientSessionSource } from "../types";

export type BookClientSessionInput = {
  dataProvider: DataProvider;
  contactId: Identifier;
  // null: could not be safely matched to exactly one legitimate active
  // Enrollment (see matchClientSessionEnrollment.ts) — preserved rather
  // than guessed.
  enrollmentId: Identifier | null;
  offerId: Identifier;
  scheduledAt: string;
  source: ClientSessionSource;
  acuityAppointmentId?: string | null;
  acuityAppointmentTypeId?: string | null;
};

export type BookClientSessionResult =
  | { status: "booked"; clientSession: ClientSession }
  // Same acuity_appointment_id already recorded — a duplicate webhook
  // delivery is a safe no-op, never a second row. Mirrors sales-calls/
  // bookSalesCall.ts's own first-line check exactly.
  | { status: "already-booked"; clientSession: ClientSession };

// Records a newly booked paid-client session. Unlike bookSalesCall.ts,
// there is no "one booked call per Opportunity" retargeting concept here —
// multiple sessions per service month are the normal, expected case, so
// every genuinely-new booking is its own row.
export const bookClientSession = async (
  input: BookClientSessionInput,
): Promise<BookClientSessionResult> => {
  const { dataProvider } = input;

  if (input.acuityAppointmentId) {
    const { data: existing } = await dataProvider.getList<ClientSession>(
      "client_sessions",
      {
        filter: { acuity_appointment_id: input.acuityAppointmentId },
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "ASC" },
      },
    );
    if (existing[0]) {
      return { status: "already-booked", clientSession: existing[0] };
    }
  }

  const now = new Date().toISOString();
  const { data: clientSession } = await dataProvider.create<ClientSession>(
    "client_sessions",
    {
      data: {
        contact_id: input.contactId,
        enrollment_id: input.enrollmentId,
        offer_id: input.offerId,
        status: "booked",
        scheduled_at: input.scheduledAt,
        reschedule_count: 0,
        source: input.source,
        acuity_appointment_id: input.acuityAppointmentId ?? null,
        acuity_appointment_type_id: input.acuityAppointmentTypeId ?? null,
      },
    },
  );

  await dataProvider.create("client_session_events", {
    data: {
      client_session_id: clientSession.id,
      kind: "booked",
      occurred_at: now,
      new_scheduled_at: input.scheduledAt,
    },
  });

  return { status: "booked", clientSession };
};
