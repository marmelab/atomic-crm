import { startOfToday } from "date-fns/startOfToday";
import { endOfToday } from "date-fns/endOfToday";
import { endOfTomorrow } from "date-fns/endOfTomorrow";
import { endOfWeek } from "date-fns/endOfWeek";

import { getDay } from "date-fns";
import type { Identifier } from "ra-core";

const today = new Date();
const todayDayOfWeek = getDay(today);
export const isBeforeFriday = todayDayOfWeek < 5; // Friday is represented by 5
const startOfTodayDate = startOfToday();
const endOfTodayDate = endOfToday();
const endOfTomorrowDate = endOfTomorrow();
const endOfWeekDate = endOfWeek(today, { weekStartsOn: 0 });

type Task = {
  id: Identifier;
  due_date: string;
  done_date: string | null;
};

export const isOverdue = (task: Task) => {
  if (task.done_date != null) {
    return false;
  }
  return new Date(task.due_date) < startOfTodayDate;
};

export const isDueToday = (task: Task) => {
  if (task.done_date != null) {
    return false;
  }
  const dueDate = new Date(task.due_date);
  return dueDate >= startOfTodayDate && dueDate < endOfTodayDate;
};

export const isDueTomorrow = (task: Task) => {
  if (task.done_date != null) {
    return false;
  }
  const dueDate = new Date(task.due_date);
  return dueDate >= endOfTodayDate && dueDate < endOfTomorrowDate;
};

export const isDueThisWeek = (task: Task) => {
  if (task.done_date != null) {
    return false;
  }
  const dueDate = new Date(task.due_date);
  return dueDate >= endOfTomorrowDate && dueDate < endOfWeekDate;
};

export const isDueLater = (task: Task) => {
  if (task.done_date != null) {
    return false;
  }
  const dueDate = new Date(task.due_date);
  return dueDate >= endOfWeekDate;
};
