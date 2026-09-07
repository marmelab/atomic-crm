import type { DataProvider, Identifier } from "ra-core";

import type { Enrollment, EnrollmentOnboardingItem } from "../types";

export type ActivateEnrollmentResult =
  | { applied: true }
  | { applied: false; reason: "not-onboarding" }
  | {
      applied: false;
      reason: "requirements-incomplete";
      missingKeys: string[];
    };

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
  const missingKeys = items
    .filter((item) => item.is_required && item.status !== "done")
    .map((item) => item.requirement_key);
  if (missingKeys.length > 0) {
    return { applied: false, reason: "requirements-incomplete", missingKeys };
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
      ...(enrollment.start_date == null
        ? { start_date: new Date().toISOString().split("T")[0] }
        : {}),
    },
    previousData: enrollment,
  });

  return { applied: true };
};
