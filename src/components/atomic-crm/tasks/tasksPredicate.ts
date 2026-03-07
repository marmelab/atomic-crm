import { startOfToday } from "date-fns/startOfToday";
import { endOfToday } from "date-fns/endOfToday";
import { endOfTomorrow } from "date-fns/endOfTomorrow";
import { endOfWeek } from "date-fns/endOfWeek";

import { getDay, isAfter } from "date-fns";

export const isBeforeFriday = () => getDay(new Date()) < 5; // Friday is represented by 5

type Task = {
  due_date: string;
  done_date: string | null;
};

export const isDone = (task: Task) => task.done_date != null;

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
