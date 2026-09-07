import type { DataProvider, Identifier } from "ra-core";

import type { ClientSession } from "../types";

export type CancelClientSessionResult =
  | { status: "cancelled"; clientSession: ClientSession }
  | { status: "not-found" }
  // Already cancelled — a duplicate cancellation webhook is a safe no-op.
  | { status: "already-cancelled"; clientSession: ClientSession };

// Cancelling never touches enrollment_id/Enrollment state — it only marks
// the session itself cancelled and records the event. Mirrors sales-calls/
// cancelSalesCall.ts's shape, minus the "stranded Opportunity" follow-up
// logic (a sales-pipeline-specific concern that doesn't apply here).
// Leaves no_show_at untouched either way — a no-show already recorded on
// this session is its own independent, durable fact (see
// markClientSessionNoShow.ts); an out-of-order Acuity cancellation
// arriving afterward doesn't erase it.
export const cancelClientSession = async (
  dataProvider: DataProvider,
  clientSessionId: Identifier,
): Promise<CancelClientSessionResult> => {
  const { data: clientSession } = await dataProvider
    .getOne<ClientSession>("client_sessions", { id: clientSessionId })
    .catch(() => ({ data: null as ClientSession | null }));
  if (!clientSession) return { status: "not-found" };
  if (clientSession.status === "cancelled") {
    return { status: "already-cancelled", clientSession };
  }

  const now = new Date().toISOString();
  const { data: updated } = await dataProvider.update<ClientSession>(
    "client_sessions",
    {
      id: clientSessionId,
      data: { status: "cancelled", cancelled_at: now },
      previousData: clientSession,
    },
  );

  await dataProvider.create("client_session_events", {
    data: {
      client_session_id: clientSessionId,
      kind: "cancelled",
      occurred_at: now,
    },
  });

  return { status: "cancelled", clientSession: updated };
};
