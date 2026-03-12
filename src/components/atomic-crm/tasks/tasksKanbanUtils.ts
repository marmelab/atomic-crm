import type { Identifier } from "ra-core";

import type { Task as TaskData } from "../types";
import {
  getTaskCompletionPatch,
  getTaskWorkflowStatus,
  type TaskWorkflowStatus,
} from "./taskWorkflowStatus";

export const UNASSIGNED_COLUMN_ID = "unassigned";
export const TODO_COLUMN_ID = "todo";
export const IN_PROGRESS_COLUMN_ID = "in_progress";
export const DONE_COLUMN_ID = "done";

export type TasksKanbanGroupBy = "assignee" | "status";

export const getColumnIdForTask = (
  task: TaskData,
  groupBy: TasksKanbanGroupBy,
) => {
  if (groupBy === "status") {
    const workflowStatus = getTaskWorkflowStatus(task);
    if (workflowStatus === "in_progress") {
      return IN_PROGRESS_COLUMN_ID;
    }
    if (workflowStatus === "done") {
      return DONE_COLUMN_ID;
    }
    return TODO_COLUMN_ID;
  }

  return task.sales_id == null ? UNASSIGNED_COLUMN_ID : String(task.sales_id);
};

export const getSalesIdFromColumnId = (columnId: string): Identifier | null => {
  if (columnId === UNASSIGNED_COLUMN_ID) {
    return null;
  }
  const numericValue = Number(columnId);
  return Number.isNaN(numericValue) ? columnId : numericValue;
};

export const getStatusFromColumnId = (columnId: string): TaskWorkflowStatus => {
  if (columnId === DONE_COLUMN_ID) {
    return "done";
  }
  if (columnId === IN_PROGRESS_COLUMN_ID) {
    return "in_progress";
  }
  return "todo";
};

export const getTaskPatchForDestination = (
  task: TaskData,
  groupBy: TasksKanbanGroupBy,
  destinationColumnId: string,
) => {
  if (groupBy === "assignee") {
    return {
      sales_id: getSalesIdFromColumnId(destinationColumnId),
    };
  }

  return getTaskCompletionPatch(
    getStatusFromColumnId(destinationColumnId),
    task.done_date,
  );
};
