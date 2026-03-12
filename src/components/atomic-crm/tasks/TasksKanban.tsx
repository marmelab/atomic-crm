import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  type Identifier,
  useDataProvider,
  useGetIdentity,
  useGetList,
  useNotify,
  useTimeout,
  useTranslate,
} from "ra-core";

import type { Sale, Task as TaskData } from "../types";
import { Task } from "./Task";
import {
  filterTasksByView,
  getTasksFilter,
  type TasksListScope,
  type TasksListView,
} from "./tasksListView";
import {
  DONE_COLUMN_ID,
  IN_PROGRESS_COLUMN_ID,
  TODO_COLUMN_ID,
  UNASSIGNED_COLUMN_ID,
  getColumnIdForTask,
  getTaskPatchForDestination,
  type TasksKanbanGroupBy,
} from "./tasksKanbanUtils";

type TaskKanbanColumn = {
  id: string;
  label: string;
};

type TasksByColumn = Record<string, TaskData[]>;

const buildTasksByColumn = (
  tasks: TaskData[],
  columns: TaskKanbanColumn[],
  groupBy: TasksKanbanGroupBy,
): TasksByColumn => {
  const initialState = columns.reduce<TasksByColumn>((acc, column) => {
    acc[column.id] = [];
    return acc;
  }, {});

  for (const task of tasks) {
    const columnId = getColumnIdForTask(task, groupBy);
    if (initialState[columnId] == null) {
      initialState[columnId] = [];
    }
    initialState[columnId].push(task);
  }

  return initialState;
};

