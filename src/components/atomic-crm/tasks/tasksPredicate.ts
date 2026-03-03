import { startOfToday } from "date-fns/startOfToday";
import { endOfToday } from "date-fns/endOfToday";
import { endOfTomorrow } from "date-fns/endOfTomorrow";
import { endOfWeek } from "date-fns/endOfWeek";

import { getDay } from "date-fns";

export const isBeforeFriday = () => getDay(new Date()) < 5; // Friday is represented by 5

type Task = {
  due_date: string;
  done_date: string | null;
};

export const isDone = (task: Task) => task.done_date != null;

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
