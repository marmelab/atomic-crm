import { TasksListByDueDate } from "./TasksListByDueDate";
import { useTranslate } from "ra-core";

export const TasksListContent = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <TasksListByDueDate
        emptyPlaceholder={
          <p className="text-sm">
            {translate("resources.tasks.empty_list_hint")}
          </p>
        }
      />
    </div>
  );
};
