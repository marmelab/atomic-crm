import type { DataProvider, Identifier } from "ra-core";

import type {
  ClientSession,
  ClientSessionCadenceIssue,
  Contact,
  Deal,
  Enrollment,
  EnrollmentExpectedSession,
} from "../types";
import { findNoShowSessionInSlot } from "./findNoShowSessionInSlot";

// Mirrors loadSalesCallResolutionContext.ts's own shape — loaded
// imperatively (not useGetOne/useQuery) so CadenceResolutionModal.tsx (the
// one shared resolution component, opened either as a local dialog on
// ClientShow or via the /client-session-cadence/:id/resolve route's own
// thin wrapper — UX correction: never two separate resolution
// implementations) can re-run it after an action completes, same "load
// once, act once, done" lifecycle.
//
// Exception state-machine correction: a single "found" state now covers
// both unresolved AND resolved issues — a classification is editable at
// any time (change it, or clear it back to unresolved), so the modal
// doesn't need two structurally different render branches for
// "resolvable" vs. "already-resolved". The issue's own resolved_at/
// classification fields are what it reads to decide what to show.
//
// Service Period model correction: `slot` is the Enrollment's own frozen
// enrollment_expected_sessions row, never the shared, editable
// expected_session_windows row — its dates/title are immune to a later
// edit of the source calendar event.
export type CadenceIssueResolutionContext =
  | { kind: "not-found" }
  | {
      kind: "found";
      contact: Contact;
      enrollment: Enrollment;
      slot: EnrollmentExpectedSession;
      issue: ClientSessionCadenceIssue;
      // UX correction: "Sep 3 session marked no-show" vs. plain "No
      // session booked" — same context line ClientShow's own Attention
      // row already shows, computed here once so the modal never
      // disagrees with it.
      noShowSession: ClientSession | null;
    };

export const loadCadenceIssueResolutionContext = async (
  dataProvider: DataProvider,
  cadenceIssueId: Identifier,
): Promise<CadenceIssueResolutionContext> => {
  const issue = await dataProvider
    .getOne<ClientSessionCadenceIssue>("client_session_cadence_issues", {
      id: cadenceIssueId,
    })
    .then(({ data }) => data)
    .catch(() => null);
  if (!issue) return { kind: "not-found" };

  const enrollment = await dataProvider
    .getOne<Enrollment>("enrollments", { id: issue.enrollment_id })
    .then(({ data }) => data)
    .catch(() => null);
  if (!enrollment) return { kind: "not-found" };

  const slot = await dataProvider
    .getOne<EnrollmentExpectedSession>("enrollment_expected_sessions", {
      id: issue.enrollment_expected_session_id,
    })
    .then(({ data }) => data)
    .catch(() => null);
  if (!slot) return { kind: "not-found" };

  const deal = await dataProvider
    .getOne<Deal>("deals", { id: enrollment.opportunity_id })
    .then(({ data }) => data)
    .catch(() => null);
  const contact = deal
    ? await dataProvider
        .getOne<Contact>("contacts", { id: deal.contact_id })
        .then(({ data }) => data)
        .catch(() => null)
    : null;
  if (!contact) return { kind: "not-found" };

  const { data: sessions } = await dataProvider.getList<ClientSession>(
    "client_sessions",
    {
      filter: { enrollment_id: enrollment.id },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "id", order: "ASC" },
    },
  );
  const noShowSession = findNoShowSessionInSlot(sessions, slot);

  return { kind: "found", contact, enrollment, slot, issue, noShowSession };
};
