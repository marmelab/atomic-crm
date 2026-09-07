import type { DataProvider, Identifier } from "ra-core";

import type { ClientSession } from "../types";
import { findEnrollmentExpectedSessionForSession } from "./findEnrollmentExpectedSessionForSession";
import { resolveCadenceIssueFulfillment } from "./resolveCadenceIssueFulfillment";

export type ReverseClientSessionNoShowResult =
  | { status: "reversed" }
  // Idempotent no-op, same convention as markClientSessionNoShow.ts.
  | { status: "not-no-show" }
  | { status: "not-found" };

// The safe correction path for a no-show marked by mistake — clearing
// no_show_at makes the session fulfilled again by the normal default-
// attendance rule, with the correction itself durable in
// client_session_events (never a silent overwrite with no trace).
//
// Exception state-machine correction: if restoring fulfillment resolves
// the ONLY reason an expected window's cadence issue was open (never a
// real human classification — see resolveCadenceIssueFulfillment.ts),
// that issue auto-resolves here too, immediately.
export const reverseClientSessionNoShow = async (
  dataProvider: DataProvider,
  clientSessionId: Identifier,
): Promise<ReverseClientSessionNoShowResult> => {
  const { data: clientSession } = await dataProvider
    .getOne<ClientSession>("client_sessions", { id: clientSessionId })
    .catch(() => ({ data: null as ClientSession | null }));
  if (!clientSession) return { status: "not-found" };
  if (!clientSession.no_show_at) {
    return { status: "not-no-show" };
  }

  const now = new Date().toISOString();
  await dataProvider.update<ClientSession>("client_sessions", {
    id: clientSessionId,
    data: { no_show_at: null },
    previousData: clientSession,
  });

  await dataProvider.create("client_session_events", {
    data: {
      client_session_id: clientSessionId,
      kind: "no_show_reversed",
      occurred_at: now,
    },
  });

  if (clientSession.enrollment_id != null) {
    const slot = await findEnrollmentExpectedSessionForSession(dataProvider, {
      enrollmentId: clientSession.enrollment_id,
      scheduledAt: clientSession.scheduled_at,
    });
    if (slot) {
      await resolveCadenceIssueFulfillment(dataProvider, {
        enrollmentId: clientSession.enrollment_id,
        enrollmentExpectedSessionId: slot.id,
      });
    }
  }

  return { status: "reversed" };
};
