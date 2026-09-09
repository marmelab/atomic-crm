import type { DataProvider, Identifier } from "ra-core";

import type { Enrollment } from "../types";

export type StartOffboardingResult =
  | { applied: true }
  | { applied: false; reason: "not-active" };

// Client Offboarding slice: the explicit human "Start offboarding" action
// (§5 — Leif decides when the relationship is entering offboarding; never
// inferred from dates or session counts). Mirrors activateEnrollment.ts's
// own shape: re-fetches current server state (never trusts the caller's
// copy) so a double-click, a stale tab, or Back/Forward is a safe no-op
// rather than a second write — the caller checks `applied` and shows the
// real current state rather than assuming success.
//
// Unlike activateEnrollment.ts, there are no PREREQUISITE requirements to
// check here (nothing must be complete before offboarding can start) —
// the only guard is the transition itself: only an ACTIVE Enrollment can
// start offboarding (never onboarding -> offboarding as a shortcut, per
// §1). The DB's own handle_enrollment_offboarding_started() trigger
// fires on this same update and performs the actual checklist/Task
// snapshot — this function's job is purely the guarded status write.
export const startOffboarding = async (
  dataProvider: DataProvider,
  enrollmentId: Identifier,
): Promise<StartOffboardingResult> => {
  const { data: enrollment } = await dataProvider.getOne<Enrollment>(
    "enrollments",
    { id: enrollmentId },
  );
  if (enrollment.status !== "active") {
    return { applied: false, reason: "not-active" };
  }

  await dataProvider.update("enrollments", {
    id: enrollment.id,
    data: { status: "offboarding" },
    previousData: enrollment,
  });

  return { applied: true };
};
