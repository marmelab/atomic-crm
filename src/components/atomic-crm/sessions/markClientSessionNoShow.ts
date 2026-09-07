import type { DataProvider, Identifier } from "ra-core";

import type { ClientSession } from "../types";
import { ensureCadenceIssueOpen } from "./ensureCadenceIssueOpen";
import { findEnrollmentExpectedSessionForSession } from "./findEnrollmentExpectedSessionForSession";

export type MarkClientSessionNoShowResult =
  | { status: "no-show" }
  | { status: "not-found" }
  // Idempotent no-op — a double-click/stale tab is never a second write,
  // same convention as every other domain function in this app.
  | { status: "already-no-show" }
  | { status: "cancelled-session" }
  // A session that hasn't happened yet can't already be a no-show — same
  // "a fact about the clock, not a guess about attendance" deterministic
  // guard the old completeClientSession.ts relied on.
  | { status: "not-yet-occurred" };

// Client + Session Operations cadence correction: the ONE manual
// exception action the Enrollment page's session row offers, replacing
// the old "Mark Completed" — a booked session is assumed attended by
// default (see types.ts's own ClientSession comment), so the only thing
// worth a click is the negative case: this booking stood but the client
// did not show. Distinct from cancelClientSession.ts (the appointment
// itself was called off ahead of time, by Acuity) — a no-show is Leif's
// own after-the-fact correction, always reversible (see
// reverseClientSessionNoShow.ts), never a destructive edit.
//
// Exception state-machine correction: if this session was the one thing
// fulfilling an expected 1:1 window, marking it No-show must make that
// exception immediately actionable — never wait for the next 6-hourly
// calendar-sync detection pass. See ensureCadenceIssueOpen.ts.
export const markClientSessionNoShow = async (
  dataProvider: DataProvider,
  clientSessionId: Identifier,
): Promise<MarkClientSessionNoShowResult> => {
  const { data: clientSession } = await dataProvider
    .getOne<ClientSession>("client_sessions", { id: clientSessionId })
    .catch(() => ({ data: null as ClientSession | null }));
  if (!clientSession) return { status: "not-found" };
  if (clientSession.status === "cancelled") {
    return { status: "cancelled-session" };
  }
  if (clientSession.no_show_at) {
    return { status: "already-no-show" };
  }
  if (new Date(clientSession.scheduled_at) > new Date()) {
    return { status: "not-yet-occurred" };
  }

  const now = new Date().toISOString();
  await dataProvider.update<ClientSession>("client_sessions", {
    id: clientSessionId,
    data: { no_show_at: now },
    previousData: clientSession,
  });

  await dataProvider.create("client_session_events", {
    data: {
      client_session_id: clientSessionId,
      kind: "no_show",
      occurred_at: now,
    },
  });

  if (clientSession.enrollment_id != null) {
    const slot = await findEnrollmentExpectedSessionForSession(dataProvider, {
      enrollmentId: clientSession.enrollment_id,
      scheduledAt: clientSession.scheduled_at,
    });
    if (slot) {
      await ensureCadenceIssueOpen(dataProvider, {
        enrollmentId: clientSession.enrollment_id,
        enrollmentExpectedSessionId: slot.id,
      });
    }
  }

  return { status: "no-show" };
};
