import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const RESPONSE_CORS_HEADERS = {
  ...corsHeaders,
  "Access-Control-Allow-Headers":
    `${corsHeaders["Access-Control-Allow-Headers"]}, x-api-key`,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CurrentDraftStatus =
  | "none"
  | "drafting"
  | "ai_reviewed"
  | "approved"
  | "sent";

interface SendOutreachPayload {
  outreach_step_id: number;
}

interface OutreachStepRow {
  id: number;
  intake_lead_id: string;
  sequence_step: number;
  status: string;
  channel: string;
  subject: string | null;
  body: string | null;
}

interface IntakeLeadRow {
  id: string;
  email: string | null;
  status: string;
}

interface OutreachStepRollupRow {
  sequence_step: number;
  status: string;
  sent_at: string | null;
  subject: string | null;
  body: string | null;
}

interface PostmarkSuccessResponse {
  MessageID: string;
}

const DRAFT_STATUS_MAP: Record<string, CurrentDraftStatus> = {
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

  const authHeader =
    req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader) {
    await logEvent(
      "send-outreach",
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
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    },
  );
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData?.user) {
    await logEvent(
      "send-outreach",
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
      "send-outreach",
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
      "send-outreach",
      "validation_failed",
      null,
      null,
      {},
      { error: "invalid_payload" },
    );
    return jsonResponse({ error: "Request body must be a JSON object" }, 400);
  }

  const outreachStepId = body.outreach_step_id;
  if (
    typeof outreachStepId !== "number" ||
    !Number.isFinite(outreachStepId) ||
    !Number.isInteger(outreachStepId)
  ) {
    await logEvent(
      "send-outreach",
      "validation_failed",
      null,
      null,
      body,
      { error: "invalid_outreach_step_id" },
    );
    return jsonResponse({ error: "outreach_step_id must be a number" }, 400);
  }

  const payload: SendOutreachPayload = {
    outreach_step_id: outreachStepId,
  };

  try {
    const { data: stepData, error: stepError } = await supabaseAdmin
      .from("outreach_steps")
      .select("*")
      .eq("id", payload.outreach_step_id)
      .maybeSingle();

    const step = stepData as OutreachStepRow | null;

    if (stepError) {
      throw new Error(`outreach_steps lookup failed: ${stepError.message}`);
    }

    if (!step) {
      await logEvent(
        "send-outreach",
        "not_found",
        "outreach_step",
        String(payload.outreach_step_id),
        payload as unknown as Record<string, unknown>,
        { error: "outreach_step_not_found" },
      );
      return jsonResponse({ error: "Outreach step not found" }, 404);
    }

    const { data: leadData, error: leadError } = await supabaseAdmin
      .from("intake_leads")
      .select("id, email, status")
      .eq("id", step.intake_lead_id)
      .single();

    const lead = leadData as IntakeLeadRow | null;

    if (leadError) {
      throw new Error(`intake_lead lookup failed: ${leadError.message}`);
    }

    if (!lead) {
      throw new Error("intake_lead lookup returned no rows");
    }

    if (step.status !== "ai_reviewed" && step.status !== "approved") {
      await logEvent(
        "send-outreach",
        "validation_failed",
        "outreach_step",
        String(step.id),
        payload as unknown as Record<string, unknown>,
        { error: "invalid_step_status", status: step.status },
      );
      return jsonResponse(
        { error: "Outreach step status must be ai_reviewed or approved" },
        400,
      );
    }

    if (step.channel !== "email") {
      await logEvent(
        "send-outreach",
        "validation_failed",
        "outreach_step",
        String(step.id),
        payload as unknown as Record<string, unknown>,
        { error: "invalid_channel", channel: step.channel },
      );
      return jsonResponse({ error: "Outreach step channel must be email" }, 400);
    }

    const recipientEmail = lead.email?.trim() ?? "";
    if (!recipientEmail) {
      await logEvent(
        "send-outreach",
        "validation_failed",
        "intake_lead",
        lead.id,
        payload as unknown as Record<string, unknown>,
        { error: "missing_lead_email" },
      );
      return jsonResponse({ error: "Lead must have an email address" }, 400);
    }

    const postmarkRes = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "X-Postmark-Server-Token": Deno.env.get("POSTMARK_SERVER_TOKEN") ?? "",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        From: Deno.env.get("POSTMARK_FROM_ADDRESS") ?? "",
        To: recipientEmail,
        Subject: step.subject ?? "(no subject)",
        HtmlBody: `<div>${(step.body ?? "").replace(/\n/g, "<br>")}</div>`,
        TextBody: step.body ?? "",
        MessageStream: Deno.env.get("POSTMARK_OUTREACH_STREAM") ?? "outbound",
        ReplyTo: Deno.env.get("POSTMARK_FROM_ADDRESS") ?? "",
      }),
    });

    if (!postmarkRes.ok) {
      const postmarkErrorText = await postmarkRes.text();

      const { error: failedUpdateError } = await supabaseAdmin
        .from("outreach_steps")
        .update({ status: "failed" })
        .eq("id", step.id);

      if (failedUpdateError) {
        throw new Error(
          `outreach_step failed-status update failed: ${failedUpdateError.message}`,
        );
      }

      // Recompute rollups so intake_leads reflects the failed status
      const { data: failStepsData } = await supabaseAdmin
        .from("outreach_steps")
        .select("sequence_step, status, sent_at, subject, body")
        .eq("intake_lead_id", step.intake_lead_id);

      if (failStepsData) {
        const failSteps = failStepsData as OutreachStepRollupRow[];
        let failOutreachCount = 0;
        let failOutreachSeqStep = 0;
        let failLastOutreachAt: string | null = null;

        for (const rs of failSteps) {
          if (rs.status === "sent") {
            failOutreachCount++;
            if (
              !failLastOutreachAt ||
              (rs.sent_at &&
                new Date(rs.sent_at) > new Date(failLastOutreachAt))
            ) {
              failLastOutreachAt = rs.sent_at;
            }
          }
          if (
            (rs.status === "sent" || rs.status === "completed") &&
            rs.sequence_step > failOutreachSeqStep
          ) {
            failOutreachSeqStep = rs.sequence_step;
          }
        }

        const failLatestStep = failSteps.reduce<OutreachStepRollupRow | null>(
          (best, rs) =>
            !best || rs.sequence_step > best.sequence_step ? rs : best,
          null,
        );

        await supabaseAdmin
          .from("intake_leads")
          .update({
            outreach_count: failOutreachCount,
            outreach_sequence_step: failOutreachSeqStep,
            last_outreach_at: failLastOutreachAt,
            current_draft_status: failLatestStep
              ? (DRAFT_STATUS_MAP[failLatestStep.status] ?? "none")
              : "none",
            outreach_subject: failLatestStep?.subject ?? null,
            outreach_draft: failLatestStep?.body ?? null,
          })
          .eq("id", step.intake_lead_id);
      }

      await logEvent(
        "send-outreach",
        "postmark_send_failed",
        "outreach_step",
        String(step.id),
        payload as unknown as Record<string, unknown>,
        {
          status: postmarkRes.status,
          status_text: postmarkRes.statusText,
          body: postmarkErrorText,
        },
      );

      return jsonResponse({ error: "Postmark send failed" }, 502);
    }

    const postmarkData = await postmarkRes.json() as PostmarkSuccessResponse;

    const { error: providerMessageUpdateError } = await supabaseAdmin
      .from("outreach_steps")
      .update({ provider_message_id: postmarkData.MessageID })
      .eq("id", step.id);

    if (providerMessageUpdateError) {
      throw new Error(
        `outreach_step provider_message_id update failed: ${providerMessageUpdateError.message}`,
      );
    }

    const sentAt = new Date().toISOString();
    const { error: statusUpdateError } = await supabaseAdmin
      .from("outreach_steps")
      .update({ status: "sent", sent_at: sentAt })
      .eq("id", step.id);

    if (statusUpdateError) {
      throw new Error(`outreach_step sent update failed: ${statusUpdateError.message}`);
    }

    const { data: allStepsData, error: allStepsError } = await supabaseAdmin
      .from("outreach_steps")
      .select("sequence_step, status, sent_at, subject, body")
      .eq("intake_lead_id", step.intake_lead_id);

    if (allStepsError) {
      throw new Error(`outreach_steps rollup query failed: ${allStepsError.message}`);
    }

    const steps = (allStepsData ?? []) as OutreachStepRollupRow[];
    let outreachCount = 0;
    let outreachSequenceStep = 0;
    let lastOutreachAt: string | null = null;

    for (const rollupStep of steps) {
      if (rollupStep.status === "sent") {
        outreachCount++;
        if (
          !lastOutreachAt ||
          (rollupStep.sent_at &&
            new Date(rollupStep.sent_at) > new Date(lastOutreachAt))
        ) {
          lastOutreachAt = rollupStep.sent_at;
        }
      }
      if (
        (rollupStep.status === "sent" || rollupStep.status === "completed") &&
        rollupStep.sequence_step > outreachSequenceStep
      ) {
        outreachSequenceStep = rollupStep.sequence_step;
      }
    }

    const latestStep = steps.reduce<OutreachStepRollupRow | null>(
      (best, rollupStep) =>
        !best || rollupStep.sequence_step > best.sequence_step
          ? rollupStep
          : best,
      null,
    );

    const { error: rollupUpdateError } = await supabaseAdmin
      .from("intake_leads")
      .update({
        outreach_count: outreachCount,
        outreach_sequence_step: outreachSequenceStep,
        last_outreach_at: lastOutreachAt,
        current_draft_status: latestStep
          ? (DRAFT_STATUS_MAP[latestStep.status] ?? "none")
          : "none",
        outreach_subject: latestStep?.subject ?? null,
        outreach_draft: latestStep?.body ?? null,
      })
      .eq("id", step.intake_lead_id);

    if (rollupUpdateError) {
      throw new Error(`intake_leads rollup update failed: ${rollupUpdateError.message}`);
    }

    if (lead.status === "uncontacted") {
      const { error: leadStatusUpdateError } = await supabaseAdmin
        .from("intake_leads")
        .update({ status: "in-sequence" })
        .eq("id", lead.id);

      if (leadStatusUpdateError) {
        throw new Error(
          `intake_lead status update failed: ${leadStatusUpdateError.message}`,
        );
      }
    }

    const result = {
      message_id: postmarkData.MessageID,
      step_id: step.id,
      status: "sent",
    };

    await logEvent(
      "send-outreach",
      "send_outreach",
      "outreach_step",
      String(step.id),
      payload as unknown as Record<string, unknown>,
      result,
    );

    return jsonResponse(result, 200);
  } catch (error) {
    console.error("Send outreach failed:", error);

    await logEvent(
      "send-outreach",
      "send_outreach_failed",
      "outreach_step",
      String(payload.outreach_step_id),
      payload as unknown as Record<string, unknown>,
      { error: String(error) },
    );

    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
