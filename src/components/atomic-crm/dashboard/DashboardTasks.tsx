import { useMemo, useState } from "react";
import { useGetIdentity, useGetList, useTranslate } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";

import { Task } from "../tasks/Task";
import {
  isDone,
  isDueNext7Days,
  isDueToday,
  isOverdue,
  TASK_TYPES_WITHOUT_MEANINGFUL_DUE_DATE,
} from "../tasks/tasksPredicate";
import { useRecentlyCompletedTasks } from "../tasks/useRecentlyCompletedTasks";
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

  // Dashboard task completion UX repair pass, §A: a just-completed Task
  // stays visible (checked, muted) for a moment instead of vanishing the
  // instant its optimistic done_date lands — reusing tasksPredicate.ts's
  // own "recently done" idea (isRecentlyDone, already relied on by the
  // Contact page's task list) would keep it around for 5 minutes, far
  // longer than the brief acknowledgement this needs. Shared with
  // ClientShow's/ContactShow's own Task lists (TasksListByDueDate) —
  // see useRecentlyCompletedTasks's own header comment.
  const { isRecentlyCompleted, markCompleted: handleTaskCompleted } =
    useRecentlyCompletedTasks();

  const { needsAttention, overdue, today, next7Days } = useMemo(() => {
    const ongoing = (tasks ?? []).filter(
      (task) => !isDone(task) || isRecentlyCompleted(task.id),
    );
    // A type in TASK_TYPES_WITHOUT_MEANINGFUL_DUE_DATE (currently just
    // resolve_sales_call) carries a due_date that's an internal DB-required
    // field only, set to "now" at creation — never a real commitment Leif
    // made and never a date at all in the product sense. It is not
    // overdue, not due today, not due later — it's a system exception
    // needing a decision, so it's excluded from all three date-bucketed
    // views entirely and shown in its own Needs Attention section instead,
    // for as long as it's unresolved (resolving/dismissing the underlying
    // sales call marks the Task done via completeResolveSalesCallTask,
    // which — like any other Task — drops it out of `ongoing` above; no
    // separate removal logic needed here). Still just a Task record under
    // the hood — this is a presentation split, not a new domain/table.
    const hasNoMeaningfulDueDate = (task: TaskType) =>
      TASK_TYPES_WITHOUT_MEANINGFUL_DUE_DATE.has(task.type ?? "");
    return {
      needsAttention: ongoing.filter(hasNoMeaningfulDueDate),
      overdue: ongoing.filter(
        (task) => !hasNoMeaningfulDueDate(task) && isOverdue(task.due_date),
      ),
      today: ongoing.filter(
        (task) => !hasNoMeaningfulDueDate(task) && isDueToday(task.due_date),
      ),
      next7Days: ongoing.filter(
        (task) =>
          !hasNoMeaningfulDueDate(task) && isDueNext7Days(task.due_date),
      ),
    };
  }, [tasks, isRecentlyCompleted]);

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
      {/* A system exception (e.g. an Acuity booking that couldn't be
          matched to an Opportunity) — no due date, so it doesn't belong in
          any of the three date-bucketed views below. Only rendered while
          something actually needs a decision; once resolved/dismissed the
          Task is done and this section disappears on its own. */}
      {needsAttention.length > 0 && (
        <TaskBucket
          title={translate("crm.dashboard.tasks_needs_attention", {
            _: "Needs Attention",
          })}
          tasks={needsAttention}
          onTaskCompleted={handleTaskCompleted}
          emphasize
        />
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <TaskBucket
          title={translate("crm.dashboard.tasks_overdue", { _: "Overdue" })}
          tasks={overdue}
          onTaskCompleted={handleTaskCompleted}
          emphasize
        />
        <TaskBucket
          title={translate("crm.dashboard.tasks_today", { _: "Today" })}
          tasks={today}
          onTaskCompleted={handleTaskCompleted}
        />
        <TaskBucket
          title={translate("crm.dashboard.tasks_next_7_days", {
            _: "Next 7 Days",
          })}
          tasks={next7Days}
          onTaskCompleted={handleTaskCompleted}
        />
      </div>
    </div>
  );
};

const VISIBLE_COUNT = 5;

const TaskBucket = ({
  title,
  tasks,
  onTaskCompleted,
  emphasize,
}: {
  title: string;
  tasks: TaskType[];
  onTaskCompleted: (task: TaskType) => void;
  emphasize?: boolean;
}) => {
  const translate = useTranslate();
  const [expanded, setExpanded] = useState(false);
  const visibleTasks = expanded ? tasks : tasks.slice(0, VISIBLE_COUNT);
  const remaining = tasks.length - visibleTasks.length;

  return (
    <Card className="min-w-0">
      <CardContent className="flex flex-col gap-2">
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
              <Task
                task={task}
                showContact
                onCompleted={onTaskCompleted}
                key={task.id}
              />
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
      </CardContent>
    </Card>
  );
};
