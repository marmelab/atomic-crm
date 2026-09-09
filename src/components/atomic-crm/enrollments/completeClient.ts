import type { DataProvider, Identifier } from "ra-core";

import type { Enrollment, EnrollmentOffboardingItem } from "../types";

export type CompleteClientResult =
  | { applied: true }
  | { applied: false; reason: "not-offboarding" }
  | {
      applied: false;
      reason: "requirements-incomplete";
      missingKeys: string[];
    };

// Client Offboarding slice (§8): the explicit human "Complete client"
// action — mirrors activateEnrollment.ts's own shape exactly, including
// its own header comment's reasoning: re-fetches current server state
// (never trusts the caller's copy) so a double-click, a stale tab, or
// Back/Forward is a safe no-op rather than a second write.
//
// The DB's own enforce_enrollment_completion_requirements() trigger
// (02_functions.sql) is the authoritative guard — it fires on this same
// update and would reject it regardless of what this function checks
// first. The check here exists so the UI can show a specific, friendly
// `requirements-incomplete` reason (with the actual missing keys) instead
// of surfacing a raised Postgres exception.
export const completeClient = async (
  dataProvider: DataProvider,
  enrollmentId: Identifier,
): Promise<CompleteClientResult> => {
  const { data: enrollment } = await dataProvider.getOne<Enrollment>(
    "enrollments",
    { id: enrollmentId },
  );
  if (enrollment.status !== "offboarding") {
    return { applied: false, reason: "not-offboarding" };
  }

  const { data: items } = await dataProvider.getList<EnrollmentOffboardingItem>(
    "enrollment_offboarding_items",
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
    data: { status: "completed" },
    previousData: enrollment,
  });

  return { applied: true };
};
