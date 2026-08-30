// Classifies one Opportunity tied to a Cohort into the People groups shown
// on the Cohort detail page. Pure function so the lifecycle rules ("a
// Completed Enrollment frees up capacity", "In Sales excludes Won/exited")
// are unit-testable without a data provider.
import type { Enrollment } from "../types";

export type CohortPersonGroup = "enrolled" | "in_sales" | "other";

// Enrollment lifecycle statuses that currently occupy a Cohort seat.
// "completed" deliberately does not occupy capacity.
const ACTIVE_ENROLLMENT_STATUSES: ReadonlySet<Enrollment["status"]> = new Set([
  "onboarding",
  "active",
  "offboarding",
]);

export const classifyCohortOpportunity = ({
  stage,
  outcome,
  enrollment,
  hasRejectedApplication,
}: {
  stage: string;
  outcome?: string | null;
  enrollment?: Pick<Enrollment, "status"> | null;
  // True if any Application linked to this Opportunity has status
  // "rejected". This only affects Cohort "In Sales" classification — it
  // never mutates the Opportunity itself (owner_decision stays independent
  // of Application status; see applications/ "Application behavior").
  hasRejectedApplication?: boolean;
}): CohortPersonGroup => {
  if (enrollment && ACTIVE_ENROLLMENT_STATUSES.has(enrollment.status)) {
    return "enrolled";
  }

  // Won-without-an-enrollment-yet, or exited via an outcome, is neither
  // still-in-sales nor occupying a seat.
  if (stage === "won" || outcome != null) {
    return "other";
  }

  if (enrollment) {
    // Completed (or any other non-active) enrollment: done, not in sales.
    return "other";
  }

  // A rejected Application means this person isn't actively moving toward
  // a purchase for this cohort anymore, even though nothing on the
  // Opportunity record itself (stage/outcome) reflects that yet.
  if (hasRejectedApplication) {
    return "other";
  }

  return "in_sales";
};
