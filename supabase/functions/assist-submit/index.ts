import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { type User } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { createErrorResponse } from "../_shared/utils.ts";

type Draft = {
  type: "bug" | "feature" | "question";
  title: string;
  summary: string;
  ready: true;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type RequestBody = {
  draft?: Draft;
  sessionId?: string;
  currentRoute?: string;
  userAgent?: string;
  transcript?: ChatMessage[];
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidDraft(d: unknown): d is Draft {
  if (!d || typeof d !== "object") return false;
  const draft = d as Record<string, unknown>;
  return (
    (draft.type === "bug" ||
      draft.type === "feature" ||
      draft.type === "question") &&
    typeof draft.title === "string" &&
    draft.title.length > 0 &&
    typeof draft.summary === "string" &&
    draft.summary.length > 0 &&
    draft.ready === true
  );
}

async function handler(req: Request, user?: User): Promise<Response> {
  if (req.method !== "POST") {
    return createErrorResponse(405, "Method Not Allowed");
  }

  const webhookUrl = Deno.env.get("N8N_WEBHOOK_URL");
  if (!webhookUrl) {
    console.error("[assist-submit] N8N_WEBHOOK_URL secret is not set");
    return jsonResponse(500, { error: "N8N_WEBHOOK_URL not configured" });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch (e) {
    console.error("[assist-submit] Invalid JSON body:", e);
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  if (!isValidDraft(body.draft)) {
    return jsonResponse(400, { error: "Invalid or missing draft" });
  }

  // Look up the sale row to get the human-readable author name.
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
      console.warn("[assist-submit] getUserSale failed:", e);
    }
  }

  // Cap transcript size before forwarding so n8n doesn't choke on huge payloads.
  const transcript = Array.isArray(body.transcript)
    ? body.transcript.slice(-20).map((m) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content.slice(0, 4000) : "",
      }))
    : [];

  const payload = {
    mode: "submit",
    sessionId: body.sessionId ?? "",
    source: "nosho-crm",
    submittedAt: new Date().toISOString(),
    author: {
      name: authorName,
      email: authorEmail,
      userId: user?.id ?? null,
    },
    draft: body.draft,
    context: {
      currentRoute: body.currentRoute ?? "",
      userAgent: body.userAgent ?? "",
    },
    transcript,
  };

  let webhookRes: Response;
  try {
    webhookRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("[assist-submit] webhook fetch failed:", e);
    return jsonResponse(502, { error: "Failed to reach n8n webhook" });
  }

  if (!webhookRes.ok) {
    const text = await webhookRes.text();
    console.error(`[assist-submit] n8n webhook ${webhookRes.status}: ${text}`);
    return jsonResponse(502, {
      error: `n8n webhook error ${webhookRes.status}`,
      detail: text.slice(0, 500),
    });
  }

  // n8n may return JSON with the created issue URL — bubble it up if present.
  let issueUrl: string | undefined;
  try {
    const data = await webhookRes.json();
    if (data && typeof data === "object" && typeof data.issueUrl === "string") {
      issueUrl = data.issueUrl;
    }
  } catch {
    // ignore non-JSON responses
  }

  console.log(
    `[assist-submit] forwarded ${body.draft.type} from ${authorName}: "${body.draft.title}"`,
  );

  return jsonResponse(200, { ok: true, issueUrl });
}

Deno.serve((req) =>
  OptionsMiddleware(req, (req) =>
    AuthMiddleware(req, (req) =>
      UserMiddleware(req, (req, user) => handler(req, user)),
    ),
  ),
);
