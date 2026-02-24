import { startOfToday } from "date-fns/startOfToday";
import { endOfToday } from "date-fns/endOfToday";
import { endOfTomorrow } from "date-fns/endOfTomorrow";
import { endOfWeek } from "date-fns/endOfWeek";

import { getDay } from "date-fns";

const today = new Date();
const todayDayOfWeek = getDay(today);
export const isBeforeFriday = todayDayOfWeek < 5; // Friday is represented by 5
export const startOfTodayDate = startOfToday();
export const endOfTodayDate = endOfToday();
export const endOfTomorrowDate = endOfTomorrow();
export const endOfWeekDate = endOfWeek(today, { weekStartsOn: 0 });

type Task = {
  due_date: string;
  done_date: string | null;
};

export const isDone = (task: Task) => task.done_date != null;

export const isOverdue = (dateString: string) => {
  return new Date(dateString) < startOfTodayDate;
};

export const isDueToday = (dateString: string) => {
  const dueDate = new Date(dateString);
  return dueDate >= startOfTodayDate && dueDate < endOfTodayDate;
};

export const isDueTomorrow = (dateString: string) => {
  const dueDate = new Date(dateString);
  return dueDate >= endOfTodayDate && dueDate < endOfTomorrowDate;
};

export const isDueThisWeek = (dateString: string) => {
  const dueDate = new Date(dateString);
  return dueDate >= endOfTomorrowDate && dueDate < endOfWeekDate;
};

export const isDueLater = (dateString: string) => {
  const dueDate = new Date(dateString);
  return dueDate >= endOfWeekDate;
};
