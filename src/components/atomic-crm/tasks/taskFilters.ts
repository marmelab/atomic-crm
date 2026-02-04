import {
  endOfToday,
  endOfTomorrow,
  endOfWeek,
  getDay,
  startOfToday,
} from "date-fns";

const today = new Date();
const todayDayOfWeek = getDay(today);
export const isBeforeFriday = todayDayOfWeek < 5; // Friday is represented by 5
const startOfTodayDateISO = startOfToday().toISOString();
const endOfTodayDateISO = endOfToday().toISOString();
const endOfTomorrowDateISO = endOfTomorrow().toISOString();
const endOfWeekDateISO = endOfWeek(today, { weekStartsOn: 0 }).toISOString();

export const taskFilters = {
  overdue: { "done_date@is": null, "due_date@lt": startOfTodayDateISO },
  today: {
    "done_date@is": null,
    "due_date@gte": startOfTodayDateISO,
    "due_date@lte": endOfTodayDateISO,
  },
  tomorrow: {
    "done_date@is": null,
    "due_date@gt": endOfTodayDateISO,
    "due_date@lt": endOfTomorrowDateISO,
  },
  thisWeek: {
    "done_date@is": null,
    "due_date@gte": endOfTomorrowDateISO,
    "due_date@lte": endOfWeekDateISO,
  },
  later: { "done_date@is": null, "due_date@gt": endOfWeekDateISO },
};
