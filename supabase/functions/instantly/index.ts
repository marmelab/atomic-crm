import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { mapLead, type CrmContactInput } from "./mapLead.ts";
import { getUserSale } from "../_shared/getUserSale.ts";

const API_BASE = "https://api.instantly.ai/api/v2";

const authHeaders = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
});

const ok = (payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

async function listCampaigns(apiKey: string): Promise<Response> {
  const res = await fetch(`${API_BASE}/campaigns`, {
    headers: authHeaders(apiKey),
  });
  if (!res.ok) {
    return createErrorResponse(
      res.status,
      "Failed to list Instantly campaigns",
    );
  }
  const json = await res.json();
  // Instantly returns { items: [...] }; tolerate an array or { data } too.
  const raw = Array.isArray(json) ? json : (json.items ?? json.data ?? []);
  const campaigns = raw.map((c: { id: string; name: string }) => ({
    id: c.id,
    name: c.name,
  }));
  return ok({ data: campaigns });
}

async function pushLeads(
  apiKey: string,
  body: { campaignId?: string; contacts?: CrmContactInput[] },
): Promise<Response> {
  if (!body.campaignId) {
    return createErrorResponse(400, "campaignId is required");
  }

  const leads = (Array.isArray(body.contacts) ? body.contacts : [])
    .map((contact) => mapLead(contact))
    .filter((lead): lead is NonNullable<typeof lead> => lead !== null);

  if (leads.length === 0) {
    return createErrorResponse(400, "No selected contacts have a usable email");
  }

  const res = await fetch(`${API_BASE}/leads/add`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({ campaign_id: body.campaignId, leads }),
  });
  if (!res.ok) {
    const detail = await res.text();
    return createErrorResponse(
      res.status,
      `Failed to add leads: ${detail.slice(0, 200)}`,
    );
  }
  const result = await res.json().catch(() => ({}));
  return ok({ data: { pushed: leads.length, result } });
}

async function handle(req: Request, currentUserSale: any): Promise<Response> {
  const apiKey = Deno.env.get("INSTANTLY_API_KEY");
  if (!apiKey) {
    return createErrorResponse(500, "Instantly is not configured");
  }

  const role = currentUserSale?.administrator ? "admin" : currentUserSale?.role;
  if (!["admin", "sales_manager"].includes(role)) {
    return createErrorResponse(403, "Not Authorized");
  }

  let body: {
    action?: string;
    campaignId?: string;
    contacts?: CrmContactInput[];
  };
  try {
    body = await req.json();
  } catch {
    return createErrorResponse(400, "Invalid JSON body");
  }

  switch (body?.action) {
    case "listCampaigns":
      return listCampaigns(apiKey);
    case "pushLeads":
      return pushLeads(apiKey, body);
    default:
      return createErrorResponse(400, "Unknown action");
  }
}

Deno.serve((req: Request) =>
  OptionsMiddleware(req, (req) =>
    AuthMiddleware(req, (req) =>
      UserMiddleware(req, async (req, user) => {
        if (req.method === "POST") {
          const currentUserSale = user ? await getUserSale(user) : null;
          return handle(req, currentUserSale);
        }
        return Promise.resolve(createErrorResponse(405, "Method Not Allowed"));
      }),
    ),
  ),
);
