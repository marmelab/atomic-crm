/**
 * sendSigningEmail — single source of truth for DocuSeal signing invitation emails.
 *
 * Wraps the full send flow:
 *  1. Reserve an email_sends row (idempotent via unique index from Fas 6B)
 *  2. If reservation already exists → return skipped (email was already sent)
 *  3. Call Resend API with the canonical signing invitation HTML
 *  4. Mark the row as sent on success, release on Resend failure so a later
 *     retry can attempt again
 *
 * Callers (approve_proposal, send_quote_for_signing, retry_quote_step) MUST NOT
 * duplicate this logic. All signing invitation emails go through here.
 */

import {
  markSigningEmailSendSent,
  releaseSigningEmailReservation,
  reserveSigningEmailSend,
} from "./signingEmail.ts";
import { getResendApiUrl } from "../serviceEndpoints.ts";

// Narrow type mirrors signingEmail.ts so test mocks stay simple.
interface MinimalSupabaseClient {
  from(table: string): {
    insert(values: unknown): Promise<{ error: unknown }>;
    update(values: unknown): {
      eq(
        column: string,
        value: unknown,
      ): {
        contains(
          column: string,
          value: unknown,
        ): {
          eq(column: string, value: unknown): Promise<{ error: unknown }>;
        };
      };
    };
    delete(): {
      eq(
        column: string,
        value: unknown,
      ): {
        contains(
          column: string,
          value: unknown,
        ): {
          eq(column: string, value: unknown): Promise<{ error: unknown }>;
        };
      };
    };
  };
}

export interface SendSigningEmailInput {
  supabase: MinimalSupabaseClient;
  quoteId: number;
  contactId?: number | null;
  companyId?: number | null;
  salesId?: number | null;
  contactName: string;
  contactEmail: string;
  companyName: string;
  quoteNumber: string;
  /**
   * DocuSeal signing URL — used as dedup key in email_sends via the Fas 6B
   * unique index. This is NOT the link in the email button; that is proposalUrl.
   * After a recall+resubmit, signing_url changes, which allows a new invitation
   * email to be sent even though a prior one exists in email_sends.
   */
  signingUrl: string;
  /**
   * Customer-facing proposal URL (quote.html?id=…&token=…). This is the link
   * placed in the email button — the customer lands here to review and sign.
   */
  proposalUrl: string;
  /**
   * When true, throws instead of proceeding if the email_sends reservation
   * fails with an unexpected DB error. Use in retry paths where sending without
   * a traceable reservation would create silent duplicates.
   */
  strictReservation?: boolean;
}

export interface SendSigningEmailResult {
  sent: boolean;
  skipped: boolean;
  reason?: "already_sent";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSigningEmailHtml(params: {
  contactName: string;
  companyName: string;
  quoteNumber: string;
  proposalUrl: string;
}): string {
  const safeContact = escapeHtml(params.contactName);
  const safeCompany = escapeHtml(params.companyName);
  const safeQuoteNumber = escapeHtml(params.quoteNumber);
  const safeUrl = encodeURI(params.proposalUrl);

  return `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="utf-8"></head>
<body style="font-family:Inter,-apple-system,sans-serif;margin:0;padding:0;background:#f5f5f5;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#0a0a0a;padding:32px 40px;">
      <h1 style="color:#fff;font-size:20px;margin:0;">Offert ${safeQuoteNumber}</h1>
      <p style="color:#a3a3a3;font-size:14px;margin:8px 0 0;">Axona Digital AB</p>
    </div>
    <div style="padding:40px;">
      <p style="font-size:15px;color:#0a0a0a;line-height:1.6;margin:0 0 16px;">Hej ${safeContact},</p>
      <p style="font-size:15px;color:#525252;line-height:1.6;margin:0 0 24px;">Tack för ditt intresse! Vi har tagit fram en offert till ${safeCompany}. Klicka på knappen nedan för att granska offerten och signera avtalet.</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${safeUrl}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">Visa offert och signera</a>
      </div>
      <p style="font-size:13px;color:#a3a3a3;line-height:1.6;margin:24px 0 0;">Om du har frågor, svara gärna på detta mejl så återkommer vi så snart vi kan.</p>
    </div>
    <div style="padding:24px 40px;background:#fafafa;border-top:1px solid #e5e5e5;">
      <p style="font-size:12px;color:#a3a3a3;margin:0;">Axona Digital AB | Östersund, Sverige</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send a DocuSeal signing invitation email to the customer.
 *
 * Idempotent: calling this twice with the same quoteId + signingUrl returns
 * { sent: false, skipped: true, reason: "already_sent" } on the second call
 * because the email_sends row already exists (Fas 6B unique index).
 *
 * Throws if RESEND_API_KEY is missing or the Resend API returns an error.
 * On Resend failure, the email_sends reservation is released so a future
 * retry can attempt again.
 */
export async function sendSigningEmail(
  input: SendSigningEmailInput,
): Promise<SendSigningEmailResult> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "hej@axonadigital.se";

  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const safeUrl = encodeURI(input.proposalUrl);
  if (!/^https?:\/\//i.test(safeUrl)) {
    throw new Error(`Invalid proposal URL protocol: ${input.proposalUrl}`);
  }

  // Step 1: Reserve an email_sends slot.
  // Returns { shouldSend: false } when a row already exists for this
  // quote_id + signing_url (constraint 23505 = unique_violation).
  const reservation = await reserveSigningEmailSend({
    supabase: input.supabase,
    quoteId: input.quoteId,
    contactId: input.contactId ?? null,
    companyId: input.companyId ?? null,
    salesId: input.salesId ?? null,
    subject: `Offert ${input.quoteNumber} — Axona Digital`,
    body: "Offert skickad via Resend med DocuSeal signeringslank",
    toEmail: input.contactEmail,
    signingUrl: input.signingUrl,
  });

  if (!reservation.shouldSend) {
    return { sent: false, skipped: true, reason: "already_sent" };
  }

  // In strict mode (retry paths) an untracked reservation is a hard error —
  // proceeding would send the email without any dedup row, so a subsequent
  // retry could send a duplicate.
  if (input.strictReservation && !reservation.reservationTracked) {
    throw new Error(
      "send_email reservation failed — cannot proceed without dedup tracking",
    );
  }

  // Step 2: Build and send the email via Resend.
  const html = buildSigningEmailHtml({
    contactName: input.contactName,
    companyName: input.companyName,
    quoteNumber: input.quoteNumber,
    proposalUrl: input.proposalUrl,
  });

  const response = await fetch(`${getResendApiUrl()}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: `Axona Digital <${fromEmail}>`,
      to: [input.contactEmail],
      subject: `Offert ${input.quoteNumber} — Axona Digital`,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Release the reservation so a future retry gets a fresh attempt.
    await releaseSigningEmailReservation(
      input.supabase,
      input.quoteId,
      input.signingUrl,
    );
    throw new Error(`Resend API error ${response.status}: ${errorText}`);
  }

  // Step 3: Mark the reservation as sent.
  await markSigningEmailSendSent(
    input.supabase,
    input.quoteId,
    input.signingUrl,
    new Date().toISOString(),
  );

  return { sent: true, skipped: false };
}
