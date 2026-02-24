import {
  type Identifier,
  useGetIdentity,
  useGetList,
  useTimeout,
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
} from "./tasksPredicate";
import { useMemo } from "react";

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
    () => tasks?.filter((task) => !isDone(task)) || [],
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
        title="Overdue"
        showContact={showContact}
        isMobile={isMobile}
      />
      <TaskListFilter
        tasks={dueTodayTasks}
        title="Today"
        showContact={showContact}
        isMobile={isMobile}
      />
      <TaskListFilter
        tasks={dueTomorrowTasks}
        title="Tomorrow"
        showContact={showContact}
        isMobile={isMobile}
      />
      {!filterByContact ||
        (isBeforeFriday && (
          <TaskListFilter
            tasks={dueThisWeekTasks}
            title="This week"
            showContact={showContact}
            isMobile={isMobile}
          />
        ))}
      <TaskListFilter
        tasks={dueLaterTasks}
        title="Later"
        showContact={showContact}
        isMobile={isMobile}
      />
    </div>
  );
};
