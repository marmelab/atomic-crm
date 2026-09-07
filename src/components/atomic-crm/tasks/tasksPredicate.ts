import { startOfToday } from "date-fns/startOfToday";
import { endOfToday } from "date-fns/endOfToday";
import { endOfTomorrow } from "date-fns/endOfTomorrow";
import { endOfWeek } from "date-fns/endOfWeek";
import { addDays } from "date-fns/addDays";
import { endOfDay } from "date-fns/endOfDay";

import { getDay, isAfter } from "date-fns";

export const isBeforeFriday = () => getDay(new Date()) < 5; // Friday is represented by 5

// Unmatched Sales Call Resolution slice, human-acceptance repair: this
// exception's own due_date is an internal implementation detail only
// (Tasks require one at the DB level, set to "now" at creation) — never a
// real dated commitment Leif made. Shown/used in two places: Task.tsx
// (suppress "Due <date>"/Postpone) and DashboardTasks.tsx (never bucket it
// as Overdue merely because its internal due_date rolled into the past —
// it always shows in Today instead, for as long as it's unresolved).
export const TASK_TYPES_WITHOUT_MEANINGFUL_DUE_DATE: ReadonlySet<string> =
  new Set(["resolve_sales_call", "resolve_client_session_cadence"]);

type Task = {
  due_date: string;
  done_date?: string | null;
  // Optional so callers with only the legacy done_date field still compile.
  status?: "pending" | "waiting" | "completed" | "cancelled";
};

// A task is "done" (no longer needs attention) once it's checked off or
// explicitly cancelled. Checking done_date alone keeps this backward
// compatible with any record that hasn't been given a status yet.
export const isDone = (task: Task) =>
  task.done_date != null ||
  task.status === "completed" ||
  task.status === "cancelled";

// A task is recently done if it was marked as done less than 5 minutes ago
// useful to keep recently done tasks in the list to avoid flickering when a task is marked as done while the user is consulting the list of tasks. It gives a chance to the user to see that the task was marked as done and then it will disappear after 5 minutes.
export const isRecentlyDone = (task: Task) =>
  task.done_date != null &&
  isAfter(new Date(task.done_date), new Date(Date.now() - 5 * 60 * 1000));

export const isOverdue = (dateString: string) => {
  return new Date(dateString) < startOfToday();
};

export const isDueToday = (dateString: string) => {
  const dueDate = new Date(dateString);
  return dueDate >= startOfToday() && dueDate < endOfToday();
};

export const isDueTomorrow = (dateString: string) => {
  const dueDate = new Date(dateString);
  return dueDate >= endOfToday() && dueDate < endOfTomorrow();
};

export const isDueThisWeek = (dateString: string) => {
  const dueDate = new Date(dateString);
  return (
    dueDate >= endOfTomorrow() &&
    dueDate < endOfWeek(new Date(), { weekStartsOn: 0 })
  );
};

export const isDueLater = (dateString: string) => {
  const dueDate = new Date(dateString);
  return dueDate >= endOfWeek(new Date(), { weekStartsOn: 0 });
};

// Dashboard "Next 7 Days" bucket: everything after today through 7 full
// days out. Deliberately bounded (unlike isDueLater) so the Dashboard's
// Tasks section stays a short, scannable horizon — see the Dashboard/Today
// slice report for why this is a separate bucket set from the detailed
// Overdue/Today/Tomorrow/This Week/Later view used elsewhere.
export const isDueNext7Days = (dateString: string) => {
  const dueDate = new Date(dateString);
  return dueDate >= endOfToday() && dueDate <= endOfDay(addDays(new Date(), 7));
};
