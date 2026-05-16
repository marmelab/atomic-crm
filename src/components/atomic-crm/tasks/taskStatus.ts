import type { TaskStatus } from "../types";

export const TASK_STATUSES: {
  value: TaskStatus;
  label: string;
  color: string;
}[] = [
  {
    value: "draft",
    label: "Draft",
    color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
  {
    value: "todo",
    label: "To Do",
    color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  {
    value: "in_progress",
    label: "In Progress",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  {
    value: "completed",
    label: "Completed",
    color: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  {
    value: "cancelled",
    label: "Cancelled",
    color: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300",
  },
];

export const TASK_STATUS_MAP = Object.fromEntries(
  TASK_STATUSES.map((s) => [s.value, s]),
) as Record<TaskStatus, (typeof TASK_STATUSES)[number]>;

export const resolveStatus = (status: string | null | undefined): TaskStatus =>
  (status as TaskStatus) ?? "todo";
