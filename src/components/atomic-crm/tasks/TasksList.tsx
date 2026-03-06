import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddTask } from "./AddTask";
import { TaskCreateSheet } from "./TaskCreateSheet";
import { TasksListContent } from "./TasksListContent";

export const TasksList = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("launcher_action") === "task_create") {
      setTaskCreateOpen(true);
    }
  }, [location.search]);

  const handleTaskCreateOpenChange = (open: boolean) => {
    setTaskCreateOpen(open);
    if (!open) {
      const searchParams = new URLSearchParams(location.search);
      if (searchParams.get("launcher_action") === "task_create") {
        navigate("/client_tasks", { replace: true });
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-4 mb-28 md:mb-2">
      <TaskCreateSheet
        open={taskCreateOpen}
        onOpenChange={handleTaskCreateOpenChange}
      />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl">Promemoria</CardTitle>
          <AddTask selectClient display="chip" />
        </CardHeader>
        <CardContent>
          <TasksListContent />
        </CardContent>
      </Card>
    </div>
  );
};
