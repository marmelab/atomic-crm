import { DragDropContext, type OnDragEndResponder } from "@hello-pangea/dnd";
import isEqual from "lodash/isEqual";
import {
  type Identifier,
  useGetIdentity,
  useGetList,
  useNotify,
  useUpdate,
} from "ra-core";
import { useEffect, useState } from "react";

import type { Task, TaskStatus } from "../types";
import { TaskColumn } from "./TaskColumn";
import { TASK_STATUSES } from "./taskStatus";

type TasksByStatus = Record<TaskStatus, Task[]>;

const resolveColumn = (status: TaskStatus | null | undefined): TaskStatus =>
  status && TASK_STATUSES.some((s) => s.value === status) ? status : "todo";

const groupByStatus = (tasks: Task[]): TasksByStatus => {
  const grouped = Object.fromEntries(
    TASK_STATUSES.map((s) => [s.value, [] as Task[]]),
  ) as TasksByStatus;

  for (const task of tasks) {
    grouped[resolveColumn(task.status)].push(task);
  }

  // Keep each column sorted by due date (earliest first).
  for (const key of Object.keys(grouped) as TaskStatus[]) {
    grouped[key].sort((a, b) =>
      (a.due_date ?? "") < (b.due_date ?? "") ? -1 : 1,
    );
  }

  return grouped;
};

export const TasksKanban = ({
  filterByContact,
  extraFilter,
  emptyPlaceholder,
}: {
  filterByContact?: Identifier;
  extraFilter?: Record<string, any>;
  emptyPlaceholder?: React.ReactNode;
}) => {
  const { identity } = useGetIdentity();
  const isAdmin = (identity as any)?.administrator === true;
  const notify = useNotify();
  const [update] = useUpdate();

  const { data: tasks, isPending } = useGetList<Task>(
    "tasks",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "due_date", order: "ASC" },
      filter: {
        ...(filterByContact != null
          ? { contact_id: filterByContact }
          : !isAdmin
            ? { sales_id: identity?.id }
            : {}),
        ...extraFilter,
      },
    },
    { enabled: filterByContact != null ? true : !!identity },
  );

  const [tasksByStatus, setTasksByStatus] = useState<TasksByStatus>(() =>
    groupByStatus([]),
  );

  useEffect(() => {
    if (!tasks) return;
    const next = groupByStatus(tasks);
    setTasksByStatus((prev) => (isEqual(prev, next) ? prev : next));
  }, [tasks]);

  if (isPending) return null;

  const totalTasks = Object.values(tasksByStatus).reduce(
    (sum, list) => sum + list.length,
    0,
  );
  if (!totalTasks) return emptyPlaceholder ?? null;

  const onDragEnd: OnDragEndResponder = (result) => {
    const { destination, source } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceStatus = source.droppableId as TaskStatus;
    const destStatus = destination.droppableId as TaskStatus;

    const sourceList = Array.from(tasksByStatus[sourceStatus]);
    const [moved] = sourceList.splice(source.index, 1);
    if (!moved) return;

    // Reordering within the same column: update the visual order only.
    // Task ordering is not persisted (sorted by due date on reload).
    if (sourceStatus === destStatus) {
      sourceList.splice(destination.index, 0, moved);
      setTasksByStatus({ ...tasksByStatus, [sourceStatus]: sourceList });
      return;
    }

    // Moving across columns changes the task status.
    const isCompleting = destStatus === "completed";
    const updatedTask: Task = {
      ...moved,
      status: destStatus,
      done_date: isCompleting
        ? (moved.done_date ?? new Date().toISOString())
        : null,
    };

    const destList = Array.from(tasksByStatus[destStatus]);
    destList.splice(destination.index, 0, updatedTask);

    // Optimistic update.
    setTasksByStatus({
      ...tasksByStatus,
      [sourceStatus]: sourceList,
      [destStatus]: destList,
    });

    update(
      "tasks",
      {
        id: moved.id,
        data: {
          status: updatedTask.status,
          done_date: updatedTask.done_date,
        },
        previousData: moved,
      },
      {
        onError: () => {
          notify("ra.notification.http_error", { type: "error" });
          // Revert to the server state on failure.
          setTasksByStatus(groupByStatus(tasks ?? []));
        },
      },
    );
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 items-stretch">
        {TASK_STATUSES.map((status) => (
          <TaskColumn
            key={status.value}
            status={status}
            tasks={tasksByStatus[status.value] ?? []}
            showContact={filterByContact == null}
            showAssignee={isAdmin}
          />
        ))}
      </div>
    </DragDropContext>
  );
};
