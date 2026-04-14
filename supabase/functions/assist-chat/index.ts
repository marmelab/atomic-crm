import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { AuthMiddleware } from "../_shared/authentication.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;

const SYSTEM_PROMPT = `Tu es Nosho AI Assist, un assistant intégré au CRM Nosho.
Tu aides Thomas (CEO), Benjamin (responsable des ventes), Denis et Julie à formuler
des demandes d'amélioration ou des bugs sans qu'ils aient à ouvrir GitHub eux-mêmes.

Ton style : chaleureux, concis, en français. Tutoiement.

Étape 1 — Comprendre. Pose 1 à 3 questions courtes maximum (idéalement 1 ou 2)
pour clarifier :
  - Est-ce un bug, une nouvelle idée, ou une question ?
  - Sur quelle vue / quel écran (contacts, opportunités, dashboard…) ?
  - Quel est l'impact concret pour le travail de l'utilisateur ?

Ne pose JAMAIS plus de 3 questions au total. Si l'utilisateur a déjà donné assez
d'info dès le premier message, passe directement à l'étape 2.

Étape 2 — Récapituler. Quand tu as compris, écris une ou deux phrases d'accusé
de réception en français, PUIS ajoute STRICTEMENT en fin de message un bloc :

\`\`\`json
{
  "type": "bug" | "feature" | "question",
  "title": "<titre court, moins de 70 caractères>",
  "summary": "<3 à 5 puces markdown décrivant la demande, le contexte et l'impact>",
  "ready": true
}
\`\`\`

Le champ "ready": true est OBLIGATOIRE pour déclencher l'envoi côté UI.
N'invente jamais de fonctionnalités déjà existantes. En cas de doute, demande.`;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type RequestBody = {
  messages?: ChatMessage[];
  context?: {
    currentRoute?: string;
  };
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handler(req: Request): Promise<Response> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.error("[assist-chat] ANTHROPIC_API_KEY secret is not set");
    return jsonResponse(500, { error: "ANTHROPIC_API_KEY not configured" });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch (e) {
    console.error("[assist-chat] Invalid JSON body:", e);
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return jsonResponse(400, { error: "messages array is required" });
  }

  // Sanitize messages — only keep role + content fields, cap content length.
  const sanitized = messages
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, 4000),
    }));

  const contextLine = body.context?.currentRoute
    ? `\n\n[Contexte UI: l'utilisateur est sur la route "${body.context.currentRoute}"]`
    : "";

  const anthropicBody = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT + contextLine,
        // Cache the system prompt — saves tokens on every follow-up turn.
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: sanitized,
  };

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(anthropicBody),
    });
  } catch (e) {
    console.error("[assist-chat] fetch failed:", e);
    return jsonResponse(502, { error: "Failed to reach Anthropic API" });
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`[assist-chat] Anthropic ${res.status}: ${text}`);
    return jsonResponse(res.status, {
      error: `Anthropic error ${res.status}`,
      detail: text,
    });
  }

  const data = await res.json();
  const reply: string =
    Array.isArray(data?.content) && data.content[0]?.type === "text"
      ? data.content[0].text
      : "";

  if (!reply) {
    console.warn("[assist-chat] empty reply from Anthropic", data);
    return jsonResponse(502, { error: "Empty reply from Anthropic" });
  }

  console.log(
    `[assist-chat] turn ok — ${sanitized.length} msgs in, ${reply.length} chars out`,
  );

  return jsonResponse(200, { reply });
}

Deno.serve((req) =>
  OptionsMiddleware(req, (req) => AuthMiddleware(req, handler)),
);
