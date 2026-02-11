import { CheckSquare } from "lucide-react";
import { Card } from "@/components/ui/card";

import { AddTask } from "../tasks/AddTask";
import { TasksListContent } from "../tasks/TasksListContent";

export const TasksList = () => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center">
        <div className="mr-3 flex">
          <CheckSquare className="text-muted-foreground w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-muted-foreground flex-1">
          Upcoming Tasks
        </h2>
        <AddTask display="icon" selectContact />
      </div>
      <Card className="p-4 mb-2">
        <TasksListContent />
      </Card>
    </div>
  );
};
