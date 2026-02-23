import { type Identifier, useGetIdentity, useGetList } from "ra-core";

import { useIsMobile } from "@/hooks/use-mobile";
import { startOfToday } from "date-fns/startOfToday";
import { endOfToday } from "date-fns/endOfToday";
import { endOfTomorrow } from "date-fns/endOfTomorrow";
import { endOfWeek } from "date-fns/endOfWeek";

import { getDay } from "date-fns";
import { TaskListFilter } from "./TasksListFilter";

const today = new Date();
const todayDayOfWeek = getDay(today);
const isBeforeFriday = todayDayOfWeek < 5; // Friday is represented by 5
const startOfTodayDate = startOfToday();
const endOfTodayDate = endOfToday();
const endOfTomorrowDate = endOfTomorrow();
const endOfWeekDate = endOfWeek(today, { weekStartsOn: 0 });

type Task = {
  id: Identifier;
  due_date: string;
  done_date: string | null;
};

const isOverdue = (task: Task) =>
  task.done_date == null || new Date(task.due_date) < startOfTodayDate;

const isDueToday = (task: Task) => {
  if (task.done_date != null) {
    return false;
  }
  const dueDate = new Date(task.due_date);
  return dueDate >= startOfTodayDate && dueDate < endOfTodayDate;
};

const isDueTomorrow = (task: Task) => {
  if (task.done_date != null) {
    return false;
  }
  const dueDate = new Date(task.due_date);
  return dueDate >= endOfTodayDate && dueDate < endOfTomorrowDate;
};

const isDueThisWeek = (task: Task) => {
  if (task.done_date != null) {
    return false;
  }
  const dueDate = new Date(task.due_date);
  return dueDate >= endOfTomorrowDate && dueDate < endOfWeekDate;
};

const isDueLater = (task: Task) => {
  if (task.done_date != null) {
    return false;
  }
  const dueDate = new Date(task.due_date);
  return dueDate >= endOfWeekDate;
};

export const TasksListByDueDate = ({
  filterByContact,
}: {
  filterByContact?: Identifier;
}) => {
  const { identity } = useGetIdentity();
  const isMobile = useIsMobile();

  const {
    data: tasks,
    total,
    isPending,
  } = useGetList(
    "tasks",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "due_date", order: "ASC" },
      filter: {
        ...(filterByContact != null
          ? { contact_id: filterByContact }
          : { sales_id: identity?.id }),
      },
    },
    { enabled: filterByContact != null ? true : !!identity },
  );

  if (!tasks || !total || isPending) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <TaskListFilter
        isPending={isPending}
        tasks={tasks}
        title="Overdue"
        filterByContact={filterByContact}
        taskPredicate={isOverdue}
        isMobile={isMobile}
      />
      <TaskListFilter
        isPending={isPending}
        tasks={tasks}
        title="Today"
        filterByContact={filterByContact}
        isMobile={isMobile}
        taskPredicate={isDueToday}
      />
      <TaskListFilter
        isPending={isPending}
        tasks={tasks!}
        title="Tomorrow"
        filterByContact={filterByContact}
        isMobile={isMobile}
        taskPredicate={isDueTomorrow}
      />
      {!filterByContact && isBeforeFriday && (
        <TaskListFilter
          isPending={isPending}
          tasks={tasks}
          title="This week"
          filterByContact={filterByContact}
          isMobile={isMobile}
          taskPredicate={isDueThisWeek}
        />
      )}
      <TaskListFilter
        isPending={isPending}
        tasks={tasks}
        title="Later"
        filterByContact={filterByContact}
        isMobile={isMobile}
        taskPredicate={isDueLater}
      />
    </div>
  );
};
