import { CheckSquare } from "lucide-react";

import { AddTask } from "../tasks/AddTask";
import { TasksListContent } from "../tasks/TasksListContent";

export const TasksList = () => {
  return (
    <div className="flex flex-col gap-3 border border-border rounded-lg p-4 bg-card">
      <div className="flex items-center pb-3 border-b border-border">
        <div className="mr-3 flex">
          <CheckSquare className="text-muted-foreground w-5 h-5" />
        </div>
        <h2 className="text-lg font-semibold text-foreground flex-1">
          Upcoming Tasks
        </h2>
        <AddTask display="icon" selectContact />
      </div>
      <div className="p-2">
        <TasksListContent />
      </div>
    </div>
  );
};
