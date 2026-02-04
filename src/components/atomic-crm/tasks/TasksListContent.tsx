import { taskFilters, isBeforeFriday } from "./taskFilters";
import { TasksListEmpty } from "../dashboard/TasksListEmpty";
import { TasksListFilter } from "../dashboard/TasksListFilter";

export const TasksListContent = () => {
  return (
    <div className="flex flex-col gap-4">
      <TasksListEmpty />
      <TasksListFilter title="Overdue" filter={taskFilters.overdue} />
      <TasksListFilter title="Today" filter={taskFilters.today} />
      <TasksListFilter title="Tomorrow" filter={taskFilters.tomorrow} />
      {isBeforeFriday && (
        <TasksListFilter title="This week" filter={taskFilters.thisWeek} />
      )}
      <TasksListFilter title="Later" filter={taskFilters.later} />
    </div>
  );
};
