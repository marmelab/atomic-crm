/**
 * sendMonthlyReportEmail — skickar ett färdigt månadsrapport-mail via Resend och
 * loggar i email_sends. Speglar Resend-anropet i sendSigningEmail.ts.
 *
 * Idempotens ligger på rapportnivå: send_monthly_report skickar bara när
 * monthly_reports.status är 'draft'/'approved' och sätter 'sent' efteråt, så
 * dubbel-utskick förhindras av status-guarden — därför behövs ingen unik
 * email_sends-nyckel här. email_sends-raden är ren spårning.
 */

import { getResendApiUrl } from "../serviceEndpoints.ts";

interface MinimalSupabaseClient {
  from(table: string): {
    insert(values: unknown): {
      select(columns: string): {
        single(): Promise<{ data: { id: number } | null; error: unknown }>;
      };
    };
  };
}

export interface SendMonthlyReportEmailInput {
  supabase: MinimalSupabaseClient;
  monthlyReportId: number;
  companyId: number | null;
  contactId?: number | null;
  toEmail: string;
  subject: string;
  html: string;
  /** Kort textsammanfattning för email_sends.body (loggning). */
  bodyPreview: string;
  period: string; // ISO-datum för perioden, sparas i metadata
}

export interface SendMonthlyReportEmailResult {
  emailSendId: number | null;
}

export async function sendMonthlyReportEmail(
  input: SendMonthlyReportEmailInput,
): Promise<SendMonthlyReportEmailResult> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "hej@axonadigital.se";

  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }
  if (!/.+@.+\..+/.test(input.toEmail)) {
    throw new Error(`Invalid recipient email: ${input.toEmail}`);
  }

  const response = await fetch(`${getResendApiUrl()}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: `Axona Digital <${fromEmail}>`,
      to: [input.toEmail],
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend API error ${response.status}: ${errorText}`);
  }

  const sentAt = new Date().toISOString();
  let postmarkMessageId: string | null = null;
  try {
    const data = (await response.json()) as { id?: string };
    postmarkMessageId = data.id ?? null;
  } catch {
    // Resend svarade ok men utan parsbar body — ignorera, mailet gick ut.
  }

  // Spåra i email_sends (best effort — ett loggfel ska inte fälla utskicket).
  let emailSendId: number | null = null;
  try {
    const { data, error } = await input.supabase
      .from("email_sends")
      .insert({
        company_id: input.companyId,
        contact_id: input.contactId ?? null,
        subject: input.subject,
        body: input.bodyPreview.slice(0, 2000),
        to_email: input.toEmail,
        from_email: fromEmail,
        status: "sent",
        sent_at: sentAt,
        postmark_message_id: postmarkMessageId,
        metadata: {
          source: "monthly_report",
          monthly_report_id: input.monthlyReportId,
          period: input.period,
        },
      })
      .select("id")
      .single();
    if (error) {
      console.warn("sendMonthlyReportEmail: email_sends insert error:", error);
    } else {
      emailSendId = data?.id ?? null;
    }
  } catch (logError) {
    console.warn("sendMonthlyReportEmail: email_sends insert threw:", logError);
  }

  return { emailSendId };
}
