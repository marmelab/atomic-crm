import { taskFilters, isBeforeFriday } from "./taskFilters";
import { TasksListEmpty } from "../dashboard/TasksListEmpty";
import { TasksListFilter } from "../dashboard/TasksListFilter";
import { useTranslate } from "ra-core";

export const TasksListContent = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <TasksListEmpty />
      <TasksListFilter
        title={translate("crm.tasks.filters.overdue", { _: "Overdue" })}
        filter={taskFilters.overdue}
      />
      <TasksListFilter
        title={translate("crm.tasks.filters.today", { _: "Today" })}
        filter={taskFilters.today}
      />
      <TasksListFilter
        title={translate("crm.tasks.filters.tomorrow", { _: "Tomorrow" })}
        filter={taskFilters.tomorrow}
      />
      {isBeforeFriday && (
        <TasksListFilter
          title={translate("crm.tasks.filters.this_week", { _: "This week" })}
          filter={taskFilters.thisWeek}
        />
      )}
      <TasksListFilter
        title={translate("crm.tasks.filters.later", { _: "Later" })}
        filter={taskFilters.later}
      />
    </div>
  );
};
