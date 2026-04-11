import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const INGEST_API_KEY = Deno.env.get("INGEST_API_KEY");

interface IngestIntakeLeadPayload {
  business_name: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  region?: string;
  trade_type?: string;
  enrichment_summary?: string;
  owner_name?: string;
  metadata?: Record<string, unknown>;
  idempotency_key?: string;
}

/** Escape ILIKE wildcards so the pattern matches literally. */
const escapeIlike = (val: string): string =>
  val.replace(/%/g, "\\%").replace(/_/g, "\\_");

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Best-effort log to integration_log. Never throws. */
const logEvent = async (
  source: string,
  action: string,
  entityType: string | null,
  entityId: string | null,
  payload: Record<string, unknown>,
  result: Record<string, unknown>,
  idempotencyKey?: string,
) => {
  try {
    await supabaseAdmin.from("integration_log").insert({
      source,
      action,
      entity_type: entityType,
      entity_id: entityId,
      payload,
      result,
      idempotency_key: idempotencyKey ?? null,
    });
  } catch {
    // Never let logging failures propagate
  }
};

const getOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-api-key",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  const apiKey = req.headers.get("x-api-key");
  if (!INGEST_API_KEY || apiKey !== INGEST_API_KEY) {
    await logEvent(
      "ingest-intake-lead",
      "auth_failed",
      null,
      null,
      {},
      { error: "invalid_api_key" },
    );
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    await logEvent(
      "ingest-intake-lead",
      "validation_failed",
      null,
      null,
      {},
      { error: "invalid_json" },
    );
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const body = rawBody as Record<string, unknown>;
  if (typeof body.business_name !== "string" || !body.business_name.trim()) {
    await logEvent(
      "ingest-intake-lead",
      "validation_failed",
      null,
      null,
      body,
      { error: "missing_business_name" },
    );
    return jsonResponse({ error: "business_name must be a non-empty string" }, 400);
  }

  const metadata =
    typeof body.metadata === "object" &&
      body.metadata !== null &&
      !Array.isArray(body.metadata)
      ? body.metadata as Record<string, unknown>
      : {};

  const payload: IngestIntakeLeadPayload = {
    business_name: body.business_name.trim(),
    email: getOptionalString(body.email)?.toLowerCase(),
    phone: getOptionalString(body.phone),
    website: getOptionalString(body.website),
    address: getOptionalString(body.address),
    city: getOptionalString(body.city),
    region: getOptionalString(body.region),
    trade_type: getOptionalString(body.trade_type),
    enrichment_summary: getOptionalString(body.enrichment_summary),
    owner_name: getOptionalString(body.owner_name),
    metadata,
    idempotency_key: getOptionalString(body.idempotency_key),
  };

  try {
    if (payload.idempotency_key) {
      const { data: existingLead, error: existingLeadErr } = await supabaseAdmin
        .from("intake_leads")
        .select("id")
        .eq("idempotency_key", payload.idempotency_key)
        .maybeSingle();

      if (existingLeadErr) {
        throw new Error(`idempotency lookup failed: ${existingLeadErr.message}`);
      }

      if (existingLead) {
        const resultPayload = { id: existingLead.id };
        await logEvent(
          "ingest-intake-lead",
          "ingest_deduplicated",
          "intake_lead",
          existingLead.id,
          payload as unknown as Record<string, unknown>,
          resultPayload,
          payload.idempotency_key,
        );
        return jsonResponse(resultPayload, 200);
      }
    }

    let tradeTypeId: string | null = null;
    if (payload.trade_type) {
      const { data: tradeType, error: tradeTypeErr } = await supabaseAdmin
        .from("trade_types")
        .select("id")
        .ilike("name", escapeIlike(payload.trade_type))
        .maybeSingle();

      if (tradeTypeErr) {
        throw new Error(`trade_types lookup failed: ${tradeTypeErr.message}`);
      }

      tradeTypeId = tradeType?.id ?? null;
    }

    // intake_leads currently has metadata jsonb but no owner_name column.
    const baseMetadata = payload.metadata ?? {};
    const leadMetadata = payload.owner_name
      ? { ...baseMetadata, owner_name: payload.owner_name }
      : baseMetadata;

    const { data: newLead, error: insertErr } = await supabaseAdmin
      .from("intake_leads")
      .insert({
        business_name: payload.business_name,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        website: payload.website ?? null,
        address: payload.address ?? null,
        city: payload.city ?? null,
        region: payload.region ?? null,
        trade_type_id: tradeTypeId,
        enrichment_summary: payload.enrichment_summary ?? null,
        metadata: leadMetadata,
        idempotency_key: payload.idempotency_key ?? null,
        source: "lead-engine",
        status: "uncontacted",
      })
      .select("id")
      .single();

    if (insertErr) {
      throw new Error(`intake_lead insert failed: ${insertErr.message}`);
    }

    const resultPayload = { id: newLead.id };

    await logEvent(
      "ingest-intake-lead",
      "ingest",
      "intake_lead",
      newLead.id,
      payload as unknown as Record<string, unknown>,
      resultPayload,
      payload.idempotency_key,
    );

    return jsonResponse(resultPayload, 201);
  } catch (err) {
    console.error("Intake lead ingestion failed:", err);

    await logEvent(
      "ingest-intake-lead",
      "ingest_failed",
      "intake_lead",
      null,
      payload as unknown as Record<string, unknown>,
      { error: String(err) },
      payload.idempotency_key,
    );

    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
