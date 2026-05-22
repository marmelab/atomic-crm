/**
 * Shared email reservation helper for DocuSeal signing invitations.
 *
 * Phase 6B adds quote-level idempotence for signing invitation emails:
 *  - reserve one email_sends row per quote/source before sending
 *  - skip email entirely when the reservation already exists
 *  - mark the reservation as sent on success
 *  - release the reservation on explicit send failure so a later retry can try again
 */

interface MinimalSupabaseClient {
  from(table: string): {
    insert(values: unknown): Promise<{ error: unknown }>;
    update(values: unknown): {
      eq(column: string, value: unknown): {
        contains(column: string, value: unknown): {
          eq(column: string, value: unknown): Promise<{ error: unknown }>;
        };
      };
    };
    delete(): {
      eq(column: string, value: unknown): {
        contains(column: string, value: unknown): {
          eq(column: string, value: unknown): Promise<{ error: unknown }>;
        };
      };
    };
  };
}

const SIGNING_EMAIL_SOURCE = "docuseal_signing";

function hasErrorCode(
  error: unknown,
  code: string,
): error is { code: string; message?: string } {
  return typeof error === "object" && error !== null && "code" in error &&
    (error as { code?: string }).code === code;
}

export interface ReserveSigningEmailInput {
  supabase: MinimalSupabaseClient;
  quoteId: number;
  contactId?: number | null;
  companyId?: number | null;
  salesId?: number | null;
  subject: string;
  body: string;
  toEmail: string;
  signingUrl: string;
}

export interface ReserveSigningEmailResult {
  shouldSend: boolean;
  reservationTracked: boolean;
}

export async function reserveSigningEmailSend(
  input: ReserveSigningEmailInput,
): Promise<ReserveSigningEmailResult> {
  const { error } = await input.supabase.from("email_sends").insert({
    quote_id: input.quoteId,
    contact_id: input.contactId ?? null,
    company_id: input.companyId ?? null,
    sales_id: input.salesId ?? null,
    subject: input.subject,
    body: input.body,
    to_email: input.toEmail,
    status: "queued",
    metadata: {
      source: SIGNING_EMAIL_SOURCE,
      signing_url: input.signingUrl,
    },
  });

  if (!error) {
    return { shouldSend: true, reservationTracked: true };
  }

  // Postgres unique_violation from the partial index means another request
  // already reserved or sent the signing email for this quote.
  if (hasErrorCode(error, "23505")) {
    console.warn("reserveSigningEmailSend: existing signing email reservation", {
      quoteId: input.quoteId,
      toEmail: input.toEmail,
    });
    return { shouldSend: false, reservationTracked: false };
  }

  // Keep the primary flow alive if email log reservation failed for some
  // unexpected reason. We still allow the send, but we lose dedupe tracking
  // for this attempt.
  console.warn("reserveSigningEmailSend: reservation failed, proceeding", {
    quoteId: input.quoteId,
    error,
  });
  return { shouldSend: true, reservationTracked: false };
}

export async function markSigningEmailSendSent(
  supabase: MinimalSupabaseClient,
  quoteId: number,
  signingUrl: string,
  sentAt: string,
): Promise<void> {
  const { error } = await supabase.from("email_sends").update({
    status: "sent",
    sent_at: sentAt,
  }).eq("quote_id", quoteId).contains("metadata", {
    source: SIGNING_EMAIL_SOURCE,
    signing_url: signingUrl,
  }).eq("status", "queued");

  if (error) {
    console.warn("markSigningEmailSendSent: update failed (non-fatal)", {
      quoteId,
      error,
    });
  }
}

export async function releaseSigningEmailReservation(
  supabase: MinimalSupabaseClient,
  quoteId: number,
  signingUrl: string,
): Promise<void> {
  const { error } = await supabase.from("email_sends").delete().eq(
    "quote_id",
    quoteId,
  ).contains("metadata", {
    source: SIGNING_EMAIL_SOURCE,
    signing_url: signingUrl,
  }).eq("status", "queued");

  if (error) {
    console.warn(
      "releaseSigningEmailReservation: delete failed (non-fatal)",
      { quoteId, error },
    );
  }
}
