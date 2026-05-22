/**
 * Shared DocuSeal signing submission engine.
 *
 * Phase 2 extraction — this is now the ONLY place in the codebase that
 * talks to the DocuSeal submission API or mutates the quote row with
 * submission_id/signing_url/status=sent. Both `send_quote_for_signing`
 * (manual CRM flow) and `approve_proposal` (Discord approval token flow)
 * delegate here to guarantee identical payloads and state transitions.
 *
 * Not in scope for phase 2:
 *  - Resend invitation email: left in each caller because the HTML bodies
 *    diverge between the two flows. Phase 3 will unify them.
 *  - Full idempotence against DocuSeal (e.g. verifying a stored submission
 *    id still exists server-side). Phase 2 ships a minimal guard: reuse an
 *    existing submission when quote status is already sent/viewed/signed,
 *    otherwise create a new one.
 *
 * Behavioral guarantees (enforced by workflow parity tests):
 *  - DocuSeal payload is built via the shared buildSubmissionPayload with
 *    exactly the same field set from both call sites.
 *  - Quote row is updated atomically with all four signing fields
 *    (docuseal_submission_id, docuseal_signing_url, status, sent_at).
 *  - Approval flow sets approved_at as part of the same update; manual
 *    flow does not touch approved_at.
 */

import {
  buildSubmissionPayload,
  type ContractInput,
  type DocuSealSubmissionPayload,
} from "../contractFields.ts";
import { QUOTE_STATUS } from "./constants.ts";
import { docuSealOutgoingPayloadSchema } from "./schemas.ts";
import {
  reportValidationFailure,
  summarizeZodError,
} from "./validationReporter.ts";
import type { TakeSnapshotFn } from "./takeSnapshot.ts";

/** Minimal supabase client surface needed by the helper — matches the
 *  pattern already used by pipelineLogger for test-compatible types. */
interface MinimalSupabaseClient {
  from(table: string): {
    update(values: unknown): {
      eq(
        column: string,
        value: unknown,
      ): Promise<{ data: unknown; error: unknown }>;
    };
  };
}

export type SigningInitiator =
  | { source: "crm_manual" }
  | { source: "discord_approval" };

export interface SigningQuoteSnapshot {
  id: number;
  quote_number?: string | null;
  valid_until?: string | null;
  total_amount?: number | null;
  subtotal?: number | null;
  vat_amount?: number | null;
  vat_rate?: number | null;
  payment_terms?: string | null;
  delivery_terms?: string | null;
  terms_and_conditions?: string | null;
  generated_text?: string | null;
  currency?: string | null;
  /** Existing submission state used for idempotence */
  docuseal_submission_id?: string | null;
  docuseal_signing_url?: string | null;
  status?: string | null;
}

export interface SigningCompanySnapshot {
  name: string;
  org_number?: string | null;
}

export interface SigningContactSnapshot {
  name: string;
  email: string;
}

export interface SigningLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface CreateSigningSubmissionInput {
  supabase: MinimalSupabaseClient;
  initiator: SigningInitiator;
  quote: SigningQuoteSnapshot;
  company: SigningCompanySnapshot;
  contact: SigningContactSnapshot;
  lineItems: SigningLineItem[];
  proposalUrl: string;
  docusealApiKey: string;
  docusealTemplateId: number;
  docusealBaseUrl: string;
  /** Injection points for testing. */
  fetchImpl?: typeof fetch;
  now?: () => Date;
  /**
   * Fas 6A: optional snapshot function. When provided, a sent_for_signing
   * snapshot is taken after the quote row is updated (new submission only —
   * reused submissions do not change state so no snapshot is needed).
   * Inject as: (opts) => takeSnapshot({ supabase, ...opts })
   */
  takeSnapshotFn?: TakeSnapshotFn;
}

