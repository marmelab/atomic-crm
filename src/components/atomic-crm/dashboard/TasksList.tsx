import { CheckSquare } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { AddTask } from "../tasks/AddTask";
import { TasksListContent } from "../tasks/TasksListContent";

export const TasksList = () => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <CheckSquare className="text-muted-foreground h-5 w-5" />
          <CardTitle className="text-lg font-semibold">
            Upcoming Tasks
          </CardTitle>
        </div>
        <AddTask display="icon" selectContact />
      </CardHeader>
      <CardContent>
        <TasksListContent />
      </CardContent>
    </Card>
  );
};
