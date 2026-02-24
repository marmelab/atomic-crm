import { useTranslate } from "ra-core";
import { taskFilters, isBeforeFriday } from "./taskFilters";
import { TasksListEmpty } from "../dashboard/TasksListEmpty";
import { TasksListFilter } from "../dashboard/TasksListFilter";

export const TasksListContent = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <TasksListEmpty />
      <TasksListFilter
        title={translate("crm.tasks.filter.overdue", { _: "Overdue" })}
        filter={taskFilters.overdue}
      />
      <TasksListFilter
        title={translate("crm.filters.today", { _: "Today" })}
        filter={taskFilters.today}
      />
      <TasksListFilter
        title={translate("crm.tasks.filter.tomorrow", { _: "Tomorrow" })}
        filter={taskFilters.tomorrow}
      />
      {isBeforeFriday && (
        <TasksListFilter
          title={translate("crm.filters.this_week", { _: "This week" })}
          filter={taskFilters.thisWeek}
        />
      )}
      <TasksListFilter
        title={translate("crm.tasks.filter.later", { _: "Later" })}
        filter={taskFilters.later}
      />
    </div>
  );
};
