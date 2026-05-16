import { CheckSquare } from "lucide-react";
import { useGetIdentity } from "ra-core";

import { AddTask } from "./AddTask";
import { TasksListByDueDate } from "./TasksListByDueDate";

export const TasksPage = () => {
  const { identity } = useGetIdentity();
  const isAdmin = (identity as any)?.administrator === true;

  return (
    <div className="flex flex-col gap-6 mt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckSquare className="w-6 h-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Tasks</h1>
        </div>
        <AddTask display="icon" selectContact />
      </div>

      <TasksListByDueDate
        emptyPlaceholder={
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "No tasks yet. Create one using the + button above."
              : "No tasks assigned to you yet."}
          </p>
        }
      />
    </div>
  );
};
