import { useGetList } from "ra-core";
import type { Identifier } from "ra-core";

import type {
  ClientSession,
  ClientSessionCadenceIssue,
  EnrollmentExpectedSession,
} from "../types";
import {
  computeClientSessionCadenceSummary,
  type ClientSessionCadenceSummary,
} from "./computeClientSessionCadenceSummary";

export type ClientSessionCadence = ClientSessionCadenceSummary & {
  isPending: boolean;
  // Newest first — the Session History table's own natural order.
  sessions: ClientSession[];
};

// Backs the Enrollment page's Sessions section (Client + Session
// Operations correction) — mirrors useEnrollmentOperationalData.ts's own
// "container hook fetches, a pure function computes" shape. See
// computeClientSessionCadenceSummary.ts for the actual comparison rules
// (directly unit-tested there). Reads the Enrollment's own frozen
// enrollment_expected_sessions slots (assigned server-side by
// sync_year_planning_calendar's own assignment pass — never the raw,
// shared expected_session_windows directly) and any
// client_session_cadence_issues resolution history alongside the
// sessions themselves — none of these three resources are ever written
// from here, only read.
export const useClientSessionCadence = (
  enrollmentId: Identifier | undefined,
  enabled: boolean,
): ClientSessionCadence => {
  const isEnabled = enabled && enrollmentId != null;

  const { data: sessionsData, isPending: isPendingSessions } =
    useGetList<ClientSession>(
      "client_sessions",
      {
        filter: { enrollment_id: enrollmentId },
        pagination: { page: 1, perPage: 200 },
        sort: { field: "scheduled_at", order: "DESC" },
      },
      { enabled: isEnabled },
    );

  const { data: slotsData, isPending: isPendingSlots } =
    useGetList<EnrollmentExpectedSession>(
      "enrollment_expected_sessions",
      {
        filter: { enrollment_id: enrollmentId },
        pagination: { page: 1, perPage: 12 },
        sort: { field: "ordinal", order: "ASC" },
      },
      { enabled: isEnabled },
    );

  const { data: issuesData, isPending: isPendingIssues } =
    useGetList<ClientSessionCadenceIssue>(
      "client_session_cadence_issues",
      {
        filter: { enrollment_id: enrollmentId },
        pagination: { page: 1, perPage: 200 },
        sort: { field: "id", order: "ASC" },
      },
      { enabled: isEnabled },
    );

  const sessions = sessionsData ?? [];

  return {
    isPending: isPendingSessions || isPendingSlots || isPendingIssues,
    sessions,
    ...computeClientSessionCadenceSummary({
      sessions,
      slots: slotsData ?? [],
      issues: issuesData ?? [],
    }),
  };
};
