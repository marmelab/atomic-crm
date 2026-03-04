import type { DataProvider, Identifier } from "ra-core";
import type { Workflow, WorkflowAction } from "../types";
import type { CrmDataProvider } from "../providers/supabase/dataProvider";

/**
 * Lightweight workflow engine that runs client-side.
 * Checks active workflows after CRUD operations and executes matching actions.
 *
 * Design: single-depth execution only (actions triggered by workflows
 * do NOT re-trigger workflows, preventing infinite loops).
 */

let _executing = false;

interface WorkflowMatch {
  workflow: Workflow;
  record: Record<string, unknown>;
  previousData?: Record<string, unknown>;
}

interface WorkflowTriggerParams {
  resource: string;
  event: "created" | "updated" | "status_changed";
  record: Record<string, unknown>;
  previousData?: Record<string, unknown>;
}

export const checkAndRunWorkflows = async (
  dataProvider: DataProvider,
  params: WorkflowTriggerParams,
) => {
  const { resource, event, record, previousData } = params;
  // Prevent recursive execution
  if (_executing) return;

  try {
    _executing = true;
    const { data: workflows } = await dataProvider.getList<Workflow>(
      "workflows",
      {
        pagination: { page: 1, perPage: 100 },
        sort: { field: "created_at", order: "ASC" },
        filter: {
          "is_active@eq": true,
          "trigger_resource@eq": resource,
          "trigger_event@eq": event,
        },
      },
    );

    if (!workflows?.length) return;

    const matches = workflows.filter((wf) =>
      matchesConditions(wf.trigger_conditions, record, previousData),
    );

    for (const workflow of matches) {
      await executeWorkflow(dataProvider, {
        workflow,
        record,
        previousData,
      });
    }
  } catch (err) {
    console.error("[WorkflowEngine] Error checking workflows:", err);
  } finally {
    _executing = false;
  }
};

function matchesConditions(
  conditions: Record<string, unknown>,
  record: Record<string, unknown>,
  previousData?: Record<string, unknown>,
): boolean {
  if (!conditions || Object.keys(conditions).length === 0) return true;

  return Object.entries(conditions).every(([key, expected]) => {
    const current = record[key];
    // For status_changed, ensure the value actually changed
    if (key === "status" && previousData) {
      return current === expected && previousData[key] !== expected;
    }
    return current === expected;
  });
}

async function executeWorkflow(
  dataProvider: DataProvider,
  { workflow, record }: WorkflowMatch,
) {
  const actions = workflow.actions ?? [];
  const results: Record<string, unknown>[] = [];

  try {
    for (const action of actions) {
      const result = await executeAction(
        dataProvider,
        action,
        record,
        workflow.trigger_resource,
      );
      results.push(result);
    }

    // Log success
    await logExecution(dataProvider, {
      workflow_id: workflow.id,
      trigger_resource: workflow.trigger_resource,
      trigger_record_id: String(record.id ?? ""),
      trigger_event: workflow.trigger_event,
      execution_status: "completed",
      execution_result: { actions: results },
    });
  } catch (err) {
    // Log failure
    await logExecution(dataProvider, {
      workflow_id: workflow.id,
      trigger_resource: workflow.trigger_resource,
      trigger_record_id: String(record.id ?? ""),
      trigger_event: workflow.trigger_event,
      execution_status: "failed",
      error_message: err instanceof Error ? err.message : String(err),
    }).catch(() => {
      /* swallow logging errors */
    });
  }
}

async function executeAction(
  dataProvider: DataProvider,
  action: WorkflowAction,
  triggerRecord: Record<string, unknown>,
  triggerResource: string,
): Promise<Record<string, unknown>> {
  switch (action.type) {
    case "create_task":
      return createTask(dataProvider, action.data, triggerRecord);
    case "create_project":
      return createProject(dataProvider, action.data, triggerRecord);
    case "update_field":
      return updateField(dataProvider, action.data, triggerRecord);
    case "send_email":
      return sendEmail(dataProvider, action.data, triggerRecord, triggerResource);
    case "send_notification":
      return sendNotification(
        dataProvider,
        action.data,
        triggerRecord,
        triggerResource,
      );
    default:
      return { skipped: true, reason: `Unknown action type: ${action.type}` };
  }
}

