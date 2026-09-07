import type { DataProvider, Identifier } from "ra-core";

import type { ClientSession, EnrollmentExpectedSession } from "../types";
import { completeResolveCadenceIssueTask } from "./resolveCadenceIssueTask";

export type ResolveCadenceIssueFulfillmentResult =
  | { status: "resolved" }
  | { status: "no-issue" }
  | { status: "already-resolved" }
  | { status: "not-fulfilled" }
  // A real human classification exists — never auto-touched, same rule
  // as ensureCadenceIssueOpen.ts's own "left-classified".
  | { status: "left-classified" };

const isFulfilling = (
  session: ClientSession,
  slot: Pick<EnrollmentExpectedSession, "window_start" | "window_end">,
) => {
  if (session.status === "cancelled" || session.no_show_at) return false;
  const scheduledAt = new Date(session.scheduled_at);
  return (
    scheduledAt >= new Date(slot.window_start) &&
    scheduledAt < new Date(slot.window_end)
  );
};

// Client + Session Operations cadence correction (exception state-
// machine fix): the other half of ensureCadenceIssueOpen.ts — called
// synchronously by reverseClientSessionNoShow.ts the moment a session's
// no-show is corrected. If that restores deterministic fulfillment for
// the Enrollment's own frozen slot AND the only reason the issue was
// open was the lost fulfillment (never a real human judgment),
// auto-resolve it — Atomic handles this certainty on its own. A real
// human classification is never silently overwritten just because a
// session showed up later.
export const resolveCadenceIssueFulfillment = async (
  dataProvider: DataProvider,
  {
    enrollmentId,
    enrollmentExpectedSessionId,
  }: { enrollmentId: Identifier; enrollmentExpectedSessionId: Identifier },
): Promise<ResolveCadenceIssueFulfillmentResult> => {
  const { data: existingList } = await dataProvider.getList(
    "client_session_cadence_issues",
    {
      filter: {
        enrollment_id: enrollmentId,
        enrollment_expected_session_id: enrollmentExpectedSessionId,
      },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
  );
  const issue = existingList[0];
  if (!issue) return { status: "no-issue" };
  if (issue.resolved_at != null) {
    return issue.classification != null
      ? { status: "left-classified" }
      : { status: "already-resolved" };
  }

  const slot = await dataProvider
    .getOne<EnrollmentExpectedSession>("enrollment_expected_sessions", {
      id: enrollmentExpectedSessionId,
    })
    .then(({ data }) => data)
    .catch(() => null);
  if (!slot) return { status: "not-fulfilled" };

  const { data: sessions } = await dataProvider.getList<ClientSession>(
    "client_sessions",
    {
      filter: { enrollment_id: enrollmentId },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "id", order: "ASC" },
    },
  );
  const fulfilled = sessions.some((session) => isFulfilling(session, slot));
  if (!fulfilled) return { status: "not-fulfilled" };

  const now = new Date().toISOString();
  await dataProvider.update("client_session_cadence_issues", {
    id: issue.id,
    data: { resolved_at: now },
    previousData: issue,
  });
  await dataProvider.create("client_session_cadence_issue_events", {
    data: { cadence_issue_id: issue.id, kind: "resolved", occurred_at: now },
  });
  await completeResolveCadenceIssueTask(dataProvider, issue.id, now);

  return { status: "resolved" };
};
