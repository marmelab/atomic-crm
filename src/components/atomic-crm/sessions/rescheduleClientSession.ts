import type { DataProvider, Identifier } from "ra-core";

import type { ClientSession } from "../types";

export type RescheduleClientSessionResult =
  | { status: "rescheduled"; clientSession: ClientSession }
  | { status: "not-found" }
  // Same new time already recorded — a duplicate reschedule webhook is a
  // safe no-op, never a second event. Mirrors sales-calls/
  // rescheduleSalesCall.ts exactly.
  | { status: "already-current"; clientSession: ClientSession }
  | { status: "cancelled-session" };

// A reschedule updates the SAME client_sessions row — it must never look
// like two independent sessions in the ledger. scheduled_at moves,
// reschedule_count increments, and the fact is preserved individually in
// client_session_events, same "durable individual events, not just a
// count" rationale as sales_call_events.
export const rescheduleClientSession = async (
  dataProvider: DataProvider,
  {
    clientSessionId,
    newScheduledAt,
  }: { clientSessionId: Identifier; newScheduledAt: string },
): Promise<RescheduleClientSessionResult> => {
  const { data: clientSession } = await dataProvider
    .getOne<ClientSession>("client_sessions", { id: clientSessionId })
    .catch(() => ({ data: null as ClientSession | null }));
  if (!clientSession) return { status: "not-found" };
  if (clientSession.status === "cancelled") {
    return { status: "cancelled-session" };
  }
  if (clientSession.scheduled_at === newScheduledAt) {
    return { status: "already-current", clientSession };
  }

  const now = new Date().toISOString();
  const previousScheduledAt = clientSession.scheduled_at;
  const { data: updated } = await dataProvider.update<ClientSession>(
    "client_sessions",
    {
      id: clientSessionId,
      data: {
        scheduled_at: newScheduledAt,
        reschedule_count: clientSession.reschedule_count + 1,
        last_rescheduled_at: now,
      },
      previousData: clientSession,
    },
  );

  await dataProvider.create("client_session_events", {
    data: {
      client_session_id: clientSessionId,
      kind: "rescheduled",
      occurred_at: now,
      previous_scheduled_at: previousScheduledAt,
      new_scheduled_at: newScheduledAt,
    },
  });

  return { status: "rescheduled", clientSession: updated };
};
