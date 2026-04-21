import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type User } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import {
  AuthMiddleware,
  UserMiddleware,
  getAuthToken,
} from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { buildProposalPayload } from "./buildPayload.ts";

const NOSHO_API_URL =
  "https://nosho-doc-generator.nosho-ai.workers.dev/api/proposals";
const NOSHO_TIMEOUT_MS = 15000;

type RequestBody = {
  dealId?: number;
  contactId?: number | null;
  force?: boolean;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handler(req: Request, user: User): Promise<Response> {
  if (req.method !== "POST") {
    return createErrorResponse(405, "Method Not Allowed");
  }

  const apiKey = Deno.env.get("NOSHO_API_KEY");
  if (!apiKey) {
    console.error("[generate-proposal] NOSHO_API_KEY secret is not set");
    return jsonResponse(500, { error: "internal_error" });
  }

  const token = getAuthToken(req);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("SB_PUBLISHABLE_KEY") ??
      "",
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const dealId = Number(body.dealId);
  if (!Number.isInteger(dealId) || dealId <= 0) {
    return jsonResponse(400, { error: "invalid_deal_id" });
  }
  const force = body.force === true;
  const requestedContactId =
    body.contactId == null ? null : Number(body.contactId);

  // 1. Fetch deal (RLS-filtered via user JWT)
  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .select(
      "id, company_id, contact_ids, sales_id, proposal_edit_url, proposal_public_url",
    )
    .eq("id", dealId)
    .maybeSingle();
  if (dealError) {
    console.error("[generate-proposal] deal fetch error:", dealError);
    return jsonResponse(500, { error: "internal_error" });
  }
  if (!deal) return jsonResponse(404, { error: "deal_not_found" });

  // 2. Idempotence
  if (deal.proposal_public_url && !force) {
    return jsonResponse(409, {
      error: "proposal_already_exists",
      editUrl: deal.proposal_edit_url,
      publicUrl: deal.proposal_public_url,
    });
  }

  if (!deal.company_id) {
    return jsonResponse(400, { error: "deal_has_no_company" });
  }

  // 3. Fetch company
  const { data: company } = await supabase
    .from("companies")
    .select("name, sector")
    .eq("id", deal.company_id)
    .maybeSingle();
  if (!company) return jsonResponse(404, { error: "company_not_found" });

  // 4. Resolve contact
  const contactIds = Array.isArray(deal.contact_ids) ? deal.contact_ids : [];
  let useContactId: number | null = null;
  if (requestedContactId !== null) {
    if (!contactIds.includes(requestedContactId)) {
      return jsonResponse(400, { error: "contact_not_in_deal" });
    }
    useContactId = requestedContactId;
  } else if (contactIds.length > 0) {
    useContactId = contactIds[0];
  }

  let contact: { first_name: string | null; last_name: string | null } | null =
    null;
  if (useContactId !== null) {
    const { data: c, error: contactError } = await supabase
      .from("contacts")
      .select("first_name, last_name")
      .eq("id", useContactId)
      .maybeSingle();
    if (contactError) {
      console.error("[generate-proposal] contact fetch error:", contactError);
      return jsonResponse(500, { error: "internal_error" });
    }
    if (c) contact = c;
  }

  // 5. Sales owner
  let sales: { first_name: string | null; last_name: string | null } | null =
    null;
  if (deal.sales_id) {
    const { data: s, error: salesError } = await supabase
      .from("sales")
      .select("first_name, last_name")
      .eq("id", deal.sales_id)
      .maybeSingle();
    if (salesError) {
      console.error("[generate-proposal] sales fetch error:", salesError);
      return jsonResponse(500, { error: "internal_error" });
    }
    if (s) sales = s;
  }

  // 6. Build payload
  const payload = buildProposalPayload({
    deal: {
      id: deal.id,
      sales_id: deal.sales_id,
      contact_ids: deal.contact_ids,
    },
    company,
    contact,
    sales,
    now: new Date(),
  });

  // 7. POST Nosho API
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), NOSHO_TIMEOUT_MS);
  let noshoRes: Response;
  try {
    noshoRes = await fetch(NOSHO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if ((e as Error).name === "AbortError") {
      return jsonResponse(504, { error: "nosho_timeout" });
    }
    console.error("[generate-proposal] nosho fetch failed:", e);
    return jsonResponse(502, { error: "nosho_unreachable" });
  }
  clearTimeout(timer);

  if (noshoRes.status === 401) {
    return jsonResponse(502, { error: "nosho_api_key_invalid" });
  }
  if (noshoRes.status === 400) {
    const detail = await noshoRes.json().catch(() => ({}));
    return jsonResponse(400, {
      error: "invalid_payload",
      issues: detail?.issues ?? [],
    });
  }
  if (!noshoRes.ok) {
    const text = await noshoRes.text();
    console.error(`[generate-proposal] nosho ${noshoRes.status}: ${text}`);
    return jsonResponse(502, { error: "nosho_error" });
  }

  const noshoData = (await noshoRes.json()) as {
    editUrl?: string;
    publicUrl?: string;
    id?: string;
  };
  if (!noshoData.editUrl || !noshoData.publicUrl) {
    return jsonResponse(502, { error: "nosho_invalid_response" });
  }

  // 8. Write URLs back
  const { error: updateErr } = await supabase
    .from("deals")
    .update({
      proposal_edit_url: noshoData.editUrl,
      proposal_public_url: noshoData.publicUrl,
    })
    .eq("id", dealId);
  if (updateErr) {
    console.error("[generate-proposal] update failed:", updateErr);
    return jsonResponse(500, { error: "internal_error" });
  }

  // Log only non-sensitive fields
  console.log(
    `[generate-proposal] user=${user.id} dealId=${dealId} proposalId=${noshoData.id ?? "?"}`,
  );

  return jsonResponse(200, {
    editUrl: noshoData.editUrl,
    publicUrl: noshoData.publicUrl,
  });
}

Deno.serve((req) =>
  OptionsMiddleware(req, (req) =>
    AuthMiddleware(req, (req) =>
      UserMiddleware(req, (req, user) => handler(req, user!)),
    ),
  ),
);
