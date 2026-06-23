import { CheckSquare } from "lucide-react";
import { useTranslate } from "ra-core";

import { AddTask } from "../tasks/AddTask";
import { TasksListContent } from "../tasks/TasksListContent";
import { DashboardCard } from "./DashboardCard";

export const TasksList = () => {
  const translate = useTranslate();
  return (
    <DashboardCard
      title={translate("crm.dashboard.upcoming_tasks", { _: "Uppgifter" })}
      icon={CheckSquare}
      action={<AddTask display="icon" selectContact />}
    >
      <TasksListContent />
    </DashboardCard>
  );
};
