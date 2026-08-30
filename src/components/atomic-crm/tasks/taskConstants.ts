import type { TaskStatus } from "../types";

// Fixed system states (unlike taskTypes, not a per-tenant runtime config —
// every Task has exactly one of these regardless of business customization).
export const taskStatuses: { value: TaskStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "waiting", label: "Waiting" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export const taskStatusLabels: Record<TaskStatus, string> = {
  pending: "Pending",
  waiting: "Waiting",
  completed: "Completed",
  cancelled: "Cancelled",
};
