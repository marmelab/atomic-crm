import type { EnrollmentStatus } from "../types";

export const enrollmentStatuses: {
  value: EnrollmentStatus;
  label: string;
}[] = [
  { value: "onboarding", label: "Onboarding" },
  { value: "active", label: "Active" },
  { value: "offboarding", label: "Offboarding" },
  { value: "completed", label: "Completed" },
];

export const enrollmentStatusLabels: Record<EnrollmentStatus, string> = {
  onboarding: "Onboarding",
  active: "Active",
  offboarding: "Offboarding",
  completed: "Completed",
};
