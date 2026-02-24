import { TasksListByDueDate } from "../dashboard/TasksListByDueDate";

export const TasksListContent = () => {
  return (
    <div className="flex flex-col gap-4">
      <TasksListByDueDate
        emptyPlaceholder={
          <p className="text-sm">
            Tasks added to your contacts will appear here.
          </p>
        }
      />
    </div>
  );
};
