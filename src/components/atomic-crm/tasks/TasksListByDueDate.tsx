import { useMemo } from "react";
import {
  type Identifier,
  useGetIdentity,
  useGetList,
  useTimeout,
  useTranslate,
} from "ra-core";
import { useIsMobile } from "@/hooks/use-mobile";

import { TaskListFilter } from "./TasksListFilter";
import {
  isBeforeFriday,
  isDone,
  isDueLater,
  isDueThisWeek,
  isDueToday,
  isDueTomorrow,
  isOverdue,
  isRecentlyDone,
} from "./tasksPredicate";

export const TasksListByDueDate = ({
  filterByContact,
  emptyPlaceholder,
  pendingPlaceholder,
}: {
  filterByContact?: Identifier;
  emptyPlaceholder?: React.ReactNode;
  pendingPlaceholder?: React.ReactNode;
}) => {
  const { identity } = useGetIdentity();
  const isMobile = useIsMobile();
  const translate = useTranslate();

  const { data: tasks, isPending } = useGetList(
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

  const showContact = filterByContact == null;

  const ongoingTasks = useMemo(
    () => tasks?.filter((task) => !isDone(task) || isRecentlyDone(task)) || [],
    [tasks],
  );

  const overdueTasks = useMemo(
    () =>
      ongoingTasks?.filter((task) => {
        return isOverdue(task.due_date);
      }) || [],
    [ongoingTasks],
  );

  const dueTodayTasks = useMemo(
    () =>
      ongoingTasks?.filter((task) => {
        return isDueToday(task.due_date);
      }) || [],
    [ongoingTasks],
  );

  const dueTomorrowTasks = useMemo(
    () => ongoingTasks?.filter((task) => isDueTomorrow(task.due_date)) || [],
    [ongoingTasks],
  );

  const dueThisWeekTasks = useMemo(
    () => ongoingTasks?.filter((task) => isDueThisWeek(task.due_date)) || [],
    [ongoingTasks],
  );

  const dueLaterTasks = useMemo(
    () => ongoingTasks?.filter((task) => isDueLater(task.due_date)) || [],
    [ongoingTasks],
  );

  const oneSecondHasPassed = useTimeout(1000);

  if (isPending && oneSecondHasPassed) {
    return pendingPlaceholder ?? null;
  }

  if (isPending) {
    return null;
  }

  if (!ongoingTasks.length) {
    return emptyPlaceholder ?? null;
  }

  return (
    <div className="flex flex-col gap-4">
      <TaskListFilter
        tasks={overdueTasks}
        title={translate("resources.tasks.filters.overdue")}
        showContact={showContact}
        isMobile={isMobile}
      />
      <TaskListFilter
        tasks={dueTodayTasks}
        title={translate("resources.tasks.filters.today")}
        showContact={showContact}
        isMobile={isMobile}
      />
      <TaskListFilter
        tasks={dueTomorrowTasks}
        title={translate("resources.tasks.filters.tomorrow")}
        showContact={showContact}
        isMobile={isMobile}
      />
      {(!filterByContact || (filterByContact && isBeforeFriday())) && (
        <TaskListFilter
          tasks={dueThisWeekTasks}
          title={translate("resources.tasks.filters.this_week")}
          showContact={showContact}
          isMobile={isMobile}
        />
      )}
      <TaskListFilter
        tasks={dueLaterTasks}
        title={translate("resources.tasks.filters.later")}
        showContact={showContact}
        isMobile={isMobile}
      />
    </div>
  );
};
