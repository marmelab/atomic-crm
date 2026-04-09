import { CheckSquare } from "lucide-react";
import { useTranslate } from "ra-core";
import { Card } from "@/components/ui/card";

import { AddTask } from "./AddTask";
import { TasksListContent } from "./TasksListContent";

export const TasksPage = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <CheckSquare className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-heading font-semibold flex-1">
          {translate("resources.tasks.name", {
            smart_count: 2,
            _: "Tasks",
          })}
        </h1>
        <AddTask display="icon" selectContact />
      </div>
      <Card className="p-6">
        <TasksListContent />
      </Card>
    </div>
  );
};
