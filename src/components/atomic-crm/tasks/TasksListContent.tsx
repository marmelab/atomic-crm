import { taskFilters, isBeforeFriday } from "./taskFilters";
import { TasksListEmpty } from "../dashboard/TasksListEmpty";
import { TasksListFilter } from "../dashboard/TasksListFilter";

export const TasksListContent = () => {
  return (
    <div className="flex flex-col gap-4">
      <TasksListEmpty />
      <TasksListFilter title="En retard" filter={taskFilters.overdue} />
      <TasksListFilter title="Aujourd'hui" filter={taskFilters.today} />
      <TasksListFilter title="Demain" filter={taskFilters.tomorrow} />
      {isBeforeFriday && (
        <TasksListFilter title="Cette semaine" filter={taskFilters.thisWeek} />
      )}
      <TasksListFilter title="Plus tard" filter={taskFilters.later} />
    </div>
  );
};
