import { useMemo } from "react";
import {
  type Identifier,
  useGetIdentity,
  useGetList,
  useTimeout,
  useTranslate,
} from "ra-core";
import { useIsMobile } from "@/hooks/use-mobile";

import { Task } from "./Task";
import { TaskListFilter } from "./TasksListFilter";
import {
  isBeforeFriday,
  isDone,
  isDueLater,
  isDueThisWeek,
  isDueToday,
  isDueTomorrow,
  isOverdue,
} from "./tasksPredicate";
import { useRecentlyCompletedTasks } from "./useRecentlyCompletedTasks";
import type { Task as TaskType } from "../types";

// Human-acceptance repair (Tasks noise): within each due-date bucket,
// pending Tasks always come first (in the server's own ascending-due-date
// order, preserved by the filter below), any recently-completed ones
// after — never mixed by due date across the pending/done boundary. Every
// item here already passed the `!isDone || isRecentlyCompleted` gate one
// level up, so "done" here means "recently completed", not "buried
// forever" — see useRecentlyCompletedTasks's own header comment for the
// short window and automatic removal.
const pendingFirst = (tasks: TaskType[]): TaskType[] => {
  const pending = tasks.filter((task) => !isDone(task));
  const recentlyCompleted = tasks.filter((task) => isDone(task));
  return [...pending, ...recentlyCompleted];
};

export const TasksListByDueDate = ({
  filterByContact,
  emptyPlaceholder,
  pendingPlaceholder,
}: {
  filterByContact?: Identifier;
  emptyPlaceholder?: React.ReactNode;
  pendingPlaceholder?: React.ReactNode;
}) => {
  const { identity } = useGetIdentity();
  const isMobile = useIsMobile();
  const translate = useTranslate();
  const { isRecentlyCompleted, markCompleted } = useRecentlyCompletedTasks();

  const { data: tasks, isPending } = useGetList(
    "tasks",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "due_date", order: "ASC" },
      filter: {
        ...(filterByContact != null
          ? { contact_id: filterByContact }
          : { sales_id: identity?.id }),
      },
    },
    { enabled: filterByContact != null ? true : !!identity },
  );

  const showContact = filterByContact == null;

  const ongoingTasks = useMemo(
    () =>
      tasks?.filter((task) => !isDone(task) || isRecentlyCompleted(task.id)) ||
      [],
    [tasks, isRecentlyCompleted],
  );

  const overdueTasks = useMemo(
    () =>
      pendingFirst(
        ongoingTasks?.filter((task) => {
          return isOverdue(task.due_date);
        }) || [],
      ),
    [ongoingTasks],
  );

  const dueTodayTasks = useMemo(
    () =>
      pendingFirst(
        ongoingTasks?.filter((task) => {
          return isDueToday(task.due_date);
        }) || [],
      ),
    [ongoingTasks],
  );

  const dueTomorrowTasks = useMemo(
    () =>
      pendingFirst(
        ongoingTasks?.filter((task) => isDueTomorrow(task.due_date)) || [],
      ),
    [ongoingTasks],
  );

  const dueThisWeekTasks = useMemo(
    () =>
      pendingFirst(
        ongoingTasks?.filter((task) => isDueThisWeek(task.due_date)) || [],
      ),
    [ongoingTasks],
  );

  const dueLaterTasks = useMemo(
    () =>
      pendingFirst(
        ongoingTasks?.filter((task) => isDueLater(task.due_date)) || [],
      ),
    [ongoingTasks],
  );

  // Human-acceptance repair, §3C: completed Tasks are never deleted just
  // to keep the actionable view clean — they leave `ongoingTasks` once
  // their brief confirmation window elapses (see pendingFirst's own
  // comment), but stay reachable here, oldest-completion-first excluded,
  // most-recent-first, behind the same collapsed <details> disclosure
  // convention already used elsewhere in this app (Sessions' own
  // History, the onboarding/offboarding checklists). Excludes anything
  // still in its recently-completed window so a Task never appears in
  // both places at once.
  const completedTasks = useMemo(
    () =>
      (tasks ?? [])
        .filter((task) => isDone(task) && !isRecentlyCompleted(task.id))
        .sort((a, b) => (b.done_date ?? "").localeCompare(a.done_date ?? "")),
    [tasks, isRecentlyCompleted],
  );

  const oneSecondHasPassed = useTimeout(1000);

  if (isPending && oneSecondHasPassed) {
    return pendingPlaceholder ?? null;
  }

  if (isPending) {
    return null;
  }

  // Lifecycle-Task completion durability fix: this used to check only
  // `ongoingTasks.length`, so a contact/list with NO pending work but
  // real completed history (e.g. every lifecycle Task just got checked
  // off) fell through to the empty placeholder — silently hiding the
  // "Completed tasks" disclosure §3C explicitly asks to keep reachable.
  // The empty state is only genuinely correct when there is truly
  // nothing at all, pending or historical.
  if (!ongoingTasks.length && !completedTasks.length) {
    return emptyPlaceholder ?? null;
  }

  return (
    <div className="flex flex-col gap-4">
      <TaskListFilter
        tasks={overdueTasks}
        title={translate("resources.tasks.filters.overdue")}
        showContact={showContact}
        isMobile={isMobile}
        onCompleted={markCompleted}
      />
      <TaskListFilter
        tasks={dueTodayTasks}
        title={translate("resources.tasks.filters.today")}
        showContact={showContact}
        isMobile={isMobile}
        onCompleted={markCompleted}
      />
      <TaskListFilter
        tasks={dueTomorrowTasks}
        title={translate("resources.tasks.filters.tomorrow")}
        showContact={showContact}
        isMobile={isMobile}
        onCompleted={markCompleted}
      />
      {(!filterByContact || (filterByContact && isBeforeFriday())) && (
        <TaskListFilter
          tasks={dueThisWeekTasks}
          title={translate("resources.tasks.filters.this_week")}
          showContact={showContact}
          isMobile={isMobile}
          onCompleted={markCompleted}
        />
      )}
      <TaskListFilter
        tasks={dueLaterTasks}
        title={translate("resources.tasks.filters.later")}
        showContact={showContact}
        isMobile={isMobile}
        onCompleted={markCompleted}
      />
      {completedTasks.length > 0 && (
        <details className="group rounded-lg border">
          <summary className="cursor-pointer list-none px-4 py-2.5 text-xs text-muted-foreground tracking-wide flex items-center justify-between">
            {translate("resources.tasks.completed_history", {
              _: "Completed tasks (%{count})",
              count: completedTasks.length,
            })}
            <span className="text-muted-foreground group-open:rotate-180 transition-transform">
              ▾
            </span>
          </summary>
          <div className="flex flex-col gap-3 px-4 pb-2.5 pt-1">
            {completedTasks.map((task) => (
              <Task task={task} showContact={showContact} key={task.id} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
};
