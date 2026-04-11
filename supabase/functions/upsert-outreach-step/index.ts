import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const INGEST_API_KEY = Deno.env.get("INGEST_API_KEY");
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_CHANNELS = new Set(["email", "linkedin", "phone"]);
const VALID_SEQUENCE_STEPS = new Set([1, 2, 3, 4, 5, 6, 7]);
const ROLLUP_SEQUENCE_STATUSES = new Set(["sent", "completed"]);
const SENT_STATUS = "sent";
const RESPONSE_CORS_HEADERS = {
  ...corsHeaders,
  "Access-Control-Allow-Headers": `${corsHeaders["Access-Control-Allow-Headers"]}, x-api-key`,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const OPTIONAL_STRING_FIELDS = [
  "subject",
  "body",
  "review_status",
  "review_feedback",
  "status",
  "run_id",
] as const;

type OptionalStringField = (typeof OPTIONAL_STRING_FIELDS)[number];
type CurrentDraftStatus =
  | "none"
  | "drafting"
  | "ai_reviewed"
  | "approved"
  | "sent";

interface OutreachStepUpsertPayload {
  intake_lead_id: string;
  sequence_step: number;
  channel: string;
  subject?: string;
  body?: string;
  review_status?: string;
  review_feedback?: string;
  status?: string;
  run_id?: string;
}

interface OutreachStepRollupRow {
  sequence_step: number;
  status: string;
  sent_at: string | null;
  subject: string | null;
  body: string | null;
}

const CURRENT_DRAFT_STATUS_MAP: Record<string, CurrentDraftStatus> = {
  ai_reviewed: "ai_reviewed",
  approved: "approved",
  sent: "sent",
  drafting: "drafting",
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...RESPONSE_CORS_HEADERS },
  });

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

const hasOwn = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

const getOptionalString = (
  body: Record<string, unknown>,
  field: OptionalStringField,
): string | undefined => {
  if (!hasOwn(body, field)) {
    return undefined;
  }

  const value = body[field];
  if (typeof value !== "string") {
    throw new Error(`${field}_must_be_string`);
  }

  return value;
};

