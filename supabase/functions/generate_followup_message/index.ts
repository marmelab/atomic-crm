import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse, createJsonResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

/**
 * Generate Follow-up Message — AI-powered SMS/email draft after a call.
 *
 * Two actions on a single endpoint so the whole feature stays isolated and
 * does not touch the working `send_email` function:
 *
 *   action: "generate" (default)
 *     in:  { call_log_id }
 *     out: { email_subject, email_body, sms_text,
 *            contact_id, contact_name, contact_email, contact_phone }
 *
 *   action: "send"
 *     in:  { contact_id, subject, body }   // possibly edited by the user
 *     out: { success: true, email_send_id }
 *
 * Email send reuses the same Resend + email_sends pattern as `send_email`,
 * but with template_id = null (email_sends.template_id is nullable).
 */

// Haiku 4.5 — drafting a short, friendly follow-up is a simple task well
// within Haiku's range, and it is ~3x cheaper and faster than the Sonnet
// model the quote pipeline uses. Per-draft cost is a fraction of an öre.
const ANTHROPIC_MODEL = "claude-haiku-4-5";

const OUTCOME_LABELS: Record<string, string> = {
  none: "Inget resultat",
  hot_lead: "Het lead",
  active_customer: "Aktiv kund",
  under_negotiation: "Under förhandling",
  follow_up: "Att följa upp",
  never_contacted: "Aldrig kontaktad",
  contacted_no_response: "Kontaktad, inget svar",
  not_interested: "Inte intresserad",
  meeting_booked: "Möte bokat",
  interested: "Intresserad",
  send_info: "Skicka info",
  callback_requested: "Ring upp igen",
};

const SYSTEM_PROMPT = `Du är en erfaren säljare på Axona Digital AB, en webb- och AI-byrå i Östersund.
Axona bygger hemsidor, e-handel, chattbottar och AI-automationslösningar.
Du skriver varma, personliga och korta uppföljningar på svenska efter telefonsamtal.
Tonen är professionell men avslappnad — aldrig säljig eller pushig.`;

function buildPrompt(input: {
  contactName: string;
  companyName: string;
  outcomeLabel: string;
  notes: string | null;
}): string {
  const notesBlock = input.notes?.trim()
    ? `Samtalsanteckningar:\n${input.notes.trim()}`
    : "Inga anteckningar fördes under samtalet.";

  return `Vi har precis pratat med ${input.contactName} på ${input.companyName}.
Samtalets resultat: ${input.outcomeLabel}.
${notesBlock}

Skriv ETT uppföljningsmail OCH ETT kortare SMS som vi kan skicka till kunden.
Båda ska:
1. Referera kort till något konkret från samtalet (om anteckningar finns).
2. Kort presentera vad Axona gör (webb, e-handel, AI).
3. Föreslå att vi bygger ihop en kostnadsfri demo — den brukar ligga nära den
   sida som faktiskt lanseras, så kunden ser resultatet direkt.

Krav:
- Mailet: max ca 150 ord, med ämnesrad. Avsluta vänligt, ingen signatur (den läggs till automatiskt).
- SMS:et: max 320 tecken, ledigt och direkt.
- Allt på svenska.

Svara ENDAST med giltig JSON i exakt denna struktur, inget annat:
{
  "email_subject": "ämnesrad",
  "email_body": "mejltext",
  "sms_text": "sms-text"
}`;
}

type FollowupDraft = {
  email_subject: string;
  email_body: string;
  sms_text: string;
};

function parseDraft(raw: string): FollowupDraft | null {
  // The model may wrap JSON in prose or a markdown fence — extract the first
  // balanced object. Keep it simple: grab the outermost { ... } span.
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    if (
      typeof parsed?.email_subject === "string" &&
      typeof parsed?.email_body === "string" &&
      typeof parsed?.sms_text === "string"
    ) {
      return parsed as FollowupDraft;
    }
    return null;
  } catch {
    return null;
  }
}

