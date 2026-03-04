import type { WorkflowAction } from "../types";

/**
 * Transform form data (flat fields) into the workflow record shape
 * expected by the DB (trigger_conditions as JSONB, actions as JSONB array).
 */
export const workflowTransform = (data: Record<string, unknown>) => {
  // Parse trigger conditions
  let triggerConditions: Record<string, unknown> = {};
  try {
    const raw = String(data.trigger_conditions_json ?? "{}");
    triggerConditions = JSON.parse(raw);
  } catch {
    triggerConditions = {};
  }

  // Build actions array from flat form fields
  const actions: WorkflowAction[] = [];
  const actionType = String(data.action_type ?? "");

  if (actionType === "create_task") {
    actions.push({
      type: "create_task",
      data: {
        text: data.action_task_text ?? "Task automatico",
        due_days: Number(data.action_task_due_days ?? 3),
      },
    });
  } else if (actionType === "create_project") {
    actions.push({
      type: "create_project",
      data: { copy_from_quote: true },
    });
  } else if (actionType === "update_field") {
    actions.push({
      type: "update_field",
      data: {
        field: data.action_field_name ?? "",
        value: data.action_field_value ?? "",
      },
    });
  }

  // Return clean record for the DB
  return {
    name: data.name,
    description: data.description || null,
    is_active: data.is_active ?? true,
    trigger_resource: data.trigger_resource,
    trigger_event: data.trigger_event,
    trigger_conditions: triggerConditions,
    actions,
  };
};
