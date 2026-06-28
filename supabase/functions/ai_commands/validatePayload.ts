export type AiSourceType =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "manual"
  | "system";
export type AiCommandType = "create_luke_task";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type CreateLukeTaskPayload = {
  title: string;
  text: string;
  contact_id: number;
  due_date?: string;
  priority: TaskPriority;
  success_definition?: string;
  type: string;
};

export const AI_SOURCES: AiSourceType[] = [
  "chatgpt",
  "claude",
  "gemini",
  "manual",
  "system",
];

export const COMMAND_TYPES: AiCommandType[] = ["create_luke_task"];
export const TASK_PRIORITIES: TaskPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
];

export const isAiSource = (source: unknown): source is AiSourceType =>
  typeof source === "string" && AI_SOURCES.includes(source as AiSourceType);

export const isCommandType = (type: unknown): type is AiCommandType =>
  typeof type === "string" && COMMAND_TYPES.includes(type as AiCommandType);

export function validatePayload(
  commandType: string,
  payload: unknown,
): CreateLukeTaskPayload {
  if (!isCommandType(commandType)) {
    throw new Error(`Unsupported command_type: ${commandType}`);
  }

  if (
    payload == null ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new Error("payload must be an object");
  }

  const raw = payload as Record<string, unknown>;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) {
    throw new Error("payload.title is required");
  }

  if (typeof raw.contact_id !== "number" || !Number.isFinite(raw.contact_id)) {
    throw new Error("payload.contact_id is required");
  }

  const priority =
    typeof raw.priority === "string" && raw.priority ? raw.priority : "medium";
  if (!TASK_PRIORITIES.includes(priority as TaskPriority)) {
    throw new Error("payload.priority must be low, medium, high, or urgent");
  }

  if (raw.due_date != null && typeof raw.due_date !== "string") {
    throw new Error("payload.due_date must be a string");
  }

  return {
    title,
    text:
      typeof raw.text === "string" && raw.text.trim() ? raw.text.trim() : title,
    contact_id: raw.contact_id,
    due_date: typeof raw.due_date === "string" ? raw.due_date : undefined,
    priority: priority as TaskPriority,
    success_definition:
      typeof raw.success_definition === "string"
        ? raw.success_definition.trim()
        : undefined,
    type:
      typeof raw.type === "string" && raw.type.trim()
        ? raw.type.trim()
        : "Research",
  };
}
