import { TasksListByDueDate } from "./TasksListByDueDate";
import { useTranslate } from "ra-core";

export const TasksListContent = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <TasksListByDueDate
        emptyPlaceholder={
          <p className="text-sm">
            {translate("crm.tasks.empty_list_hint", {
              _: "Tasks added to your contacts will appear here.",
            })}
          </p>
        }
      />
    </div>
  );
};
