import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { executeCommand } from "./executeCommand.ts";
import {
  isAiSource,
  isCommandType,
  validatePayload,
} from "./validatePayload.ts";

type CurrentUserSale = {
  id: number;
  role?: string;
  administrator?: boolean;
};

type AiCommandRecord = {
  id: number;
  source_ai: string;
  command_type: string;
  payload: Record<string, unknown>;
  status: string;
  expires_at: string;
};

const ok = (payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const getRole = (sale: CurrentUserSale | null) =>
  sale?.administrator ? "admin" : sale?.role;

const requireAdmin = (sale: CurrentUserSale | null) => {
  if (getRole(sale) !== "admin") {
    throw new Error("Not Authorized");
  }
};

const audit = async (
  action: string,
  commandId: number | null,
  metadata: Record<string, unknown> = {},
) => {
  const { error } = await supabaseAdmin.from("ai_audit_events").insert({
    command_id: commandId,
    action,
    metadata,
  });

  if (error) {
    throw error;
  }
};

const hashCommand = async (value: unknown) => {
  const input = JSON.stringify(value);
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const getPendingCountToday = async (sourceAi: string) => {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabaseAdmin
    .from("ai_commands")
    .select("id", { count: "exact", head: true })
    .eq("source_ai", sourceAi)
    .eq("status", "pending")
    .gte("created_at", startOfDay.toISOString());

  if (error) {
    throw error;
  }

  return count ?? 0;
};

const createCommand = async (
  body: Record<string, unknown>,
  currentUserSale: CurrentUserSale | null,
) => {
  const sourceAi = body.source_ai;
  const commandType = body.command_type;

  if (!isAiSource(sourceAi)) {
    return createErrorResponse(400, "Invalid source_ai");
  }

  if (!isCommandType(commandType)) {
    return createErrorResponse(400, "Unsupported command_type");
  }

  let payload: ReturnType<typeof validatePayload>;
  try {
    payload = validatePayload(commandType, body.payload ?? {});
  } catch (error) {
    return createErrorResponse(400, (error as Error).message);
  }

  const pendingCount = await getPendingCountToday(sourceAi);
  if (pendingCount >= 100) {
    return createErrorResponse(429, "Too many pending commands today");
  }

  const idempotencyKey =
    typeof body.idempotency_key === "string" && body.idempotency_key.trim()
      ? body.idempotency_key.trim()
      : undefined;

  if (idempotencyKey) {
    const { data: existing, error } = await supabaseAdmin
      .from("ai_commands")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (existing) {
      return ok({ data: existing });
    }
  }

  const commandHash = await hashCommand({
    source_ai: sourceAi,
    command_type: commandType,
    payload,
  });

  const { data, error } = await supabaseAdmin
    .from("ai_commands")
    .insert({
      idempotency_key: idempotencyKey,
      command_hash: commandHash,
      source_ai: sourceAi,
      command_type: commandType,
      target_entity_type:
        typeof body.target_entity_type === "string"
          ? body.target_entity_type
          : "task",
      target_entity_id:
        typeof body.target_entity_id === "number"
          ? body.target_entity_id
          : null,
      payload,
      status: "pending",
      requires_approval: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create command");
  }

  await audit("command_created", data.id, {
    source_ai: sourceAi,
    command_type: commandType,
    created_by_user_id: currentUserSale?.id ?? null,
  });

  return ok({ data });
};

const approveCommand = async (
  body: Record<string, unknown>,
  currentUserSale: CurrentUserSale | null,
) => {
  try {
    requireAdmin(currentUserSale);
  } catch {
    return createErrorResponse(403, "Not Authorized");
  }

  const commandId = body.commandId;
  if (typeof commandId !== "number") {
    return createErrorResponse(400, "commandId is required");
  }

  const { data: command, error } = await supabaseAdmin
    .from("ai_commands")
    .select("*")
    .eq("id", commandId)
    .single<AiCommandRecord>();

  if (error || !command) {
    return createErrorResponse(404, "Command not found");
  }

  if (command.status !== "pending") {
    return createErrorResponse(409, "Only pending commands can be approved");
  }

  if (new Date(command.expires_at).getTime() < Date.now()) {
    await supabaseAdmin
      .from("ai_commands")
      .update({ status: "expired" })
      .eq("id", command.id);
    await audit("command_expired", command.id);
    return createErrorResponse(409, "Command expired");
  }

  const approvedAt = new Date().toISOString();
  const { data: approvedCommand, error: approveError } = await supabaseAdmin
    .from("ai_commands")
    .update({
      status: "approved",
      approved_by_user_id: currentUserSale?.id,
      approved_at: approvedAt,
    })
    .eq("id", command.id)
    .select("*")
    .single<AiCommandRecord>();

  if (approveError || !approvedCommand) {
    throw approveError ?? new Error("Failed to approve command");
  }

  await audit("command_approved", command.id, {
    approved_by_user_id: currentUserSale?.id,
  });

  await supabaseAdmin
    .from("ai_commands")
    .update({ status: "executing" })
    .eq("id", command.id);
  await audit("command_execution_started", command.id);

  try {
    const result = await executeCommand(supabaseAdmin, approvedCommand);
    const executedAt = new Date().toISOString();
    const { data: completedCommand, error: completedError } =
      await supabaseAdmin
        .from("ai_commands")
        .update({
          status: "completed",
          executed_at: executedAt,
          execution_result: result,
          error_message: null,
        })
        .eq("id", command.id)
        .select("*")
        .single();

    if (completedError || !completedCommand) {
      throw completedError ?? new Error("Failed to complete command");
    }

    await audit("command_completed", command.id, result);
    return ok({ data: completedCommand });
  } catch (executionError) {
    const message = (executionError as Error).message;
    const { data: failedCommand } = await supabaseAdmin
      .from("ai_commands")
      .update({
        status: "failed",
        executed_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", command.id)
      .select("*")
      .single();

    await audit("command_failed", command.id, { error_message: message });
    return ok({ data: failedCommand });
  }
};

const rejectCommand = async (
  body: Record<string, unknown>,
  currentUserSale: CurrentUserSale | null,
) => {
  try {
    requireAdmin(currentUserSale);
  } catch {
    return createErrorResponse(403, "Not Authorized");
  }

  const commandId = body.commandId;
  if (typeof commandId !== "number") {
    return createErrorResponse(400, "commandId is required");
  }

  const reason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : "Rejected by admin";

  const { data: command, error: commandError } = await supabaseAdmin
    .from("ai_commands")
    .select("*")
    .eq("id", commandId)
    .single<AiCommandRecord>();

  if (commandError || !command) {
    return createErrorResponse(404, "Command not found");
  }

  if (command.status !== "pending") {
    return createErrorResponse(409, "Only pending commands can be rejected");
  }

  const { data, error } = await supabaseAdmin
    .from("ai_commands")
    .update({ status: "rejected", error_message: reason })
    .eq("id", commandId)
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to reject command");
  }

  await audit("command_rejected", commandId, {
    rejected_by_user_id: currentUserSale?.id,
    reason,
  });

  return ok({ data });
};

async function handle(req: Request, currentUserSale: CurrentUserSale | null) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return createErrorResponse(400, "Invalid JSON body");
  }

  switch (body.action) {
    case "create":
      return createCommand(body, currentUserSale);
    case "approve":
      return approveCommand(body, currentUserSale);
    case "reject":
      return rejectCommand(body, currentUserSale);
    default:
      return createErrorResponse(400, "Unknown action");
  }
}

Deno.serve((req: Request) =>
  OptionsMiddleware(req, (req) =>
    AuthMiddleware(req, (req) =>
      UserMiddleware(req, async (req, user) => {
        if (req.method !== "POST") {
          return Promise.resolve(
            createErrorResponse(405, "Method Not Allowed"),
          );
        }

        const currentUserSale = user ? await getUserSale(user) : null;
        return handle(req, currentUserSale);
      }),
    ),
  ),
);
