import type { CohortStatus } from "../types";

export const cohortStatuses: { value: CohortStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "applications_open", label: "Applications Open" },
  { value: "applications_closed", label: "Applications Closed" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

export const cohortStatusLabels: Record<CohortStatus, string> = {
  draft: "Draft",
  applications_open: "Applications Open",
  applications_closed: "Applications Closed",
  active: "Active",
  completed: "Completed",
};