export interface CreateSigningSubmissionResult {
  submissionId: string;
  signingUrl: string | null;
  reusedExistingSubmission: boolean;
  shouldSendSigningEmail: boolean;
  /** The payload that was (or would have been) sent to DocuSeal. Returned
   *  for observability and for parity testing between callers. */
  docusealPayload: DocuSealSubmissionPayload;
  /** Timestamp used for status transitions (sent_at, approved_at).
   *  Returned so callers can log email_sends / deal updates against
   *  the same instant the quote moved to `sent`. */
  submittedAt: string;
}

class DocuSealSubmissionError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`DocuSeal API error ${status}: ${body}`);
    this.name = "DocuSealSubmissionError";
  }
}

export { DocuSealSubmissionError };

interface ExistingSubmissionLookup {
  exists: boolean;
  signingUrl: string | null;
}

async function updateQuoteOrThrow(
  supabase: MinimalSupabaseClient,
  quoteId: number,
  values: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("quotes")
    .update(values)
    .eq("id", quoteId);

  if (error) {
    console.error("createSigningSubmission: quote update failed", {
      quoteId,
      values,
      error,
    });
    throw new DocuSealSubmissionError(
      500,
      "Failed to persist quote signing state",
    );
  }
}

async function fetchExistingSubmission(
  fetchImpl: typeof fetch,
  docusealBaseUrl: string,
  docusealApiKey: string,
  submissionId: string,
): Promise<ExistingSubmissionLookup> {
  const response = await fetchImpl(
    `${docusealBaseUrl}/api/submissions/${submissionId}`,
    {
      method: "GET",
      headers: {
        "X-Auth-Token": docusealApiKey,
      },
    },
  );

  if (response.status === 404) {
    return { exists: false, signingUrl: null };
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new DocuSealSubmissionError(response.status, errorText);
  }

  const submission = (await response.json()) as Record<string, unknown>;
  const submitters = Array.isArray(submission.submitters)
    ? submission.submitters as Array<Record<string, unknown>>
    : [];
  const customerSubmitter = submitters[submitters.length - 1] || {};
  const signingSlug =
    typeof customerSubmitter.slug === "string" ? customerSubmitter.slug : null;

  return {
    exists: true,
    signingUrl: signingSlug ? `${docusealBaseUrl}/s/${signingSlug}` : null,
  };
}

/**
 * Build the DocuSeal payload for a quote without sending it. Shared with
 * `createSigningSubmission` and exposed directly so parity tests can assert
 * that both callers produce identical payloads without needing a live
 * DocuSeal mock.
 */
export function buildSigningPayload(
  input: Omit<
    CreateSigningSubmissionInput,
    "supabase" | "fetchImpl" | "now" | "initiator"
  >,
): DocuSealSubmissionPayload {
  const contractInput: ContractInput = {
    templateId: input.docusealTemplateId,
    quote: {
      id: input.quote.id,
      quote_number: input.quote.quote_number ?? undefined,
      valid_until: input.quote.valid_until ?? undefined,
      total_amount: input.quote.total_amount ?? undefined,
      subtotal: input.quote.subtotal ?? undefined,
      vat_amount: input.quote.vat_amount ?? undefined,
      vat_rate: input.quote.vat_rate ?? undefined,
      payment_terms: input.quote.payment_terms ?? undefined,
      delivery_terms: input.quote.delivery_terms ?? undefined,
      terms_and_conditions: input.quote.terms_and_conditions ?? undefined,
      generated_text: input.quote.generated_text ?? undefined,
      currency: input.quote.currency ?? undefined,
    },
    company: {
      name: input.company.name,
      org_number: input.company.org_number ?? undefined,
    },
    contact: {
      name: input.contact.name,
      email: input.contact.email,
    },
    lineItems: input.lineItems,
    proposalUrl: input.proposalUrl,
  };
  return buildSubmissionPayload(contractInput);
}

/**
 * Create (or reuse) a DocuSeal submission for a quote.
 *
 * Idempotence contract:
 *  - If the quote already has a docuseal_submission_id AND its status is
 *    one of sent/viewed/signed, return the existing submission without
 *    contacting DocuSeal and without mutating the quote row.
 *  - Otherwise, build the payload, POST to DocuSeal, parse the signing
 *    URL, and update the quote row in a single atomic UPDATE.
 */
