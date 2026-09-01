import { Check } from "lucide-react";
import { useGetIdentity, useGetList, useTranslate } from "ra-core";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";

import { Task } from "../tasks/Task";
import type { Task as TaskType } from "../types";
import { selectCompletedToday } from "./completedTodaySelection";

// Dashboard task completion UX repair pass, §C: a collapsed "Completed
// Today" home for a Task the moment it leaves DashboardTasks' active
// buckets — so completing something reads as "moved to a place I can
// still see and undo/reopen from", never "vanished". Reuses the exact
// <Task> row (its own checkbox already toggles done_date both ways, so
// re-checking one here reopens it for free — §D) rather than a second
// read-only rendering.
//
// "Today" is the CRM's own America/Denver business day (getDenverDateString,
// already established by Art Oracle/Coming Up), never the UTC calendar day
// — a task completed at 11pm Denver time must not roll into "yesterday" for
// a UTC-ahead server clock, and one completed just after midnight Denver
// must not still read as part of yesterday either.
export const CompletedTodayTasks = () => {
  const translate = useTranslate();
  const { identity } = useGetIdentity();
  const { data: tasks, isPending } = useGetList<TaskType>(
    "tasks",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "done_date", order: "DESC" },
      filter: { sales_id: identity?.id },
    },
    { enabled: !!identity },
  );

  if (isPending || !tasks) return null;

  const completedToday = selectCompletedToday(tasks);

  if (completedToday.length === 0) return null;

  return (
    <Card>
      <CardContent>
        <Accordion type="single" collapsible>
          <AccordionItem value="completed-today" className="border-none">
            <AccordionTrigger className="text-sm font-medium hover:no-underline py-0">
              <span className="flex items-center gap-2">
                <Check className="size-4 text-primary" />
                {translate("crm.dashboard.completed_today", {
                  _: "Completed Today",
                })}
              </span>
              <span className="text-sm font-normal text-muted-foreground ml-auto mr-2">
                {completedToday.length}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-3 pt-2">
                {completedToday.map((task) => (
                  <Task task={task} showContact key={task.id} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};
