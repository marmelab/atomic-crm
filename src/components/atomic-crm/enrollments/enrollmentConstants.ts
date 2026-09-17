import type { EnrollmentStatus } from "../types";

export const enrollmentStatuses: {
  value: EnrollmentStatus;
  label: string;
}[] = [
  { value: "onboarding", label: "Onboarding" },
  { value: "active", label: "Active" },
  { value: "offboarding", label: "Offboarding" },
  { value: "completed", label: "Completed" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "ended", label: "Ended" },
];

export const enrollmentStatusLabels: Record<EnrollmentStatus, string> = {
  onboarding: "Onboarding",
  active: "Active",
  offboarding: "Offboarding",
  completed: "Completed",
  withdrawn: "Withdrawn",
  ended: "Ended",
};

// Manual Task UX repair, round 2: the canonical definition of "Leif is
// still actively working with this person" — used to decide whether a
// Task's person link should go straight to their Client/Enrollment page
// (see tasks/useContactLinkDestination.ts) rather than their Contact
// page. Deliberately excludes both terminal statuses — a finished or
// withdrawn Enrollment is no longer an operational relationship, same
// reasoning as
// useClientsGrouped.ts's own Needs Onboarding/Active/Past split (a
// different UI grouping, not reused directly here, but the same
// underlying domain fact: only these three statuses represent ongoing
// operational work).
export const CURRENT_OPERATIONAL_ENROLLMENT_STATUSES: ReadonlySet<EnrollmentStatus> =
  new Set(["onboarding", "active", "offboarding"]);
