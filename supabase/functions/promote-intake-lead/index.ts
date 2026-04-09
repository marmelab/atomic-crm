import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

interface PromoteIntakeLeadPayload {
  intake_lead_id: string;
  create_deal?: boolean;
}

interface IntakeLeadRow {
  id: string;
  business_name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  trade_type_id: string | null;
  status: string;
  promoted_contact_id: number | null;
  metadata: Record<string, unknown> | null;
}

/** Escape ILIKE wildcards so the pattern matches literally. */
const escapeIlike = (val: string): string =>
  val.replace(/%/g, "\\%").replace(/_/g, "\\_");

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });

/** Best-effort log to integration_log. Never throws. */
const logEvent = async (
  source: string,
  action: string,
  entityType: string | null,
  entityId: string | null,
  payload: Record<string, unknown>,
  result: Record<string, unknown>,
) => {
  try {
    await supabaseAdmin.from("integration_log").insert({
      source,
      action,
      entity_type: entityType,
      entity_id: entityId,
      payload,
      result,
    });
  } catch {
    // Never let logging failures propagate
  }
};

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const extractFirstName = (businessName: string): string | null => {
  const firstToken = businessName.trim().split(/\s+/)[0];
  return firstToken || null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  const authHeader =
    req.headers.get("Authorization") ?? req.headers.get("authorization");

  if (!authHeader) {
    await logEvent(
      "promote-intake-lead",
      "auth_failed",
      null,
      null,
      {},
      { error: "missing_authorization_header" },
    );
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const authClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    },
  );

  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData?.user) {
    await logEvent(
      "promote-intake-lead",
      "auth_failed",
      null,
      null,
      {},
      { error: authError?.message ?? "invalid_jwt" },
    );
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    await logEvent(
      "promote-intake-lead",
      "validation_failed",
      null,
      null,
      {},
      { error: "invalid_json" },
    );
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const body = rawBody as Record<string, unknown>;
  if (typeof body.intake_lead_id !== "string" || !body.intake_lead_id.trim()) {
    await logEvent(
      "promote-intake-lead",
      "validation_failed",
      null,
      null,
      body,
      { error: "missing_intake_lead_id" },
    );
    return jsonResponse({ error: "intake_lead_id must be a non-empty string" }, 400);
  }

  if (!isUuid(body.intake_lead_id.trim())) {
    await logEvent(
      "promote-intake-lead",
      "validation_failed",
      "intake_lead",
      body.intake_lead_id.trim(),
      body,
      { error: "invalid_intake_lead_id" },
    );
    return jsonResponse({ error: "intake_lead_id must be a valid UUID" }, 400);
  }

  if (body.create_deal !== undefined && typeof body.create_deal !== "boolean") {
    await logEvent(
      "promote-intake-lead",
      "validation_failed",
      "intake_lead",
      body.intake_lead_id.trim(),
      body,
      { error: "invalid_create_deal" },
    );
    return jsonResponse({ error: "create_deal must be a boolean" }, 400);
  }

  const payload: PromoteIntakeLeadPayload = {
    intake_lead_id: body.intake_lead_id.trim(),
    create_deal: typeof body.create_deal === "boolean" ? body.create_deal : true,
  };

  try {
    const { data: intakeLeadData, error: intakeLeadErr } = await supabaseAdmin
      .from("intake_leads")
      .select(
        "id, business_name, phone, email, website, trade_type_id, status, promoted_contact_id, metadata",
      )
      .eq("id", payload.intake_lead_id)
      .maybeSingle();

    const intakeLead = intakeLeadData as IntakeLeadRow | null;

    if (intakeLeadErr) {
      throw new Error(`intake_lead lookup failed: ${intakeLeadErr.message}`);
    }

    if (!intakeLead) {
      await logEvent(
        "promote-intake-lead",
        "not_found",
        "intake_lead",
        payload.intake_lead_id,
        payload as unknown as Record<string, unknown>,
        { error: "intake_lead_not_found" },
      );
      return jsonResponse({ error: "Intake lead not found" }, 404);
    }

    if (intakeLead.status === "qualified") {
      await logEvent(
        "promote-intake-lead",
        "promote_conflict",
        "intake_lead",
        intakeLead.id,
        payload as unknown as Record<string, unknown>,
        {
          error: "already_qualified",
          promoted_contact_id: intakeLead.promoted_contact_id,
        },
      );
      return jsonResponse(
        {
          error: "Intake lead already qualified",
          promoted_contact_id: intakeLead.promoted_contact_id,
        },
        409,
      );
    }

    const normalizedEmail = intakeLead.email?.trim().toLowerCase() ?? null;
    const normalizedPhone = intakeLead.phone?.trim() ?? null;

    const { data: existingCompany, error: companyLookupErr } = await supabaseAdmin
      .from("companies")
      .select("id")
      .ilike("name", escapeIlike(intakeLead.business_name))
      .maybeSingle();
    if (companyLookupErr) {
      throw new Error(`company lookup failed: ${companyLookupErr.message}`);
    }

    let companyId: number;
    if (existingCompany) {
      companyId = existingCompany.id;
    } else {
      const { data: newCompany, error: companyErr } = await supabaseAdmin
        .from("companies")
        .insert({
          name: intakeLead.business_name,
          website: intakeLead.website,
          trade_type_id: intakeLead.trade_type_id,
          external_source: "intake-promote",
          metadata: intakeLead.metadata ?? {},
        })
        .select("id")
        .single();
      if (companyErr) throw new Error(`company insert failed: ${companyErr.message}`);
      companyId = newCompany.id;
    }

    let existingContact: { id: number } | null = null;

    if (normalizedEmail) {
      const { data, error: emailErr } = await supabaseAdmin
        .from("contacts")
        .select("id")
        .eq("company_id", companyId)
        .contains("email_jsonb", [{ email: normalizedEmail }])
        .limit(1)
        .maybeSingle();
      if (emailErr) throw new Error(`contact email lookup failed: ${emailErr.message}`);
      existingContact = data;
    }

    if (!existingContact && normalizedPhone) {
      const { data, error: phoneErr } = await supabaseAdmin
        .from("contacts")
        .select("id")
        .eq("company_id", companyId)
        .contains("phone_jsonb", [{ number: normalizedPhone }])
        .limit(1)
        .maybeSingle();
      if (phoneErr) throw new Error(`contact phone lookup failed: ${phoneErr.message}`);
      existingContact = data;
    }

    const emailJsonb = normalizedEmail
      ? [{ email: normalizedEmail, type: "Work" }]
      : [];
    const phoneJsonb = normalizedPhone
      ? [{ number: normalizedPhone, type: "Work" }]
      : [];

    let contactId: number;
    if (existingContact) {
      contactId = existingContact.id;
    } else {
      const { data: newContact, error: contactErr } = await supabaseAdmin
        .from("contacts")
        .insert({
          first_name: extractFirstName(intakeLead.business_name),
          company_id: companyId,
          email_jsonb: emailJsonb,
          phone_jsonb: phoneJsonb,
          status: "cold",
          external_source: "intake-promote",
          metadata: intakeLead.metadata ?? {},
        })
        .select("id")
        .single();
      if (contactErr) throw new Error(`contact insert failed: ${contactErr.message}`);
      contactId = newContact.id;
    }

    let dealId: number | null = null;
    if (payload.create_deal) {
      const now = new Date().toISOString();
      const { data: newDeal, error: dealErr } = await supabaseAdmin
        .from("deals")
        .insert({
          name: `${intakeLead.business_name} - Intake Lead`,
          company_id: companyId,
          contact_ids: [contactId],
          stage: "lead",
          created_at: now,
          updated_at: now,
          metadata: intakeLead.metadata ?? {},
        })
        .select("id")
        .single();
      if (dealErr) throw new Error(`deal insert failed: ${dealErr.message}`);

      dealId = newDeal.id;

      const { error: dealContactErr } = await supabaseAdmin
        .from("deal_contacts")
        .insert({ deal_id: dealId, contact_id: contactId });
      if (dealContactErr) {
        throw new Error(`deal_contacts insert failed: ${dealContactErr.message}`);
      }
    }

    const { error: updateLeadErr } = await supabaseAdmin
      .from("intake_leads")
      .update({
        status: "qualified",
        promoted_contact_id: contactId,
      })
      .eq("id", intakeLead.id);
    if (updateLeadErr) {
      throw new Error(`intake_lead update failed: ${updateLeadErr.message}`);
    }

    const resultPayload = {
      company_id: companyId,
      contact_id: contactId,
      deal_id: dealId,
    };

    await logEvent(
      "promote-intake-lead",
      "promote_lead",
      "intake_lead",
      intakeLead.id,
      payload as unknown as Record<string, unknown>,
      resultPayload,
    );

    return jsonResponse(resultPayload, 201);
  } catch (err) {
    console.error("Intake lead promotion failed:", err);

    await logEvent(
      "promote-intake-lead",
      "promote_lead_failed",
      "intake_lead",
      payload.intake_lead_id,
      payload as unknown as Record<string, unknown>,
      { error: String(err) },
    );

    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