export async function createSigningSubmission(
  input: CreateSigningSubmissionInput,
): Promise<CreateSigningSubmissionResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const now = input.now ?? (() => new Date());

  const payload = buildSigningPayload(input);

  // Phase 3: fail-fast validation of the outgoing DocuSeal payload.
  // Our own code produces this payload, so a schema mismatch is a
  // bug in buildSubmissionPayload or its inputs — not something to
  // swallow. We quarantine the failing payload to the DB for audit
  // and throw a DocuSealSubmissionError so the caller maps it to
  // its own response (HTML page / JSON error) the same way it would
  // treat an actual DocuSeal API failure.
  const outgoingCheck = docuSealOutgoingPayloadSchema.safeParse(payload);
  if (!outgoingCheck.success) {
    const summary = summarizeZodError(outgoingCheck.error);
    await reportValidationFailure({
      supabase: input.supabase as Parameters<
        typeof reportValidationFailure
      >[0]["supabase"],
      quoteId: typeof input.quote.id === "number" ? input.quote.id : null,
      boundary: "docuseal_outgoing_payload",
      schemaName: "docuSealOutgoingPayloadSchema",
      policy: "fail_fast",
      rawInput: payload,
      validationError: summary,
      errorDetails: { issues: outgoingCheck.error.issues },
    });
    throw new DocuSealSubmissionError(
      500,
      `Outgoing DocuSeal payload failed schema validation: ${summary}`,
    );
  }

  if (input.quote.status === QUOTE_STATUS.DECLINED) {
    throw new DocuSealSubmissionError(
      409,
      "Quote is declined. Recall to generated before sending again.",
    );
  }

  // Phase 6B: stronger idempotence. Reuse active submissions, recover
  // partial writes, and heal phantom submission ids that no longer exist
  // server-side in DocuSeal.
  const reusableStatuses: readonly string[] = [
    QUOTE_STATUS.SENT,
    QUOTE_STATUS.VIEWED,
    QUOTE_STATUS.SIGNED,
  ];
  if (input.quote.docuseal_submission_id) {
    if (
      input.quote.status &&
      reusableStatuses.includes(input.quote.status)
    ) {
      if (input.quote.status === QUOTE_STATUS.SIGNED) {
        return {
          submissionId: input.quote.docuseal_submission_id,
          signingUrl: input.quote.docuseal_signing_url ?? null,
          reusedExistingSubmission: true,
          shouldSendSigningEmail: false,
          docusealPayload: payload,
          submittedAt: now().toISOString(),
        };
      }

      const existing = await fetchExistingSubmission(
        fetchImpl,
        input.docusealBaseUrl,
        input.docusealApiKey,
        input.quote.docuseal_submission_id,
      );

      if (existing.exists) {
        console.warn(
          "createSigningSubmission: reusing existing DocuSeal submission",
          {
            quoteId: input.quote.id,
            submissionId: input.quote.docuseal_submission_id,
            quoteStatus: input.quote.status,
            initiatorSource: input.initiator.source,
          },
        );
        return {
          submissionId: input.quote.docuseal_submission_id,
          signingUrl: existing.signingUrl ?? input.quote.docuseal_signing_url ??
            null,
          reusedExistingSubmission: true,
          shouldSendSigningEmail: true,
          docusealPayload: payload,
          submittedAt: now().toISOString(),
        };
      }

      console.warn(
        "createSigningSubmission: phantom DocuSeal submission detected, recreating",
        {
          quoteId: input.quote.id,
          submissionId: input.quote.docuseal_submission_id,
          quoteStatus: input.quote.status,
        },
      );
      await updateQuoteOrThrow(input.supabase, input.quote.id, {
        docuseal_submission_id: null,
        docuseal_signing_url: null,
      });
    } else if (
      input.quote.status === QUOTE_STATUS.DRAFT ||
      input.quote.status === QUOTE_STATUS.GENERATED ||
      !input.quote.status
    ) {
      const existing = await fetchExistingSubmission(
        fetchImpl,
        input.docusealBaseUrl,
        input.docusealApiKey,
        input.quote.docuseal_submission_id,
      );

      if (existing.exists) {
        const recoveredSigningUrl =
          existing.signingUrl ?? input.quote.docuseal_signing_url ?? null;
        const submittedAt = now().toISOString();
        const updateData: Record<string, unknown> = {
          docuseal_submission_id: input.quote.docuseal_submission_id,
          docuseal_signing_url: recoveredSigningUrl,
          status: QUOTE_STATUS.SENT,
          sent_at: submittedAt,
        };
        if (input.initiator.source === "discord_approval") {
          updateData.approved_at = submittedAt;
        }
        await updateQuoteOrThrow(input.supabase, input.quote.id, updateData);

        if (input.takeSnapshotFn) {
          await input.takeSnapshotFn({
            quoteId: input.quote.id,
            triggerEvent: "sent_for_signing",
            oldStatus: input.quote.status ?? null,
            newStatus: QUOTE_STATUS.SENT,
            initiatorSource:
              input.initiator.source === "discord_approval"
                ? "discord_approval"
                : "crm_seller",
            metadata: {
              submissionId: input.quote.docuseal_submission_id,
              recoveredExistingSubmission: true,
            },
          });
        }

        return {
          submissionId: input.quote.docuseal_submission_id,
          signingUrl: recoveredSigningUrl,
          reusedExistingSubmission: false,
          shouldSendSigningEmail: true,
          docusealPayload: payload,
          submittedAt,
        };
      }

      console.warn(
        "createSigningSubmission: stale partial DocuSeal submission id, recreating",
        {
          quoteId: input.quote.id,
          submissionId: input.quote.docuseal_submission_id,
          quoteStatus: input.quote.status,
        },
      );
      await updateQuoteOrThrow(input.supabase, input.quote.id, {
        docuseal_submission_id: null,
        docuseal_signing_url: null,
      });
    }
  }

  const response = await fetchImpl(`${input.docusealBaseUrl}/api/submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": input.docusealApiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`DocuSeal API error (${response.status}):`, errorText);
    throw new DocuSealSubmissionError(response.status, errorText);
  }

  const submissionResult = (await response.json()) as unknown;
  const submitters = Array.isArray(submissionResult)
    ? (submissionResult as Array<Record<string, unknown>>)
    : [submissionResult as Record<string, unknown>];
  const firstSubmitter = submitters[0] || {};
  const submissionIdValue =
    firstSubmitter.submission_id ?? firstSubmitter.id ?? "";
  const submissionId = String(submissionIdValue);

  // Customer slug is the last submitter (Axona is first, already completed).
  const customerSubmitter = submitters[submitters.length - 1] || {};
  const signingSlug = customerSubmitter.slug as string | undefined;
  const signingUrl = signingSlug
    ? `${input.docusealBaseUrl}/s/${signingSlug}`
    : null;

  const submittedAt = now().toISOString();

  const updateData: Record<string, unknown> = {
    docuseal_submission_id: submissionId,
    docuseal_signing_url: signingUrl,
    status: QUOTE_STATUS.SENT,
    sent_at: submittedAt,
  };
  if (input.initiator.source === "discord_approval") {
    updateData.approved_at = submittedAt;
  }

  await updateQuoteOrThrow(input.supabase, input.quote.id, updateData);

  // Fas 6A: snapshot the state transition. Reused submissions are excluded
  // because no state change occurred — the quote was already sent/viewed/signed.
  if (input.takeSnapshotFn) {
    await input.takeSnapshotFn({
      quoteId: input.quote.id,
      triggerEvent: "sent_for_signing",
      oldStatus: input.quote.status ?? null,
      newStatus: QUOTE_STATUS.SENT,
      initiatorSource:
        input.initiator.source === "discord_approval"
          ? "discord_approval"
          : "crm_seller",
      metadata: { submissionId, reusedExistingSubmission: false },
    });
  }

  return {
    submissionId,
    signingUrl,
    reusedExistingSubmission: false,
    shouldSendSigningEmail: true,
    docusealPayload: payload,
    submittedAt,
  };
}
