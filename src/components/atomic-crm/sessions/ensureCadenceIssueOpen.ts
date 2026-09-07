import type { DataProvider, Identifier } from "ra-core";

import type {
  Contact,
  Deal,
  Enrollment,
  EnrollmentExpectedSession,
} from "../types";
import { formatWindowWeekLabel } from "./cadenceWeekLabel";
import { ensureCadenceIssueTaskOpen } from "./resolveCadenceIssueTask";

export type EnsureCadenceIssueOpenResult =
  // Freshly created — no issue existed for this (Enrollment, slot) pair.
  | { status: "created"; issueId: Identifier }
  // Existed, was resolved with classification null (an auto-resolve —
  // e.g. Undo No-show previously restored fulfillment) — reopened.
  | { status: "reopened"; issueId: Identifier }
  // Idempotent no-op — already unresolved.
  | { status: "already-open"; issueId: Identifier }
  // Existed and already carries a real human classification — left
  // completely untouched. Per this slice's own governing rule, an
  // automated caller (No-show, the calendar sync's detection pass) NEVER
  // silently overwrites a human judgment.
  | { status: "left-classified"; issueId: Identifier };

// Client + Session Operations cadence correction (exception state-
// machine fix): the shared "make sure this slot's cadence issue is open
// and actionable" operation — called synchronously by
// markClientSessionNoShow.ts the moment a fulfilling session is marked
// No-show (never waiting for the next 6-hourly calendar-sync detection
// pass), and structurally identical to what that detection pass itself
// does server-side. `enrollmentExpectedSessionId` is the Enrollment's own
// frozen slot id (see enrollment_expected_sessions), never the shared,
// editable expected_session_windows row. Always ensures the linked Task
// exists/is reopened too (see resolveCadenceIssueTask.ts) — the durable
// issue row and its Dashboard Needs Attention Task are kept in lockstep,
// never drifting.
export const ensureCadenceIssueOpen = async (
  dataProvider: DataProvider,
  {
    enrollmentId,
    enrollmentExpectedSessionId,
  }: { enrollmentId: Identifier; enrollmentExpectedSessionId: Identifier },
): Promise<EnsureCadenceIssueOpenResult> => {
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
  const existing = existingList[0] ?? null;
  const now = new Date().toISOString();

  if (
    existing &&
    existing.resolved_at != null &&
    existing.classification != null
  ) {
    return { status: "left-classified", issueId: existing.id };
  }
  if (existing && existing.resolved_at == null) {
    return { status: "already-open", issueId: existing.id };
  }

  let issueId: Identifier;
  let outcome: "created" | "reopened";
  if (existing) {
    await dataProvider.update("client_session_cadence_issues", {
      id: existing.id,
      data: { resolved_at: null },
      previousData: existing,
    });
    await dataProvider.create("client_session_cadence_issue_events", {
      data: {
        cadence_issue_id: existing.id,
        kind: "reopened",
        occurred_at: now,
      },
    });
    issueId = existing.id;
    outcome = "reopened";
  } else {
    const { data: created } = await dataProvider.create(
      "client_session_cadence_issues",
      {
        data: {
          enrollment_id: enrollmentId,
          enrollment_expected_session_id: enrollmentExpectedSessionId,
        },
      },
    );
    await dataProvider.create("client_session_cadence_issue_events", {
      data: { cadence_issue_id: created.id, kind: "created", occurred_at: now },
    });
    issueId = created.id;
    outcome = "created";
  }

  const slot = await dataProvider
    .getOne<EnrollmentExpectedSession>("enrollment_expected_sessions", {
      id: enrollmentExpectedSessionId,
    })
    .then(({ data }) => data)
    .catch(() => null);
  const enrollment = await dataProvider
    .getOne<Enrollment>("enrollments", { id: enrollmentId })
    .then(({ data }) => data)
    .catch(() => null);
  const deal = enrollment
    ? await dataProvider
        .getOne<Deal>("deals", { id: enrollment.opportunity_id })
        .then(({ data }) => data)
        .catch(() => null)
    : null;
  const contact = deal
    ? await dataProvider
        .getOne<Contact>("contacts", { id: deal.contact_id })
        .then(({ data }) => data)
        .catch(() => null)
    : null;

  if (slot && contact) {
    const contactName =
      `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();
    await ensureCadenceIssueTaskOpen(dataProvider, {
      cadenceIssueId: issueId,
      contactId: contact.id,
      contactName,
      weekLabel: formatWindowWeekLabel(slot),
    });
  }

  return { status: outcome, issueId };
};
