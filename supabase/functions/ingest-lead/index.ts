import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const INGEST_API_KEY = Deno.env.get("INGEST_API_KEY");

interface IngestLeadPayload {
  company_name: string;
  contact_first_name?: string;
  contact_last_name?: string;
  contact_email?: string;
  contact_phone?: string;
  trade_type?: string;
  lead_source?: string;
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-api-key",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  // Validate API key
  const apiKey = req.headers.get("x-api-key");
  if (!INGEST_API_KEY || apiKey !== INGEST_API_KEY) {
    await logEvent("ingest-lead", "auth_failed", null, null, {}, { error: "invalid_api_key" });
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    await logEvent("ingest-lead", "validation_failed", null, null, {}, { error: "invalid_json" });
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  // Runtime type validation
  const body = rawBody as Record<string, unknown>;
  if (typeof body.company_name !== "string" || !body.company_name.trim()) {
    await logEvent("ingest-lead", "validation_failed", null, null, body, { error: "missing_company_name" });
    return jsonResponse({ error: "company_name must be a non-empty string" }, 400);
  }

  const payload: IngestLeadPayload = {
    company_name: body.company_name.trim(),
    contact_first_name: typeof body.contact_first_name === "string" ? body.contact_first_name : undefined,
    contact_last_name: typeof body.contact_last_name === "string" ? body.contact_last_name : undefined,
    contact_email: typeof body.contact_email === "string" ? body.contact_email.trim().toLowerCase() : undefined,
    contact_phone: typeof body.contact_phone === "string" ? body.contact_phone.trim() : undefined,
    trade_type: typeof body.trade_type === "string" ? body.trade_type : undefined,
    lead_source: typeof body.lead_source === "string" ? body.lead_source : undefined,
    metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata as Record<string, unknown> : {},
    idempotency_key: typeof body.idempotency_key === "string" ? body.idempotency_key : undefined,
  };

  try {
    // Check idempotency: if key provided and already processed, return existing result
    if (payload.idempotency_key) {
      const { data: existing } = await supabaseAdmin
        .from("integration_log")
        .select("result")
        .eq("idempotency_key", payload.idempotency_key)
        .eq("source", "ingest-lead")
        .eq("action", "create_lead")
        .maybeSingle();
      if (existing?.result) {
        return jsonResponse(existing.result, 200);
      }
    }

    // 1. Resolve trade_type_id if provided
    let tradeTypeId: string | null = null;
    if (payload.trade_type) {
      const { data: tt, error: ttErr } = await supabaseAdmin
        .from("trade_types")
        .select("id")
        .ilike("name", escapeIlike(payload.trade_type))
        .maybeSingle();
      if (ttErr) throw new Error(`trade_types lookup failed: ${ttErr.message}`);
      tradeTypeId = tt?.id ?? null;
    }

    // 2. Resolve lead_source_id if provided
    let leadSourceId: string | null = null;
    if (payload.lead_source) {
      const { data: ls, error: lsErr } = await supabaseAdmin
        .from("lead_sources")
        .select("id")
        .ilike("name", escapeIlike(payload.lead_source))
        .maybeSingle();
      if (lsErr) throw new Error(`lead_sources lookup failed: ${lsErr.message}`);
      leadSourceId = ls?.id ?? null;
    }

    // 3. Upsert company (match on name, case-insensitive, wildcard-safe)
    const { data: existingCompany, error: companyLookupErr } = await supabaseAdmin
      .from("companies")
      .select("id")
      .ilike("name", escapeIlike(payload.company_name))
      .maybeSingle();
    if (companyLookupErr) throw new Error(`company lookup failed: ${companyLookupErr.message}`);

    let companyId: number;
    const companyExisted = !!existingCompany;
    if (existingCompany) {
      companyId = existingCompany.id;
    } else {
      const { data: newCompany, error: companyErr } = await supabaseAdmin
        .from("companies")
        .insert({
          name: payload.company_name,
          trade_type_id: tradeTypeId,
          external_source: "ingest-lead",
          metadata: payload.metadata,
        })
        .select("id")
        .single();
      if (companyErr) throw new Error(`company insert failed: ${companyErr.message}`);
      companyId = newCompany.id;
    }

    // 4. Create or find contact (deduplicate on email or phone within same company)
    let contactId: number | null = null;
    const hasContactInfo =
      payload.contact_first_name ||
      payload.contact_last_name ||
      payload.contact_email ||
      payload.contact_phone;

    if (hasContactInfo) {
      let existingContact = null;

      // Dedup by normalized email
      if (payload.contact_email) {
        const { data, error: emailErr } = await supabaseAdmin
          .from("contacts")
          .select("id")
          .eq("company_id", companyId)
          .contains("email_jsonb", [{ email: payload.contact_email }])
          .maybeSingle();
        if (emailErr) throw new Error(`contact email lookup failed: ${emailErr.message}`);
        existingContact = data;
      }

      // Dedup by phone if no email match
      if (!existingContact && payload.contact_phone) {
        const { data, error: phoneErr } = await supabaseAdmin
          .from("contacts")
          .select("id")
          .eq("company_id", companyId)
          .contains("phone_jsonb", [{ number: payload.contact_phone }])
          .maybeSingle();
        if (phoneErr) throw new Error(`contact phone lookup failed: ${phoneErr.message}`);
        existingContact = data;
      }

      if (existingContact) {
        contactId = existingContact.id;
        // Log dedup event per Architecture.md deduplication strategy
        await logEvent(
          "ingest-lead", "lead_deduplicated", "contact", String(existingContact.id),
          payload as unknown as Record<string, unknown>,
          { company_id: companyId, contact_id: existingContact.id, reason: "existing_contact" },
          payload.idempotency_key,
        );
      } else {
        const emailJsonb = payload.contact_email
          ? [{ email: payload.contact_email, type: "Work" }]
          : [];
        const phoneJsonb = payload.contact_phone
          ? [{ number: payload.contact_phone, type: "Work" }]
          : [];

        const { data: newContact, error: contactErr } = await supabaseAdmin
          .from("contacts")
          .insert({
            first_name: payload.contact_first_name ?? null,
            last_name: payload.contact_last_name ?? null,
            company_id: companyId,
            lead_source_id: leadSourceId,
            email_jsonb: emailJsonb,
            phone_jsonb: phoneJsonb,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            status: "cold",
            external_source: "ingest-lead",
            metadata: payload.metadata,
          })
          .select("id")
          .single();
        if (contactErr) throw new Error(`contact insert failed: ${contactErr.message}`);
        contactId = newContact.id;
      }
    }

    // 5. Create deal in "lead" stage
    const { data: newDeal, error: dealErr } = await supabaseAdmin
      .from("deals")
      .insert({
        name: `${payload.company_name} - Inbound Lead`,
        company_id: companyId,
        contact_ids: contactId ? [contactId] : [],
        stage: "lead",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: payload.metadata,
      })
      .select("id")
      .single();
    if (dealErr) throw new Error(`deal insert failed: ${dealErr.message}`);

    // Also write to deal_contacts join table if contact exists
    if (contactId) {
      const { error: dcErr } = await supabaseAdmin
        .from("deal_contacts")
        .insert({ deal_id: newDeal.id, contact_id: contactId });
      if (dcErr) throw new Error(`deal_contacts insert failed: ${dcErr.message}`);
    }

    // 6. Log success to integration_log
    const resultPayload = {
      company_id: companyId,
      contact_id: contactId,
      deal_id: newDeal.id,
      company_existed: companyExisted,
    };

    await logEvent(
      "ingest-lead", "create_lead", "deal", String(newDeal.id),
      payload as unknown as Record<string, unknown>,
      resultPayload,
      payload.idempotency_key,
    );

    return jsonResponse(resultPayload, 201);
  } catch (err) {
    console.error("Lead ingestion failed:", err);

    await logEvent(
      "ingest-lead", "create_lead", "deal", null,
      payload as unknown as Record<string, unknown>,
      { error: String(err) },
      payload.idempotency_key,
    );

    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
