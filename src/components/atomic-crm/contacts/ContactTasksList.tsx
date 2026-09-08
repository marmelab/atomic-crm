import { useRecordContext, useTranslate } from "ra-core";
import { Skeleton } from "@/components/ui/skeleton";

import { AddTask } from "../tasks/AddTask";
import { TasksListByDueDate } from "../tasks/TasksListByDueDate";
import type { Contact } from "../types";

// Mobile Manual Task UX repair: this used to only offer "Add task" inside
// TasksListByDueDate's own emptyPlaceholder — the one time this contact
// had zero tasks. The moment a first task existed, the button vanished
// with no replacement anywhere on mobile ContactShow. Rendered here as an
// always-visible sibling instead (same AddTask component desktop's
// ContactAside already uses, reading contact_id off this same Contact
// record context — genuinely the Contact here, unlike ClientShow), so it
// stays available regardless of how many tasks exist or their status.
export const ContactTasksList = () => {
  const record = useRecordContext<Contact>();
  const translate = useTranslate();

  if (!record) return null;

  return (
    <div className="flex flex-col gap-2">
      <AddTask />
      <TasksListByDueDate
        filterByContact={record.id}
        emptyPlaceholder={
          <p className="text-sm text-muted-foreground text-center py-4">
            {translate("resources.tasks.empty")}
          </p>
        }
        pendingPlaceholder={
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton className="w-full h-10" key={index} />
            ))}
          </div>
        }
      />
    </div>
  );
};
