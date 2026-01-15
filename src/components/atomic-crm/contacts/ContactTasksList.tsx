import {
  endOfToday,
  endOfTomorrow,
  endOfWeek,
  getDay,
  startOfToday,
} from "date-fns";
import { useRecordContext } from "ra-core";

import { TasksListFilter } from "../dashboard/TasksListFilter";
import { AddTask } from "../tasks/AddTask";
import type { Contact } from "../types";

const today = new Date();
const todayDayOfWeek = getDay(today);
const isBeforeFriday = todayDayOfWeek < 5; // Friday is represented by 5
const startOfTodayDateISO = startOfToday().toISOString();
const endOfTodayDateISO = endOfToday().toISOString();
const endOfTomorrowDateISO = endOfTomorrow().toISOString();
const endOfWeekDateISO = endOfWeek(today, { weekStartsOn: 0 }).toISOString();

const taskFilters = {
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

export const ContactTasksList = () => {
  const record = useRecordContext<Contact>();

  if (!record) return null;

  return (
    <div className="flex flex-col gap-4">
      <TasksListFilter
        title="Overdue"
        filter={taskFilters.overdue}
        contactId={record.id}
      />
      <TasksListFilter
        title="Today"
        filter={taskFilters.today}
        contactId={record.id}
      />
      <TasksListFilter
        title="Tomorrow"
        filter={taskFilters.tomorrow}
        contactId={record.id}
      />
      {isBeforeFriday && (
        <TasksListFilter
          title="This week"
          filter={taskFilters.thisWeek}
          contactId={record.id}
        />
      )}
      <TasksListFilter
        title="Later"
        filter={taskFilters.later}
        contactId={record.id}
      />
      <AddTask />
    </div>
  );
};
