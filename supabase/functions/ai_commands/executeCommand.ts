import {
  validatePayload,
  type AiCommandType,
  type CreateLukeTaskPayload,
} from "./validatePayload.ts";

export type AiCommandRecord = {
  id: number;
  command_type: string;
  payload: Record<string, unknown>;
};

export type ExecuteResult = {
  task_id: number;
  assigned_to_user_id: number;
  warnings?: string[];
};

type QueryResult<T> = Promise<{ data: T | null; error: Error | null }>;

type QueryBuilder<T> = {
  select(columns?: string): QueryBuilder<T>;
  eq(column: string, value: unknown): QueryBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T>;
  limit(count: number): QueryResult<T[]>;
  insert(value: Record<string, unknown>): {
    select(columns?: string): {
      single(): QueryResult<T>;
    };
  };
};

export type SupabaseLike = {
  from<T = Record<string, unknown>>(table: string): QueryBuilder<T>;
};

type Sale = {
  id: number;
  role?: string;
  disabled?: boolean;
};

type TaskInsertResult = {
  id: number;
};

export async function executeCommand(
  supabase: SupabaseLike,
  command: AiCommandRecord,
): Promise<ExecuteResult> {
  if (command.command_type !== ("create_luke_task" satisfies AiCommandType)) {
    throw new Error(`Unsupported command_type: ${command.command_type}`);
  }

  return createLukeTask(supabase, command);
}

async function createLukeTask(
  supabase: SupabaseLike,
  command: AiCommandRecord,
): Promise<ExecuteResult> {
  const payload: CreateLukeTaskPayload = validatePayload(
    command.command_type,
    command.payload,
  );

  const { data: leadResearchers, error: salesError } = await supabase
    .from<Sale>("sales")
    .select("id, role, disabled")
    .eq("role", "lead_researcher")
    .eq("disabled", false)
    .order("id", { ascending: true })
    .limit(2);

  if (salesError) {
    throw salesError;
  }

  if (!leadResearchers?.length) {
    throw new Error("No lead_researcher user found. Create Luke first.");
  }

  const luke = leadResearchers[0];
  const warnings =
    leadResearchers.length > 1
      ? [
          "More than one active lead_researcher exists; assigned to the first by id.",
        ]
      : undefined;

  const { data: task, error: taskError } = await supabase
    .from<TaskInsertResult>("tasks")
    .insert({
      contact_id: payload.contact_id,
      title: payload.title,
      text: payload.text,
      type: payload.type,
      due_date: payload.due_date ?? null,
      sales_id: luke.id,
      source: "ai_command",
      source_command_id: command.id,
      priority: payload.priority,
      success_definition: payload.success_definition ?? null,
      linked_entity_type: "contact",
      linked_entity_id: payload.contact_id,
    })
    .select("id")
    .single();

  if (taskError) {
    throw taskError;
  }

  if (!task) {
    throw new Error("Task creation failed");
  }

  return {
    task_id: task.id,
    assigned_to_user_id: luke.id,
    warnings,
  };
}
