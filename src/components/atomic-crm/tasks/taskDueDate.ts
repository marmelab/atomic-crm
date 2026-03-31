import {
  addDaysToISODate,
  startOfBusinessDayISOString,
  toBusinessISODate,
} from "@/lib/dateTimezone";

export const normalizeTaskDueDateForMutation = (
  dueDate: string,
  allDay: boolean,
): string => {
  if (!allDay) {
    return dueDate;
  }

  return startOfBusinessDayISOString(dueDate) ?? dueDate;
};

export const postponeTaskDueDate = (
  dueDate: string,
  days: number,
  allDay: boolean,
): string => {
  if (allDay) {
    const dueDateIso = toBusinessISODate(dueDate);
    if (!dueDateIso) {
      return dueDate;
    }

    return normalizeTaskDueDateForMutation(
      addDaysToISODate(dueDateIso, days),
      true,
    );
  }

  const date = new Date(dueDate);
  if (Number.isNaN(date.valueOf())) {
    return dueDate;
  }

  date.setDate(date.getDate() + days);
  return date.toISOString();
};
