import { CheckSquare } from "lucide-react";
import { Card } from "@/components/ui/card";

import { AddTask } from "../tasks/AddTask";
import { TasksListContent } from "../tasks/TasksListContent";

export const TasksList = () => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <CheckSquare className="size-6 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-muted-foreground flex-1">
          Upcoming Tasks
        </h2>
        <AddTask display="icon" selectContact />
      </div>
      <Card className="p-6">
        <TasksListContent />
      </Card>
    </div>
  );
};
