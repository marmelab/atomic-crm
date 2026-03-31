import {
  addDaysToISODate,
  endOfBusinessDayISOString,
  startOfBusinessDayISOString,
  todayISODate,
} from "@/lib/dateTimezone";

const todayIso = todayISODate();
const todayProbe = new Date(`${todayIso}T12:00:00.000Z`);
const todayDayOfWeek = todayProbe.getUTCDay();
export const isBeforeFriday = todayDayOfWeek < 5; // Friday is represented by 5

const tomorrowIso = addDaysToISODate(todayIso, 1);
const dayAfterTomorrowIso = addDaysToISODate(todayIso, 2);
const weekEndIso = addDaysToISODate(todayIso, 6 - todayDayOfWeek);

const startOfTodayDateISO = startOfBusinessDayISOString(todayIso)!;
const endOfTodayDateISO = endOfBusinessDayISOString(todayIso)!;
const startOfTomorrowDateISO = startOfBusinessDayISOString(tomorrowIso)!;
const endOfTomorrowDateISO = endOfBusinessDayISOString(tomorrowIso)!;
const startOfDayAfterTomorrowDateISO =
  startOfBusinessDayISOString(dayAfterTomorrowIso)!;
const endOfWeekDateISO = endOfBusinessDayISOString(weekEndIso)!;

export const taskFilters = {
  overdue: { "done_date@is": null, "due_date@lt": startOfTodayDateISO },
  today: {
    "done_date@is": null,
    "due_date@gte": startOfTodayDateISO,
    "due_date@lte": endOfTodayDateISO,
  },
  tomorrow: {
    "done_date@is": null,
    "due_date@gte": startOfTomorrowDateISO,
    "due_date@lte": endOfTomorrowDateISO,
  },
  thisWeek: {
    "done_date@is": null,
    "due_date@gte": startOfDayAfterTomorrowDateISO,
    "due_date@lte": endOfWeekDateISO,
  },
  later: { "done_date@is": null, "due_date@gt": endOfWeekDateISO },
};
