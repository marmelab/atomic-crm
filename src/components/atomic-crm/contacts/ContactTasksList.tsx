import { useState } from "react";
import { useRecordContext, useGetList, useTimeout } from "ra-core";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

import { TasksListByDueDate } from "../dashboard/TasksListByDueDate";
import { TaskCreateSheet } from "../tasks/TaskCreateSheet";
import type { Contact } from "../types";

export const ContactTasksList = () => {
  const record = useRecordContext<Contact>();
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);
  const oneSecondHasPassed = useTimeout(1000);
  const { total, isPending } = useGetList("tasks", {
    filter: {
      "contact_id@eq": record?.id,
      "done_date@is": null,
    },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "due_date", order: "ASC" },
  });

  if (!record) return null;

  const hasActiveTasks = total != null && total > 0;

  if (isPending) {
    if (!oneSecondHasPassed) {
      return null;
    }
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton className="w-full h-10" key={index} />
        ))}
      </div>
    );
  }
  if (!hasActiveTasks) {
    return (
      <>
        <TaskCreateSheet
          open={taskCreateOpen}
          onOpenChange={setTaskCreateOpen}
          contact_id={record.id}
        />
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-muted-foreground mb-4">No tasks yet</p>
          <Button variant="outline" onClick={() => setTaskCreateOpen(true)}>
            Add task
          </Button>
        </div>
      </>
    );
  }

  return <TasksListByDueDate filterByContact={record.id} />;
};