const computeRollups = (steps: OutreachStepRollupRow[]) => {
  let outreachCount = 0;
  let outreachSequenceStep = 0;
  let lastOutreachAt: string | null = null;

  for (const step of steps) {
    if (step.status === SENT_STATUS) {
      outreachCount += 1;

      if (!lastOutreachAt) {
        lastOutreachAt = step.sent_at;
      } else if (
        step.sent_at &&
        new Date(step.sent_at).getTime() > new Date(lastOutreachAt).getTime()
      ) {
        lastOutreachAt = step.sent_at;
      }
    }

    if (
      ROLLUP_SEQUENCE_STATUSES.has(step.status) &&
      step.sequence_step > outreachSequenceStep
    ) {
      outreachSequenceStep = step.sequence_step;
    }
  }

  const latestStep = steps.reduce<OutreachStepRollupRow | null>(
    (currentLatest, step) =>
      !currentLatest || step.sequence_step > currentLatest.sequence_step
        ? step
        : currentLatest,
    null,
  );

  return {
    outreach_count: outreachCount,
    outreach_sequence_step: outreachSequenceStep,
    last_outreach_at: lastOutreachAt,
    current_draft_status: latestStep
      ? (CURRENT_DRAFT_STATUS_MAP[latestStep.status] ?? "none")
      : "none",
    outreach_subject: latestStep?.subject ?? null,
    outreach_draft: latestStep?.body ?? null,
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: RESPONSE_CORS_HEADERS,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  // Dual auth: API key (n8n / external) OR JWT (frontend)
  const apiKey = req.headers.get("x-api-key");
  const authHeader =
    req.headers.get("Authorization") ?? req.headers.get("authorization");
  let authenticated = false;

  if (apiKey && INGEST_API_KEY && apiKey === INGEST_API_KEY) {
    authenticated = true;
  } else if (authHeader) {
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: authHeader } },
      },
    );
    const { data: authData, error: authError } =
      await authClient.auth.getUser();
    if (!authError && authData?.user) {
      authenticated = true;
    }
  }

  if (!authenticated) {
    await logEvent(
      "upsert-outreach-step",
      "auth_failed",
      null,
      null,
      {},
      { error: "invalid_credentials" },
    );
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    await logEvent(
      "upsert-outreach-step",
      "validation_failed",
      null,
      null,
      {},
      { error: "invalid_json" },
    );
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const body =
    typeof rawBody === "object" && rawBody !== null && !Array.isArray(rawBody)
      ? (rawBody as Record<string, unknown>)
      : null;

  if (!body) {
    await logEvent(
      "upsert-outreach-step",
      "validation_failed",
      null,
      null,
      {},
      { error: "invalid_payload" },
    );
    return jsonResponse({ error: "Request body must be a JSON object" }, 400);
  }

  const intakeLeadId = body.intake_lead_id;
  if (typeof intakeLeadId !== "string" || !intakeLeadId.trim()) {
    await logEvent(
      "upsert-outreach-step",
      "validation_failed",
      null,
      null,
      body,
      { error: "missing_intake_lead_id" },
    );
    return jsonResponse({ error: "intake_lead_id is required" }, 400);
  }

  if (!UUID_REGEX.test(intakeLeadId)) {
    await logEvent(
      "upsert-outreach-step",
      "validation_failed",
      null,
      intakeLeadId,
      body,
      { error: "invalid_intake_lead_id" },
    );
    return jsonResponse({ error: "intake_lead_id must be a valid UUID" }, 400);
  }

  const rawSequenceStep = body.sequence_step;
  if (typeof rawSequenceStep !== "number" || !Number.isInteger(rawSequenceStep)) {
    await logEvent(
      "upsert-outreach-step",
      "validation_failed",
      "intake_lead",
      intakeLeadId,
      body,
      { error: "missing_sequence_step" },
    );
    return jsonResponse({ error: "sequence_step must be an integer" }, 400);
  }

  const sequenceStep = rawSequenceStep;
  if (!VALID_SEQUENCE_STEPS.has(sequenceStep)) {
    await logEvent(
      "upsert-outreach-step",
      "validation_failed",
      "intake_lead",
      intakeLeadId,
      body,
      { error: "invalid_sequence_step" },
    );
    return jsonResponse({ error: "sequence_step must be between 1 and 7" }, 400);
  }

  const channel = body.channel ?? "email";
  if (typeof channel !== "string" || !VALID_CHANNELS.has(channel)) {
    await logEvent(
      "upsert-outreach-step",
      "validation_failed",
      "intake_lead",
      intakeLeadId,
      body,
      { error: "invalid_channel" },
    );
    return jsonResponse(
      { error: "channel must be one of: email, linkedin, phone" },
      400,
    );
  }

  let upsertPayload: OutreachStepUpsertPayload;
  try {
    upsertPayload = {
      intake_lead_id: intakeLeadId,
      sequence_step: sequenceStep,
      channel,
    };

    for (const field of OPTIONAL_STRING_FIELDS) {
      const value = getOptionalString(body, field);
      if (value !== undefined) {
        upsertPayload[field] = value;
      }
    }
  } catch (error) {
    const validationError =
      error instanceof Error ? error.message : "invalid_optional_field";

    await logEvent(
      "upsert-outreach-step",
      "validation_failed",
      "intake_lead",
      intakeLeadId,
      body,
      { error: validationError },
    );

    return jsonResponse(
      { error: validationError.replace(/_/g, " ") },
      400,
    );
  }

  try {
    const { data: intakeLead, error: intakeLeadError } = await supabaseAdmin
      .from("intake_leads")
      .select("id")
      .eq("id", intakeLeadId)
      .maybeSingle();

    if (intakeLeadError) {
      throw new Error(`intake_leads lookup failed: ${intakeLeadError.message}`);
    }

    if (!intakeLead) {
      await logEvent(
        "upsert-outreach-step",
        "intake_lead_not_found",
        "intake_lead",
        intakeLeadId,
        body,
        { error: "not_found" },
      );
      return jsonResponse({ error: "intake_lead_id not found" }, 404);
    }

    const { data: upsertedStep, error: upsertError } = await supabaseAdmin
      .from("outreach_steps")
      .upsert(upsertPayload, {
        onConflict: "intake_lead_id,sequence_step",
      })
      .select("id, intake_lead_id, sequence_step, status")
      .single();

    if (upsertError) {
      throw new Error(`outreach_steps upsert failed: ${upsertError.message}`);
    }

    const { data: outreachSteps, error: outreachStepsError } = await supabaseAdmin
      .from("outreach_steps")
      .select("sequence_step, status, sent_at, subject, body")
      .eq("intake_lead_id", intakeLeadId);

    if (outreachStepsError) {
      throw new Error(`outreach_steps rollup query failed: ${outreachStepsError.message}`);
    }

    const rollups = computeRollups(
      (outreachSteps ?? []) as OutreachStepRollupRow[],
    );

    const { error: intakeLeadUpdateError } = await supabaseAdmin
      .from("intake_leads")
      .update(rollups)
      .eq("id", intakeLeadId);

    if (intakeLeadUpdateError) {
      throw new Error(`intake_leads rollup update failed: ${intakeLeadUpdateError.message}`);
    }

    const result = {
      id: upsertedStep.id,
      intake_lead_id: upsertedStep.intake_lead_id,
      sequence_step: upsertedStep.sequence_step,
      status: upsertedStep.status,
    };

    await logEvent(
      "upsert-outreach-step",
      "upsert_outreach_step",
      "outreach_step",
      String(upsertedStep.id),
      body,
      result,
    );

    return jsonResponse(result, 200);
  } catch (error) {
    console.error("Outreach step upsert failed:", error);

    await logEvent(
      "upsert-outreach-step",
      "upsert_outreach_step_failed",
      "intake_lead",
      intakeLeadId,
      body,
      { error: String(error) },
    );

    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
