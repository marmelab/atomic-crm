import { type Identifier, useGetIdentity, useGetList } from "ra-core";

import { useIsMobile } from "@/hooks/use-mobile";
import { TaskListFilter } from "./TasksListFilter";
import {
  isBeforeFriday,
  isDueLater,
  isDueThisWeek,
  isDueToday,
  isDueTomorrow,
  isOverdue,
} from "./tasksPredicate";

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
        tasks={tasks}
        title="Overdue"
        filterByContact={filterByContact}
        taskPredicate={isOverdue}
        isMobile={isMobile}
      />
      <TaskListFilter
        tasks={tasks}
        title="Today"
        filterByContact={filterByContact}
        isMobile={isMobile}
        taskPredicate={isDueToday}
      />
      <TaskListFilter
        tasks={tasks!}
        title="Tomorrow"
        filterByContact={filterByContact}
        isMobile={isMobile}
        taskPredicate={isDueTomorrow}
      />
      {!filterByContact && isBeforeFriday && (
        <TaskListFilter
          tasks={tasks}
          title="This week"
          filterByContact={filterByContact}
          isMobile={isMobile}
          taskPredicate={isDueThisWeek}
        />
      )}
      <TaskListFilter
        tasks={tasks}
        title="Later"
        filterByContact={filterByContact}
        isMobile={isMobile}
        taskPredicate={isDueLater}
      />
    </div>
  );
};
