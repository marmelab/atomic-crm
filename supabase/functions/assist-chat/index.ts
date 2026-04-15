import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { type User } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { createErrorResponse } from "../_shared/utils.ts";

/**
 * Thin proxy that forwards a chat turn to the n8n `Nosho Assist Inbox`
 * workflow. The workflow owns the conversation (Mistral AI Agent + memory
 * keyed on sessionId), so this function only validates auth, enriches the
 * payload with the authenticated user identity, and relays the response.
 */

type Draft = {
  type: "bug" | "feature" | "question";
  title: string;
  summary: string;
  ready: true;
};

type RequestBody = {
  sessionId?: string;
  message?: string;
  context?: {
    currentRoute?: string;
  };
};

type N8nChatResponse = {
  reply: string;
  draft: Draft | null;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handler(req: Request, user?: User): Promise<Response> {
  if (req.method !== "POST") {
    return createErrorResponse(405, "Method Not Allowed");
  }

  const webhookUrl = Deno.env.get("N8N_WEBHOOK_URL");
  if (!webhookUrl) {
    console.error("[assist-chat] N8N_WEBHOOK_URL secret is not set");
    return jsonResponse(500, { error: "N8N_WEBHOOK_URL not configured" });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch (e) {
    console.error("[assist-chat] Invalid JSON body:", e);
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!sessionId || !message) {
    return jsonResponse(400, { error: "sessionId and message are required" });
  }

  // Resolve a human-readable author name from the sales table.
  let authorName = user?.email ?? "Unknown";
  let authorEmail = user?.email ?? "";
  if (user) {
    try {
      const sale = await getUserSale(user);
      if (sale) {
        const first = (sale as { first_name?: string }).first_name ?? "";
        const last = (sale as { last_name?: string }).last_name ?? "";
        const composed = `${first} ${last}`.trim();
        if (composed) authorName = composed;
        const saleEmail = (sale as { email?: string }).email;
        if (saleEmail) authorEmail = saleEmail;
      }
    } catch (e) {
      console.warn("[assist-chat] getUserSale failed:", e);
    }
  }

  const payload = {
    mode: "chat",
    sessionId,
    message: message.slice(0, 4000),
    author: {
      name: authorName,
      email: authorEmail,
      userId: user?.id ?? null,
    },
    context: {
      currentRoute: body.context?.currentRoute ?? "",
    },
    source: "nosho-crm",
    submittedAt: new Date().toISOString(),
  };

  let webhookRes: Response;
  try {
    webhookRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("[assist-chat] webhook fetch failed:", e);
    return jsonResponse(502, { error: "Failed to reach n8n webhook" });
  }

  if (!webhookRes.ok) {
    const text = await webhookRes.text();
    console.error(`[assist-chat] n8n webhook ${webhookRes.status}: ${text}`);
    return jsonResponse(502, {
      error: `n8n webhook error ${webhookRes.status}`,
      detail: text.slice(0, 500),
    });
  }

  let data: N8nChatResponse;
  try {
    data = (await webhookRes.json()) as N8nChatResponse;
  } catch (e) {
    console.error("[assist-chat] failed to parse n8n response:", e);
    return jsonResponse(502, { error: "Invalid response from n8n" });
  }

  console.log(
    `[assist-chat] ${authorName} (${sessionId}) — reply ${data?.reply?.length ?? 0} chars, draft=${data?.draft ? "yes" : "no"}`,
  );

  return jsonResponse(200, {
    reply: data.reply ?? "",
    draft: data.draft ?? null,
  });
}

Deno.serve((req) =>
  OptionsMiddleware(req, (req) =>
    AuthMiddleware(req, (req) =>
      UserMiddleware(req, (req, user) => handler(req, user)),
    ),
  ),
);
