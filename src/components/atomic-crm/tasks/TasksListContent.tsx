import { TasksListEmpty } from "../dashboard/TasksListEmpty";
import { TasksListByDueDate } from "../dashboard/TasksListByDueDate";

export const TasksListContent = () => {
  return (
    <div className="flex flex-col gap-4">
      <TasksListEmpty />
      <TasksListByDueDate />
    </div>
  );
};