async function createTask(
  dataProvider: DataProvider,
  actionData: Record<string, unknown>,
  triggerRecord: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const dueDays = Number(actionData.due_days ?? 3);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDays);

  const clientId =
    triggerRecord.client_id ?? (triggerRecord as any).client_id ?? null;

  const { data } = await dataProvider.create("client_tasks", {
    data: {
      text: String(actionData.text ?? "Task automatico"),
      due_date: dueDate.toISOString().split("T")[0],
      done_date: null,
      type: "follow_up",
      client_id: clientId,
    },
  });

  return { created: "client_tasks", id: data.id };
}

async function createProject(
  dataProvider: DataProvider,
  actionData: Record<string, unknown>,
  triggerRecord: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const projectData: Record<string, unknown> = {
    name: triggerRecord.description
      ? String(triggerRecord.description)
      : `Progetto da preventivo`,
    client_id: triggerRecord.client_id,
    status: "in_corso",
    category: triggerRecord.service_type ?? "altro",
    budget: triggerRecord.amount ?? null,
    start_date: new Date().toISOString().split("T")[0],
  };

  // Copy event dates from quote if available
  if (triggerRecord.event_start) {
    projectData.start_date = triggerRecord.event_start;
  }
  if (triggerRecord.event_end) {
    projectData.end_date = triggerRecord.event_end;
  }

  const { data } = await dataProvider.create("projects", {
    data: projectData,
  });

  // Link quote to project if we can
  if (triggerRecord.id) {
    await dataProvider
      .update("quotes", {
        id: triggerRecord.id as Identifier,
        data: { project_id: data.id },
        previousData: triggerRecord,
      })
      .catch(() => {
        /* best effort linking */
      });
  }

  return { created: "projects", id: data.id };
}

async function updateField(
  _dataProvider: DataProvider,
  actionData: Record<string, unknown>,
  triggerRecord: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // This is a no-op placeholder — field updates on the trigger record itself
  // would require knowing the resource, which is available in the workflow.
  // For now we just return info about what would be updated.
  return {
    would_update: {
      field: actionData.field,
      value: actionData.value,
      on_record: triggerRecord.id,
    },
  };
}

async function sendEmail(
  dataProvider: DataProvider,
  actionData: Record<string, unknown>,
  triggerRecord: Record<string, unknown>,
  triggerResource: string,
): Promise<Record<string, unknown>> {
  const crm = dataProvider as unknown as CrmDataProvider;
  const result = await crm.executeWorkflowNotify({
    channel: "email_external",
    recipient_type:
      (actionData.recipient_type as "client_email" | "custom") ??
      "client_email",
    custom_email: actionData.custom_email
      ? String(actionData.custom_email)
      : undefined,
    subject: String(actionData.subject ?? ""),
    body: String(actionData.body ?? ""),
    trigger_resource: triggerResource,
    trigger_record_id: String(triggerRecord.id ?? ""),
  });
  return { sent: "email", ...result };
}

async function sendNotification(
  dataProvider: DataProvider,
  actionData: Record<string, unknown>,
  triggerRecord: Record<string, unknown>,
  triggerResource: string,
): Promise<Record<string, unknown>> {
  const crm = dataProvider as unknown as CrmDataProvider;
  const result = await crm.executeWorkflowNotify({
    channel: "notify_owner",
    message: String(actionData.message ?? ""),
    trigger_resource: triggerResource,
    trigger_record_id: String(triggerRecord.id ?? ""),
  });
  return { sent: "notification", ...result };
}

async function logExecution(
  dataProvider: DataProvider,
  data: {
    workflow_id: Identifier;
    trigger_resource: string;
    trigger_record_id: string;
    trigger_event: string;
    execution_status: string;
    execution_result?: Record<string, unknown>;
    error_message?: string;
  },
) {
  await dataProvider.create("workflow_executions", { data });
}
