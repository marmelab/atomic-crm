import type { DataProvider, Identifier } from "ra-core";

import type { Enrollment, EnrollmentOnboardingItem } from "../types";
import { assessOnboarding } from "./assessOnboarding";

export type ActivateEnrollmentResult =
  | { applied: true }
  | { applied: false; reason: "not-onboarding" }
  | {
      applied: false;
      reason: "requirements-incomplete";
      missingKeys: string[];
    }
  // Tracked, but carrying no required items at all. Previously this
  // sailed through both here and in the database, because "no incomplete
  // item exists" is trivially true of an empty list — the emptiest
  // possible checklist passed the check a full one would fail. It is a
  // missing checklist, not a finished one.
  | { applied: false; reason: "checklist-missing" }
  // Onboarding happened before the CRM tracked it, so there is no
  // checklist to satisfy. Activating is legitimate but must be a decision
  // somebody makes, never a silent consequence of an empty list.
  | { applied: false; reason: "needs-untracked-acknowledgement" };

// Contracts + Onboarding slice: the explicit human Activate action
// (architecture review, §6 — Leif's approved bias, option B). Mirrors
// reviewApplication.ts's own shape exactly: re-fetches current server
// state (never trusts the caller's copy) so a double-click, a stale tab,
// or Back/Forward is a safe no-op rather than a second write — the caller
// checks `applied` and shows the real current state rather than assuming
// success.
//
// The DB's own enforce_enrollment_activation_requirements() trigger
// (02_functions.sql) is the authoritative guard — it fires on this same
// update and would reject it regardless of what this function checks
// first. The check here exists so the UI can show a specific, friendly
// `requirements-incomplete` reason (with the actual missing keys) instead
// of surfacing a raised Postgres exception.
export const activateEnrollment = async (
  dataProvider: DataProvider,
  enrollmentId: Identifier,
  // Set only when a person has been shown that this client's onboarding
  // was never tracked and has chosen to activate anyway.
  options: { acknowledgeUntracked?: boolean } = {},
): Promise<ActivateEnrollmentResult> => {
  const { data: enrollment } = await dataProvider.getOne<Enrollment>(
    "enrollments",
    { id: enrollmentId },
  );
  if (enrollment.status !== "onboarding") {
    return { applied: false, reason: "not-onboarding" };
  }

  const { data: items } = await dataProvider.getList<EnrollmentOnboardingItem>(
    "enrollment_onboarding_items",
    {
      filter: { enrollment_id: enrollmentId },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "sort_order", order: "ASC" },
    },
  );

  const onboarding = assessOnboarding({
    tracking: enrollment.onboarding_tracking,
    items,
  });

  if (onboarding.mode === "legacy_untracked") {
    if (!options.acknowledgeUntracked) {
      return { applied: false, reason: "needs-untracked-acknowledgement" };
    }
  } else if (onboarding.isMissingChecklist) {
    return { applied: false, reason: "checklist-missing" };
  } else if (onboarding.outstandingRequired.length > 0) {
    return {
      applied: false,
      reason: "requirements-incomplete",
      missingKeys: onboarding.outstandingRequired.map(
        (item) => item.requirement_key,
      ),
    };
  }

  await dataProvider.update("enrollments", {
    id: enrollment.id,
    data: {
      status: "active",
      // Client + Session Operations slice A: the authoritative "trustworthy
      // service start date" the Service Period model is built on (see
      // sync_year_planning_calendar/assignEnrollmentExpectedSessions.ts) —
      // "when did this client's own 12-session cadence begin." Already populated
      // for a cohort-based Enrollment (handle_deal_won() snapshots the
      // Cohort's program_start_at); an individually-paced Enrollment (e.g.
      // a 1:1 Living Example engagement) has no Cohort to snapshot from,
      // so this is where it becomes known — the real moment onboarding
      // finished and active service begins. Never overwrites an
      // already-set date (idempotent, and never rewrites a genuine
      // Cohort-derived date).
      // Leif clicking Activate IS the statement that this client is
      // starting now, so the date it writes is owner-stated — the same
      // standing as a Start Week he types in by hand, and the opposite of
      // the session-derived dates migration 20260921130000 had to mark as
      // needing confirmation.
      ...(enrollment.start_date == null
        ? {
            start_date: new Date().toISOString().split("T")[0],
            start_date_source: "owner",
          }
        : {}),
    },
    previousData: enrollment,
  });

  return { applied: true };
};
