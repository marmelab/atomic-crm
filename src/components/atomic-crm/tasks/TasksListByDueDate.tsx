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
  isDueLater,
  isDueThisWeek,
  isDueToday,
  isDueTomorrow,
  isOverdue,
} from "./tasksPredicate";
import {
  filterTasksByView,
  getTasksFilter,
  type TasksListScope,
  type TasksListView,
} from "./tasksListView";

export const TasksListByDueDate = ({
  filterByContact,
  filterByAssigner,
  scope = "assignee",
  view = "active",
  keepRecentlyDone = true,
  showStatus = false,
  includeDoneTasks = false,
  groupByDueDateInAllView = false,
  emptyPlaceholder,
  pendingPlaceholder,
}: {
  filterByContact?: Identifier;
  filterByAssigner?: Identifier;
  scope?: TasksListScope;
  view?: TasksListView;
  keepRecentlyDone?: boolean;
  showStatus?: boolean;
  includeDoneTasks?: boolean;
  groupByDueDateInAllView?: boolean;
  emptyPlaceholder?: React.ReactNode;
  pendingPlaceholder?: React.ReactNode;
}) => {
  const { identity } = useGetIdentity();
  const translate = useTranslate();
  const isMobile = useIsMobile();

  const filter = getTasksFilter({
    filterByContact,
    identityId: filterByAssigner ?? identity?.id,
    scope,
  });

  const { data: tasks, isPending } = useGetList(
    "tasks",
    {
      pagination: { page: 1, perPage: 1000 },
      sort:
        view === "archived"
          ? { field: "done_date", order: "DESC" }
          : { field: "due_date", order: "ASC" },
      filter,
    },
    {
      enabled:
        filterByContact != null
          ? true
          : filterByAssigner != null
            ? true
            : !!identity?.id,
    },
  );

  const showContact = filterByContact == null;

  const tasksInCurrentView = useMemo(
    () =>
      filterTasksByView(tasks || [], {
        view,
        keepRecentlyDone,
      }),
    [tasks, view, keepRecentlyDone],
  );

  const overdueTasks = useMemo(
    () =>
      tasksInCurrentView?.filter((task) => {
        return isOverdue(task.due_date);
      }) || [],
    [tasksInCurrentView],
  );

  const dueTodayTasks = useMemo(
    () =>
      tasksInCurrentView?.filter((task) => {
        return isDueToday(task.due_date);
      }) || [],
    [tasksInCurrentView],
  );

  const dueTomorrowTasks = useMemo(
    () =>
      tasksInCurrentView?.filter((task) => isDueTomorrow(task.due_date)) || [],
    [tasksInCurrentView],
  );

  const dueThisWeekTasks = useMemo(
    () =>
      tasksInCurrentView?.filter((task) => isDueThisWeek(task.due_date)) || [],
    [tasksInCurrentView],
  );

  const dueLaterTasks = useMemo(
    () => tasksInCurrentView?.filter((task) => isDueLater(task.due_date)) || [],
    [tasksInCurrentView],
  );

  const oneSecondHasPassed = useTimeout(1000);

  if (isPending && oneSecondHasPassed) {
    return pendingPlaceholder ?? null;
  }

  if (isPending) {
    return null;
  }

  if (!tasksInCurrentView.length) {
    return emptyPlaceholder ?? null;
  }

  if (view === "archived") {
    return (
      <TaskListFilter
        tasks={tasksInCurrentView}
        title={translate("crm.tasks.filter.archived", { _: "Archived" })}
        showContact={showContact}
        isMobile={isMobile}
        includeDoneTasks
        showAsArchived
        showStatus={showStatus}
      />
    );
  }

  if (view === "all") {
    if (groupByDueDateInAllView) {
      return (
        <div className="flex flex-col gap-4">
          <TaskListFilter
            tasks={overdueTasks}
            title={translate("crm.tasks.filter.overdue", { _: "Overdue" })}
            showContact={showContact}
            isMobile={isMobile}
            showStatus={showStatus}
            includeDoneTasks={includeDoneTasks}
          />
          <TaskListFilter
            tasks={dueTodayTasks}
            title={translate("crm.filters.today", { _: "Today" })}
            showContact={showContact}
            isMobile={isMobile}
            showStatus={showStatus}
            includeDoneTasks={includeDoneTasks}
          />
          <TaskListFilter
            tasks={dueTomorrowTasks}
            title={translate("crm.tasks.filter.tomorrow", { _: "Tomorrow" })}
            showContact={showContact}
            isMobile={isMobile}
            showStatus={showStatus}
            includeDoneTasks={includeDoneTasks}
          />
          {(!filterByContact || (filterByContact && isBeforeFriday())) && (
            <TaskListFilter
              tasks={dueThisWeekTasks}
              title={translate("crm.filters.this_week", { _: "This week" })}
              showContact={showContact}
              isMobile={isMobile}
              showStatus={showStatus}
              includeDoneTasks={includeDoneTasks}
            />
          )}
          <TaskListFilter
            tasks={dueLaterTasks}
            title={translate("crm.tasks.filter.later", { _: "Later" })}
            showContact={showContact}
            isMobile={isMobile}
            showStatus={showStatus}
            includeDoneTasks={includeDoneTasks}
          />
        </div>
      );
    }

    return (
      <TaskListFilter
        tasks={tasksInCurrentView}
        title={translate("crm.tasks.filter.all", { _: "All" })}
        showContact={showContact}
        isMobile={isMobile}
        includeDoneTasks={includeDoneTasks}
        showStatus={showStatus}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <TaskListFilter
        tasks={overdueTasks}
        title={translate("crm.tasks.filter.overdue", { _: "Overdue" })}
        showContact={showContact}
        isMobile={isMobile}
        showStatus={showStatus}
        includeDoneTasks={includeDoneTasks}
      />
      <TaskListFilter
        tasks={dueTodayTasks}
        title={translate("crm.filters.today", { _: "Today" })}
        showContact={showContact}
        isMobile={isMobile}
        showStatus={showStatus}
        includeDoneTasks={includeDoneTasks}
      />
      <TaskListFilter
        tasks={dueTomorrowTasks}
        title={translate("crm.tasks.filter.tomorrow", { _: "Tomorrow" })}
        showContact={showContact}
        isMobile={isMobile}
        showStatus={showStatus}
        includeDoneTasks={includeDoneTasks}
      />
      {(!filterByContact || (filterByContact && isBeforeFriday())) && (
        <TaskListFilter
          tasks={dueThisWeekTasks}
          title={translate("crm.filters.this_week", { _: "This week" })}
          showContact={showContact}
          isMobile={isMobile}
          showStatus={showStatus}
          includeDoneTasks={includeDoneTasks}
        />
      )}
      <TaskListFilter
        tasks={dueLaterTasks}
        title={translate("crm.tasks.filter.later", { _: "Later" })}
        showContact={showContact}
        isMobile={isMobile}
        showStatus={showStatus}
        includeDoneTasks={includeDoneTasks}
      />
    </div>
  );
};