async function handleGenerate(callLogId: unknown): Promise<Response> {
  if (!Number.isInteger(Number(callLogId)) || Number(callLogId) <= 0) {
    return createErrorResponse(400, "call_log_id must be a positive integer");
  }

  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicApiKey) {
    return createErrorResponse(500, "ANTHROPIC_API_KEY not configured");
  }

  const supabase = supabaseAdmin;

  const { data: callLog, error: callLogError } = await supabase
    .from("call_logs")
    .select("id, company_id, contact_id, call_outcome, notes")
    .eq("id", Number(callLogId))
    .single();

  if (callLogError || !callLog) {
    return createErrorResponse(404, "Call log not found");
  }

  // Resolve a contact: the one on the call, else the company's first contact.
  let contact: Record<string, unknown> | null = null;
  if (callLog.contact_id) {
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email_jsonb, phone_jsonb")
      .eq("id", callLog.contact_id)
      .single();
    contact = data;
  }
  if (!contact && callLog.company_id) {
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email_jsonb, phone_jsonb")
      .eq("company_id", callLog.company_id)
      .order("id", { ascending: true })
      .limit(1);
    contact = data?.[0] ?? null;
  }

  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", callLog.company_id)
    .single();

  const contactName = contact
    ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() ||
      "kontakten"
    : "kontakten";
  const companyName = (company?.name as string) || "företaget";

  const prompt = buildPrompt({
    contactName,
    companyName,
    outcomeLabel: OUTCOME_LABELS[callLog.call_outcome] ?? "Samtal",
    notes: callLog.notes,
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Anthropic API error:", errorText);
    return createErrorResponse(502, "Failed to generate message from AI");
  }

  const result = await response.json();
  const rawText: string = result?.content?.[0]?.text ?? "";
  const draft = parseDraft(rawText);
  if (!draft) {
    console.error("Could not parse AI draft:", rawText.slice(0, 500));
    return createErrorResponse(502, "AI returned an unexpected format");
  }

  const emailJsonb = contact?.email_jsonb as
    | Array<{ email: string }>
    | null
    | undefined;
  const phoneJsonb = contact?.phone_jsonb as
    | Array<{ number: string }>
    | null
    | undefined;

  return createJsonResponse({
    ...draft,
    contact_id: contact?.id ?? null,
    contact_name: contactName,
    contact_email: emailJsonb?.[0]?.email ?? null,
    contact_phone: phoneJsonb?.[0]?.number ?? null,
  });
}

async function handleSend(
  body: Record<string, unknown>,
  userId: string | undefined,
): Promise<Response> {
  const { contact_id, subject, body: emailBody } = body;

  if (!Number.isInteger(Number(contact_id)) || Number(contact_id) <= 0) {
    return createErrorResponse(400, "contact_id must be a positive integer");
  }
  if (typeof subject !== "string" || subject.trim().length === 0) {
    return createErrorResponse(400, "subject is required");
  }
  if (typeof emailBody !== "string" || emailBody.trim().length === 0) {
    return createErrorResponse(400, "body is required");
  }
  if (subject.length > 500 || emailBody.length > 20000) {
    return createErrorResponse(400, "subject or body too long");
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return createErrorResponse(500, "RESEND_API_KEY not configured");
  }

  const supabase = supabaseAdmin;

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email_jsonb, company_id")
    .eq("id", Number(contact_id))
    .single();

  if (contactError || !contact) {
    return createErrorResponse(404, "Contact not found");
  }

  const emailJsonb = contact.email_jsonb as Array<{ email: string }> | null;
  const primaryEmail = emailJsonb?.[0]?.email;
  if (!primaryEmail) {
    return createErrorResponse(400, "Contact has no email address");
  }

  // Sender (sales) info for the from-address.
  let sender: Record<string, unknown> | null = null;
  if (userId) {
    const { data } = await supabase
      .from("sales")
      .select("id, first_name, last_name, email")
      .eq("user_id", userId)
      .single();
    sender = data;
  }

  const fromEmail =
    Deno.env.get("RESEND_FROM_EMAIL") ||
    (sender?.email as string) ||
    "noreply@axonadigital.se";
  const fromName = sender
    ? `${sender.first_name ?? ""} ${sender.last_name ?? ""}`.trim()
    : "Axona Digital";

  const { data: emailSend, error: insertError } = await supabase
    .from("email_sends")
    .insert({
      template_id: null,
      contact_id: contact.id,
      company_id: contact.company_id ?? null,
      sales_id: sender?.id ?? null,
      subject,
      body: emailBody,
      to_email: primaryEmail,
      from_email: fromEmail,
      status: "queued",
      metadata: { source: "followup_ai" },
    })
    .select()
    .single();

  if (insertError || !emailSend) {
    console.error("Insert email_sends error:", insertError);
    return createErrorResponse(500, "Failed to create email record");
  }

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [primaryEmail],
      subject,
      html: emailBody.replace(/\n/g, "<br>"),
      text: emailBody,
      tags: [{ name: "category", value: "followup" }],
    }),
  });

  if (!resendResponse.ok) {
    const errorData = await resendResponse.text();
    console.error("Resend API error:", errorData);
    await supabase
      .from("email_sends")
      .update({
        status: "bounced",
        metadata: { source: "followup_ai", resend_error: errorData },
      })
      .eq("id", emailSend.id);
    return createErrorResponse(502, "Failed to send email via Resend");
  }

  const resendResult = await resendResponse.json();
  await supabase
    .from("email_sends")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      postmark_message_id: resendResult.id,
    })
    .eq("id", emailSend.id);

  return createJsonResponse({ success: true, email_send_id: emailSend.id });
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user) => {
        if (req.method !== "POST") {
          return createErrorResponse(405, "Method Not Allowed");
        }

        let body: Record<string, unknown>;
        try {
          body = await req.json();
        } catch {
          return createErrorResponse(400, "Invalid JSON body");
        }

        const action = (body.action as string) ?? "generate";
        try {
          if (action === "send") {
            return await handleSend(body, user?.id);
          }
          return await handleGenerate(body.call_log_id);
        } catch (error) {
          console.error("generate_followup_message error:", error);
          return createErrorResponse(
            500,
            `Failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }),
    ),
  ),
);
