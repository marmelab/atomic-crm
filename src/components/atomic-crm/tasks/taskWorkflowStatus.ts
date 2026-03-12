export type TaskWorkflowStatus = "todo" | "in_progress" | "done";

export const getTaskWorkflowStatus = (task: {
  workflow_status?: TaskWorkflowStatus;
  done_date?: string | null;
}): TaskWorkflowStatus => {
  if (task.workflow_status === "in_progress") {
    return "in_progress";
  }
  if (task.workflow_status === "done" || task.done_date) {
    return "done";
  }
  return "todo";
};

export const getTaskCompletionPatch = (
  workflowStatus: TaskWorkflowStatus,
  previousDoneDate?: string | null,
) => {
  if (workflowStatus === "done") {
    return {
      workflow_status: "done" as const,
      done_date: previousDoneDate ?? new Date().toISOString(),
    };
  }

  return {
    workflow_status: workflowStatus,
    done_date: null,
  };
};
