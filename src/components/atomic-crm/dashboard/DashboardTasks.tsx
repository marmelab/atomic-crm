import { useMemo, useState } from "react";
import { useGetIdentity, useGetList, useTranslate } from "ra-core";

import { Task } from "../tasks/Task";
import {
  isDone,
  isDueNext7Days,
  isDueToday,
  isOverdue,
} from "../tasks/tasksPredicate";
import type { Task as TaskType } from "../types";

// The Dashboard's primary section: three short, scannable buckets instead
// of the detailed Overdue/Today/Tomorrow/This Week/Later view used on the
// Contact page and the mobile Tasks list (see tasksPredicate.ts). Reuses
// the same predicates and the same <Task> row component — no separate
// bucketing or rendering logic.
export const DashboardTasks = () => {
  const translate = useTranslate();
  const { identity } = useGetIdentity();
  const { data: tasks, isPending } = useGetList<TaskType>(
    "tasks",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "due_date", order: "ASC" },
      filter: { sales_id: identity?.id },
    },
    { enabled: !!identity },
  );

  const { overdue, today, next7Days } = useMemo(() => {
    const ongoing = (tasks ?? []).filter((task) => !isDone(task));
    return {
      overdue: ongoing.filter((task) => isOverdue(task.due_date)),
      today: ongoing.filter((task) => isDueToday(task.due_date)),
      next7Days: ongoing.filter((task) => isDueNext7Days(task.due_date)),
    };
  }, [tasks]);

  if (isPending) return null;

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-xl font-semibold">
        {translate("resources.tasks.name", { smart_count: 2 })}
      </h2>
      <p className="text-sm text-muted-foreground mb-2">
        {translate("crm.dashboard.tasks_orientation", {
          _: "Things you need to do or remember. Most are created automatically by the CRM.",
        })}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <TaskBucket
          title={translate("crm.dashboard.tasks_overdue", { _: "Overdue" })}
          tasks={overdue}
          emphasize
        />
        <TaskBucket
          title={translate("crm.dashboard.tasks_today", { _: "Today" })}
          tasks={today}
        />
        <TaskBucket
          title={translate("crm.dashboard.tasks_next_7_days", {
            _: "Next 7 Days",
          })}
          tasks={next7Days}
        />
      </div>
    </div>
  );
};

const VISIBLE_COUNT = 5;

const TaskBucket = ({
  title,
  tasks,
  emphasize,
}: {
  title: string;
  tasks: TaskType[];
  emphasize?: boolean;
}) => {
  const translate = useTranslate();
  const [expanded, setExpanded] = useState(false);
  const visibleTasks = expanded ? tasks : tasks.slice(0, VISIBLE_COUNT);
  const remaining = tasks.length - visibleTasks.length;

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2">
        <p
          className={`text-xs uppercase tracking-wider font-medium ${
            emphasize && tasks.length > 0
              ? "text-destructive"
              : "text-muted-foreground"
          }`}
        >
          {title}
        </p>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {translate("crm.dashboard.tasks_bucket_empty", {
            _: "Nothing here.",
          })}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleTasks.map((task) => (
            <Task task={task} showContact key={task.id} />
          ))}
          {remaining > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-sm text-muted-foreground underline hover:no-underline text-left"
            >
              {translate("crm.dashboard.tasks_load_more", {
                _: "%{count} more",
                count: remaining,
              })}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