export const TasksKanban = ({
  filterByContact,
  filterByAssigner,
  scope = "assignee",
  groupBy = "assignee",
  view = "active",
  keepRecentlyDone = true,
  showStatus = false,
  emptyPlaceholder,
  pendingPlaceholder,
}: {
  filterByContact?: Identifier;
  filterByAssigner?: Identifier;
  scope?: TasksListScope;
  groupBy?: TasksKanbanGroupBy;
  view?: TasksListView;
  keepRecentlyDone?: boolean;
  showStatus?: boolean;
  emptyPlaceholder?: React.ReactNode;
  pendingPlaceholder?: React.ReactNode;
}) => {
  const { identity } = useGetIdentity();
  const translate = useTranslate();
  const notify = useNotify();
  const dataProvider = useDataProvider();
  const queryClient = useQueryClient();

  const filter = getTasksFilter({
    filterByContact,
    identityId: filterByAssigner ?? identity?.id,
    scope,
  });

  const { data: tasks, isPending } = useGetList<TaskData>(
    "tasks",
    {
      pagination: { page: 1, perPage: 1000 },
      sort:
        view === "archived"
          ? { field: "done_date", order: "DESC" }
          : { field: "due_date", order: "ASC" },
      filter,
    },
    {
      enabled:
        filterByContact != null
          ? true
          : filterByAssigner != null
            ? true
            : !!identity?.id,
    },
  );

  const { data: sales } = useGetList<Sale>("sales", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "last_name", order: "ASC" },
    filter: {},
  });

  const showContact = filterByContact == null;

  const tasksInCurrentView = useMemo(
    () =>
      filterTasksByView(tasks || [], {
        view,
        keepRecentlyDone,
      }),
    [tasks, view, keepRecentlyDone],
  );

  const columns = useMemo(() => {
    if (groupBy === "status") {
      return [
        {
          id: TODO_COLUMN_ID,
          label: translate("crm.tasks.active", { _: "To do" }),
        },
        {
          id: IN_PROGRESS_COLUMN_ID,
          label: translate("crm.tasks.status.in_progress", {
            _: "In progress",
          }),
        },
        {
          id: DONE_COLUMN_ID,
          label: translate("crm.tasks.kanban.done", { _: "Done" }),
        },
      ];
    }

    const salesById = new Map(
      (sales || []).map((sale) => [String(sale.id), sale]),
    );
    const columnIdsInTasks = Array.from(
      new Set(
        tasksInCurrentView.map((task) => getColumnIdForTask(task, groupBy)),
      ),
    );

    const orderedKnownColumns = (sales || [])
      .map((sale) => String(sale.id))
      .filter((id) => columnIdsInTasks.includes(id))
      .map((id) => {
        const sale = salesById.get(id)!;
        return {
          id,
          label: `${sale.first_name} ${sale.last_name}`.trim(),
        };
      });

    const unknownColumns = columnIdsInTasks
      .filter(
        (columnId) =>
          columnId !== UNASSIGNED_COLUMN_ID && !salesById.has(columnId),
      )
      .sort()
      .map((columnId) => ({
        id: columnId,
        label: translate("resources.sales.name", {
          smart_count: 1,
          _: "User",
        }),
      }));

    const unassignedColumn = columnIdsInTasks.includes(UNASSIGNED_COLUMN_ID)
      ? [
          {
            id: UNASSIGNED_COLUMN_ID,
            label: translate("crm.tasks.kanban.unassigned", {
              _: "Unassigned",
            }),
          },
        ]
      : [];

    return [...orderedKnownColumns, ...unknownColumns, ...unassignedColumn];
  }, [sales, tasksInCurrentView, translate, groupBy]);

  const tasksByColumn = useMemo(
    () => buildTasksByColumn(tasksInCurrentView, columns, groupBy),
    [tasksInCurrentView, columns, groupBy],
  );

  const [localTasksByColumn, setLocalTasksByColumn] =
    useState<TasksByColumn>(tasksByColumn);

  useEffect(() => {
    setLocalTasksByColumn(tasksByColumn);
  }, [tasksByColumn]);

  const oneSecondHasPassed = useTimeout(1000);

  if (isPending && oneSecondHasPassed) {
    return pendingPlaceholder ?? null;
  }

  if (isPending) {
    return null;
  }

  if (!tasksInCurrentView.length) {
    return emptyPlaceholder ?? null;
  }

  return (
    <DragDropContext
      onDragEnd={(result) => {
        const { destination, source } = result;
        if (!destination) {
          return;
        }

        if (destination.droppableId === source.droppableId) {
          return;
        }

        const previousState = localTasksByColumn;
        const nextState = Object.fromEntries(
          Object.entries(previousState).map(([key, value]) => [
            key,
            [...value],
          ]),
        ) as TasksByColumn;

        const sourceTasks = nextState[source.droppableId] || [];
        const [movedTask] = sourceTasks.splice(source.index, 1);
        if (!movedTask) {
          return;
        }

        const destinationTasks = nextState[destination.droppableId] || [];
        const taskPatch = getTaskPatchForDestination(
          movedTask,
          groupBy,
          destination.droppableId,
        );
        destinationTasks.splice(destination.index, 0, {
          ...movedTask,
          ...taskPatch,
        });

        nextState[source.droppableId] = sourceTasks;
        nextState[destination.droppableId] = destinationTasks;
        setLocalTasksByColumn(nextState);

        queryClient.setQueriesData(
          { queryKey: ["tasks", "getList"] },
          (previousQueryData: any) => {
            if (!previousQueryData || !Array.isArray(previousQueryData.data)) {
              return previousQueryData;
            }

            return {
              ...previousQueryData,
              data: previousQueryData.data.map((task: TaskData) =>
                task.id === movedTask.id ? { ...task, ...taskPatch } : task,
              ),
            };
          },
        );

        void dataProvider
          .update("tasks", {
            id: movedTask.id,
            data: taskPatch,
            previousData: movedTask,
          })
          .catch(() => {
            setLocalTasksByColumn(previousState);
            void queryClient.invalidateQueries({
              queryKey: ["tasks", "getList"],
            });
            notify("Could not move task. Please try again.", {
              type: "error",
            });
          });
      }}
    >
      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((column) => {
          const columnTasks = localTasksByColumn[column.id] || [];
          return (
            <div
              key={column.id}
              className="min-w-[320px] max-w-[420px] flex-1 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold">{column.label}</h3>
                <span className="text-xs text-muted-foreground">
                  {columnTasks.length}
                </span>
              </div>
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`rounded-xl border p-2 min-h-28 space-y-2 ${
                      snapshot.isDraggingOver ? "bg-muted/50" : "bg-muted/20"
                    }`}
                  >
                    {columnTasks.map((task, index) => (
                      <Draggable
                        key={task.id}
                        draggableId={String(task.id)}
                        index={index}
                      >
                        {(draggableProvided, draggableSnapshot) => (
                          <div
                            ref={draggableProvided.innerRef}
                            {...draggableProvided.draggableProps}
                            {...draggableProvided.dragHandleProps}
                            className={`will-change-transform ${
                              draggableSnapshot.isDragging ? "rotate-1" : ""
                            }`}
                          >
                            <Task
                              task={task}
                              showContact={showContact}
                              showAsArchived={view === "archived"}
                              showStatus={showStatus}
                              openOnCardClick
                              showCheckbox={false}
                              strikeDoneText={false}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {columnTasks.length === 0 && (
                      <p className="px-2 py-1 text-xs text-muted-foreground">
                        {translate("crm.tasks.kanban.empty_column", {
                          _: "No tasks in this column.",
                        })}
                      </p>
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
};
