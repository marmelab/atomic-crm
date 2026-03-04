import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nodemailer from "npm:nodemailer";

import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  validateWorkflowNotifyPayload,
  type WorkflowNotifyPayload,
} from "../_shared/workflowNotifyTypes.ts";
import { resolveTemplatePlaceholders } from "../_shared/workflowTemplatePlaceholders.ts";
import { notifyOwner } from "../_shared/internalNotifications.ts";

// ── SMTP config (same as payment_reminder_send) ──────────────────────

const smtpHost = Deno.env.get("SMTP_HOST") ?? "";
const smtpPort = Number(Deno.env.get("SMTP_PORT") ?? "587");
const smtpUser = Deno.env.get("SMTP_USER") ?? "";
const smtpPass = Deno.env.get("SMTP_PASS") ?? "";
const smtpFromName = Deno.env.get("SMTP_FROM_NAME") ?? "Rosario Furnari";

const isSmtpConfigured = () =>
  Boolean(
    smtpHost &&
      Number.isFinite(smtpPort) &&
      smtpPort > 0 &&
      smtpUser &&
      smtpPass,
  );

// ── Helpers ──────────────────────────────────────────────────────────

async function fetchTriggerContext(resource: string, recordId: string) {
  const { data: record } = await supabaseAdmin
    .from(resource)
    .select("*")
    .eq("id", recordId)
    .single();

  let client: Record<string, unknown> | null = null;
  const clientId = record?.client_id;
  if (clientId) {
    const { data } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();
    client = data;
  }

  return { record: record ?? {}, client };
}

// ── Handlers ─────────────────────────────────────────────────────────

async function handleEmailExternal(
  payload: WorkflowNotifyPayload,
  ctx: { record: Record<string, unknown>; client: Record<string, unknown> | null },
) {
  if (!isSmtpConfigured()) {
    return { channel: "email_external", ok: false, detail: { error: "SMTP not configured" } };
  }

  const templateCtx = {
    client: ctx.client,
    record: ctx.record,
    resource: payload.trigger_resource,
  };

  const subject = resolveTemplatePlaceholders(payload.subject ?? "", templateCtx);
  const body = resolveTemplatePlaceholders(payload.body ?? "", templateCtx);

  // Resolve recipient
  let to: string;
  if (payload.recipient_type === "custom" && payload.custom_email) {
    to = payload.custom_email.trim();
  } else {
    // Default: client email
    to = ctx.client ? String(ctx.client.email ?? "") : "";
  }

  if (!to) {
    return {
      channel: "email_external",
      ok: false,
      detail: { error: "No recipient email available" },
    };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const info = await transporter.sendMail({
    from: `${smtpFromName} <${smtpUser}>`,
    replyTo: smtpUser,
    to,
    subject,
    text: body,
    headers: { "X-Workflow-Notify": "true" },
  });

  return {
    channel: "email_external",
    ok: true,
    detail: {
      messageId: info.messageId,
      accepted: info.accepted?.map(String) ?? [],
      rejected: info.rejected?.map(String) ?? [],
    },
  };
}

async function handleNotifyOwner(
  payload: WorkflowNotifyPayload,
  ctx: { record: Record<string, unknown>; client: Record<string, unknown> | null },
) {
  const templateCtx = {
    client: ctx.client,
    record: ctx.record,
    resource: payload.trigger_resource,
  };

  const message = resolveTemplatePlaceholders(payload.message ?? "", templateCtx);
  const subject = `Automazione: ${message.slice(0, 80)}`;

  const result = await notifyOwner(subject, message);

  return {
    channel: "notify_owner",
    ok: result.email.ok || result.whatsapp.ok,
    detail: { email: result.email, whatsapp: result.whatsapp },
  };
}

// ── Main handler ─────────────────────────────────────────────────────

async function handleRequest(req: Request, currentUserSale: unknown) {
  if (!currentUserSale) {
    return createErrorResponse(401, "Unauthorized");
  }

  const payload = (await req.json()) as WorkflowNotifyPayload;
  const validationError = validateWorkflowNotifyPayload(payload);
  if (validationError) {
    return createErrorResponse(400, validationError);
  }

  try {
    const ctx = await fetchTriggerContext(
      payload.trigger_resource,
      payload.trigger_record_id,
    );

    let result;
    if (payload.channel === "email_external") {
      result = await handleEmailExternal(payload, ctx);
    } else {
      result = await handleNotifyOwner(payload, ctx);
    }

    return new Response(JSON.stringify({ data: result }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("workflow_notify.error", { error, payload });
    return createErrorResponse(500, "Errore nell'invio della notifica workflow");
  }
}

// ── Entry point ──────────────────────────────────────────────────────

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (request) =>
    AuthMiddleware(request, async (authedRequest) =>
      UserMiddleware(authedRequest, async (_, user) => {
        const currentUserSale = user ? await getUserSale(user) : null;
        if (!currentUserSale) {
          return createErrorResponse(401, "Unauthorized");
        }

        if (authedRequest.method === "POST") {
          return handleRequest(authedRequest, currentUserSale);
        }

        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
