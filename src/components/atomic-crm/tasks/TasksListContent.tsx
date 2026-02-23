import { TasksListEmpty } from "../dashboard/TasksListEmpty";
import { TasksListFilter } from "../dashboard/TasksListFilter";

export const TasksListContent = () => {
  return (
    <div className="flex flex-col gap-4">
      <TasksListEmpty />
      <TasksListFilter />
    </div>
  );
};
