import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse, createJsonResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  errorResponseFromUnknown,
  getPositiveIntegerField,
  parseRequiredJsonBody,
} from "../_shared/http.ts";
import { sendMonthlyReportEmail } from "../_shared/monthlyReport/sendMonthlyReportEmail.ts";
import { buildReportEmailHtml } from "../_shared/monthlyReport/buildReportEmailHtml.ts";
import type {
  ReportAiContent,
  ReportMetrics,
} from "../_shared/monthlyReport/types.ts";

/**
 * Send Monthly Report — skickar en godkänd månadsrapport till kunden (user-JWT).
 *
 * Body: { report_id, overrides?: { recipient_email?, recipient_name?, generated_html? } }
 *
 * Idempotens på rapportnivå: skickar bara när status är 'draft' | 'approved' |
 * 'failed' och sätter 'sent' efteråt → ingen dubbel-utskick.
 */

function monthLabelSv(periodISO: string): string {
  return new Date(`${periodISO}T00:00:00Z`).toLocaleDateString("sv-SE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function sendReport(
  reportId: number,
  overrides: {
    recipient_email?: string;
    recipient_name?: string;
    ai_content?: ReportAiContent;
  },
): Promise<{
  report_id: number;
  status: string;
  email_send_id: number | null;
}> {
  const { data: report, error } = await supabaseAdmin
    .from("monthly_reports")
    .select(
      "id, company_id, period, status, recipient_email, recipient_name, generated_html, ai_content, metrics",
    )
    .eq("id", reportId)
    .single();
  if (error || !report) throw new Error(`Report ${reportId} not found`);

  if (report.status === "sent") {
    return { report_id: reportId, status: "already_sent", email_send_id: null };
  }

  const recipientEmail = overrides.recipient_email || report.recipient_email;
  if (!recipientEmail) {
    throw new Error("No recipient email — set one before sending");
  }

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("name")
    .eq("id", report.company_id)
    .single();
  const companyName = company?.name || "er sajt";
  const subject = `Er synlighet i ${monthLabelSv(report.period)} — ${companyName}`;

  // Vid redigerad AI-text: bygg om HTML server-side så mail-byggaren förblir
  // single source of truth. Annars använd den sparade HTML:en.
  const aiContent = (overrides.ai_content ??
    report.ai_content) as ReportAiContent | null;
  let html = report.generated_html as string | null;
  if (overrides.ai_content && report.metrics) {
    const metrics = report.metrics as ReportMetrics;
    const hasSearchData =
      metrics.impressions?.current != null || metrics.clicks?.current != null;
    html = buildReportEmailHtml({
      companyName,
      periodLabel: monthLabelSv(report.period),
      aiContent: overrides.ai_content,
      metrics,
      hasSearchData,
      replyToEmail: Deno.env.get("RESEND_FROM_EMAIL") || "hej@axonadigital.se",
    });
  }
  if (!html) {
    throw new Error("No generated_html on report — regenerate the draft first");
  }

  // Markera approved innan utskick (spårbarhet om Resend skulle hänga).
  await supabaseAdmin
    .from("monthly_reports")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      recipient_email: recipientEmail,
      recipient_name: overrides.recipient_name ?? report.recipient_name,
      ai_content: aiContent,
      generated_html: html,
    })
    .eq("id", reportId);

  let result;
  try {
    result = await sendMonthlyReportEmail({
      supabase: supabaseAdmin,
      monthlyReportId: reportId,
      companyId: report.company_id,
      toEmail: recipientEmail,
      subject,
      html,
      bodyPreview:
        (report.ai_content?.summary as string | undefined) ?? subject,
      period: report.period,
    });
  } catch (sendError) {
    // Släpp tillbaka till draft så teamet kan försöka igen.
    await supabaseAdmin
      .from("monthly_reports")
      .update({
        status: "draft",
        error:
          sendError instanceof Error ? sendError.message : String(sendError),
      })
      .eq("id", reportId);
    throw sendError;
  }

  await supabaseAdmin
    .from("monthly_reports")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      email_send_id: result.emailSendId,
      error: null,
    })
    .eq("id", reportId);

  return {
    report_id: reportId,
    status: "sent",
    email_send_id: result.emailSendId,
  };
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async () => {
        if (req.method !== "POST") {
          return createErrorResponse(405, "Method Not Allowed");
        }
        try {
          const body = await parseRequiredJsonBody(req);
          const reportId = getPositiveIntegerField(body, "report_id", {
            required: true,
          });
          const overridesRaw = (body as { overrides?: unknown }).overrides;
          const overrides =
            overridesRaw && typeof overridesRaw === "object"
              ? (overridesRaw as {
                  recipient_email?: string;
                  recipient_name?: string;
                  generated_html?: string;
                })
              : {};
          const result = await sendReport(reportId as number, overrides);
          return createJsonResponse({ success: true, ...result });
        } catch (error) {
          return errorResponseFromUnknown(error);
        }
      }),
    ),
  ),
);
