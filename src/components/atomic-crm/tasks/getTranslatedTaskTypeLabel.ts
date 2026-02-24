type TranslateFn = (key: string, options?: { [key: string]: any }) => string;

const defaultTaskTypeLabels: Record<string, string> = {
  none: "None",
  email: "Email",
  demo: "Demo",
  lunch: "Lunch",
  meeting: "Meeting",
  "follow-up": "Follow-up",
  "thank-you": "Thank you",
  ship: "Ship",
  call: "Call",
};

const getTaskTypeTranslationKey = (taskTypeValue: string) =>
  `crm.tasks.types.${taskTypeValue.replaceAll("-", "_")}`;

export const getTranslatedTaskTypeLabel = (
  taskType: { value: string; label: string },
  translate: TranslateFn,
) => {
  const defaultLabel = defaultTaskTypeLabels[taskType.value];
  if (!defaultLabel || taskType.label !== defaultLabel) {
    return taskType.label;
  }

  return translate(getTaskTypeTranslationKey(taskType.value), {
    _: taskType.label,
  });
};
