import { useState } from "react";
import { useRecordContext } from "ra-core";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

import { TasksListByDueDate } from "../dashboard/TasksListByDueDate";
import { TaskCreateSheet } from "../tasks/TaskCreateSheet";
import type { Contact } from "../types";

export const ContactTasksList = () => {
  const record = useRecordContext<Contact>();
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);

  if (!record) return null;

  return (
    <TasksListByDueDate
      filterByContact={record.id}
      emptyPlaceholder={
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
      }
      pendingPlaceholder={
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton className="w-full h-10" key={index} />
          ))}
        </div>
      }
    />
  );
};
