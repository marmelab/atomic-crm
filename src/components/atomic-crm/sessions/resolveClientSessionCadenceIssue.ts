import type { DataProvider, Identifier } from "ra-core";

import type {
  ClientSessionCadenceClassification,
  ClientSessionCadenceIssue,
} from "../types";
import {
  completeResolveCadenceIssueTask,
  findAnyResolveCadenceIssueTask,
} from "./resolveCadenceIssueTask";

// Client + Session Operations cadence correction: the human decisions
// the resolution UI (and ClientShow's own Attention section) offer for
// an expected 1:1 week — Known skip / Rescheduled / Missed-ghosted.
// Never guesses which classification is right (Atomic handles
// certainty; Leif handles ambiguity).
//
// Exception state-machine correction: a classification is a human
// JUDGMENT, not an immutable fact. setCadenceIssueClassification below
// both resolves an open issue AND reclassifies an already-resolved one —
// Leif can change his mind (known_skip -> rescheduled -> missed_ghosted)
// at any time. reopenCadenceIssue clears a classification entirely (made
// by mistake). Both preserve full audit history in
// client_session_cadence_issue_events; neither ever deletes the
// underlying issue row.
export type SetCadenceIssueClassificationResult =
  | { status: "resolved" }
  | { status: "reclassified" }
  // Idempotent no-op — re-submitting the SAME classification that's
  // already current is never a second event.
  | { status: "unchanged" }
  | { status: "not-found" };

const fetchIssue = async (
  dataProvider: DataProvider,
  cadenceIssueId: Identifier,
): Promise<ClientSessionCadenceIssue | null> =>
  await dataProvider
    .getOne<ClientSessionCadenceIssue>("client_session_cadence_issues", {
      id: cadenceIssueId,
    })
    .then(({ data }) => data)
    .catch(() => null);

export const setCadenceIssueClassification = async (
  dataProvider: DataProvider,
  {
    cadenceIssueId,
    classification,
    note,
  }: {
    cadenceIssueId: Identifier;
    classification: ClientSessionCadenceClassification;
    note?: string | null;
  },
): Promise<SetCadenceIssueClassificationResult> => {
  const issue = await fetchIssue(dataProvider, cadenceIssueId);
  if (!issue) return { status: "not-found" };

  const trimmedNote = note?.trim() || null;
  if (issue.resolved_at != null && issue.classification === classification) {
    return { status: "unchanged" };
  }

  const wasAlreadyClassified =
    issue.resolved_at != null && issue.classification != null;
  const now = new Date().toISOString();

  await dataProvider.update("client_session_cadence_issues", {
    id: issue.id,
    data: { classification, note: trimmedNote, resolved_at: now },
    previousData: issue,
  });
  await dataProvider.create("client_session_cadence_issue_events", {
    data: {
      cadence_issue_id: issue.id,
      kind: wasAlreadyClassified ? "reclassified" : "resolved",
      classification,
      note: trimmedNote,
      occurred_at: now,
    },
  });
  await completeResolveCadenceIssueTask(dataProvider, issue.id, now);

  return { status: wasAlreadyClassified ? "reclassified" : "resolved" };
};

export type ReopenCadenceIssueResult =
  | { status: "reopened" }
  // Idempotent no-op — already unresolved.
  | { status: "already-open" }
  | { status: "not-found" };

// The safe correction path for a classification made by mistake — clears
// it entirely (back to a plain unresolved issue, same as if it had never
// been classified) and reopens its linked Task, with the correction
// itself durable in client_session_cadence_issue_events.
export const reopenCadenceIssue = async (
  dataProvider: DataProvider,
  { cadenceIssueId }: { cadenceIssueId: Identifier },
): Promise<ReopenCadenceIssueResult> => {
  const issue = await fetchIssue(dataProvider, cadenceIssueId);
  if (!issue) return { status: "not-found" };
  if (issue.resolved_at == null) return { status: "already-open" };

  const now = new Date().toISOString();
  await dataProvider.update("client_session_cadence_issues", {
    id: issue.id,
    data: { classification: null, resolved_at: null, note: null },
    previousData: issue,
  });
  await dataProvider.create("client_session_cadence_issue_events", {
    data: { cadence_issue_id: issue.id, kind: "reopened", occurred_at: now },
  });

  const task = await findAnyResolveCadenceIssueTask(dataProvider, issue.id);
  if (task?.done_date) {
    await dataProvider.update("tasks", {
      id: task.id,
      data: { done_date: null, status: "pending" },
      previousData: task,
    });
  }

  return { status: "reopened" };
};
