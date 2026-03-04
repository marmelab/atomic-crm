export const triggerResourceLabels: Record<string, string> = {
  projects: "Progetti",
  quotes: "Preventivi",
  payments: "Pagamenti",
  client_tasks: "Promemoria",
};

export const triggerEventLabels: Record<string, string> = {
  created: "Creato",
  updated: "Modificato",
  status_changed: "Cambio stato",
};

export const actionTypeLabels: Record<string, string> = {
  create_task: "Crea promemoria",
  create_project: "Crea progetto",
  update_field: "Aggiorna campo",
};

// Choices for SelectInput components
export const triggerResourceChoices = Object.entries(triggerResourceLabels).map(
  ([value, label]) => ({ value, label }),
);

export const triggerEventChoices = Object.entries(triggerEventLabels).map(
  ([value, label]) => ({ value, label }),
);

export const actionTypeChoices = Object.entries(actionTypeLabels).map(
  ([value, label]) => ({ value, label }),
);

/** Human-readable workflow description */
export const describeWorkflow = (
  triggerResource: string,
  triggerEvent: string,
  conditions: Record<string, unknown>,
  actions: { type: string; data?: Record<string, unknown> }[],
): string => {
  const resource = triggerResourceLabels[triggerResource] || triggerResource;
  const event = triggerEventLabels[triggerEvent] || triggerEvent;

  let conditionStr = "";
  if (conditions && Object.keys(conditions).length > 0) {
    const conds = Object.entries(conditions)
      .map(([key, value]) => `${key} = ${value}`)
      .join(" e ");
    conditionStr = ` (quando ${conds})`;
  }

  const actionStr = actions
    .map((a) => actionTypeLabels[a.type] || a.type)
    .join(", ");

  return `Quando ${resource} ${event.toLowerCase()}${conditionStr} → ${actionStr}`;
};
