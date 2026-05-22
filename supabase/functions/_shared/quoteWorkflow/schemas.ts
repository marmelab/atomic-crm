/**
 * Zod schemas for the quote workflow pipeline (Phase 3).
 *
 * Every boundary that accepts or produces JSON has a schema here.
 * The POLICY for each boundary (fail-fast vs quarantine) lives with
 * the CALLER that invokes the schema, not here — this file only
 * defines the shapes.
 *
 *   Boundary                       | Policy       | Caller
 *   -------------------------------|--------------|----------------------------
 *   AI output (parseAnthropicSec.) | quarantine   | generateSections.ts
 *   save_quote_content payload     | fail-fast    | save_quote_content/index.ts
 *   save_quote_edits payload       | fail-fast    | save_quote_edits/index.ts
 *   DocuSeal webhook payload       | quarantine   | docuseal_webhook/index.ts
 *   DocuSeal outgoing payload      | fail-fast    | createSigningSubmission.ts
 *
 * Runtime import: uses `npm:zod@4` which works in Deno edge functions
 * and is aliased to `node_modules/zod` in both vitest.functions.config.ts
 * and vitest.workflow.config.ts so test runs resolve the same package.
 */

import { z } from "npm:zod@4";

// -----------------------------------------------------------------------
// AI output (quarantine policy)
// -----------------------------------------------------------------------

/**
 * Minimal required shape for parsed Anthropic responses. The two fields
 * below are the same pair the legacy regex parser has always required
 * (`/\{[\s\S]*"summary_pitch"[\s\S]*"proposal_body"[\s\S]*\}/`). Extra
 * keys flow through untouched via `.passthrough()` — the downstream
 * `normalizeSections` helper already knows how to fill defaults for
 * missing section fields, so we intentionally do NOT enumerate every
 * section key here. That would force the schema to re-version every
 * time the AI prompt adds a new field.
 */
export const generatedSectionsSchema = z
  .object({
    summary_pitch: z.string().min(1),
    proposal_body: z.string().min(1),
  })
  .passthrough();

export type GeneratedSectionsShape = z.infer<typeof generatedSectionsSchema>;

// -----------------------------------------------------------------------
// save_quote_content / save_quote_edits payloads (fail-fast)
// -----------------------------------------------------------------------

/**
 * Sections payload submitted by either editor. We validate that it is a
 * plain object but do not enumerate keys — the Phase 4 deep-merge helper
 * handles arbitrary keys and the existing frontend vocabulary of fields
 * evolves faster than we want to ship schemas for.
 */
const sectionsRecordSchema = z.record(z.string(), z.unknown());

/** Quote id can arrive as a number (from the CRM) or a string (legacy
 *  callers used String(rawQuoteId) for UUID compatibility). Accept both
 *  and let the backend coerce further. */
const quoteIdSchema = z.union([z.number().int().positive(), z.string().min(1)]);

export const saveQuoteContentPayloadSchema = z.object({
  quote_id: quoteIdSchema,
  sections: sectionsRecordSchema,
});

export type SaveQuoteContentPayload = z.infer<
  typeof saveQuoteContentPayloadSchema
>;

export const saveQuoteEditsPayloadSchema = z.object({
  quote_id: quoteIdSchema,
  write_token: z.string().min(1),
  sections: sectionsRecordSchema,
});

export type SaveQuoteEditsPayload = z.infer<typeof saveQuoteEditsPayloadSchema>;

// -----------------------------------------------------------------------
// DocuSeal webhook payload (quarantine policy)
// -----------------------------------------------------------------------

/**
 * DocuSeal sends a variety of webhook shapes. Historically we've seen
 *   form.*  events:        data.submission.id + data.submission.status
 *   submission.* events:   data.submission_id or top-level submission_id
 * This schema accepts both via optional fields and `.passthrough()`.
 * The only hard requirement is that SOMETHING looks like an event type.
 */
export const docuSealWebhookPayloadSchema = z
  .object({
    event_type: z.string().optional(),
    type: z.string().optional(),
    data: z
      .object({
        submission: z
          .object({
            id: z.union([z.number(), z.string()]).optional(),
            status: z.string().optional(),
            combined_document_url: z.string().nullish(),
          })
          .passthrough()
          .optional(),
        submission_id: z.union([z.number(), z.string()]).optional(),
        documents: z
          .array(z.object({ url: z.string() }).passthrough())
          .optional(),
      })
      .passthrough()
      .optional(),
    submission_id: z.union([z.number(), z.string()]).optional(),
    id: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough()
  .refine((payload) => Boolean(payload.event_type || payload.type), {
    message: "event_type or type must be present",
  });

export type DocuSealWebhookPayload = z.infer<
  typeof docuSealWebhookPayloadSchema
>;

// -----------------------------------------------------------------------
// DocuSeal outgoing submission payload (fail-fast)
// -----------------------------------------------------------------------

/**
 * The payload we POST to DocuSeal. Unlike the webhook schema this one
 * is STRICT — our own code produces it, so a mismatch is our bug and
 * we want to catch it before it hits a third-party API and fails
 * opaquely halfway through the signing flow.
 *
 * Note — every object here uses `.strict()` explicitly. Plain
 * `z.object(...)` in Zod v4 silently STRIPS unknown keys instead of
 * failing, which would quietly let a drifted buildSubmissionPayload
 * slip through. Codex caught this during the phase 3 review.
 */
export const docuSealSubmitterFieldSchema = z
  .object({
    name: z.string().min(1),
    default_value: z.string(),
    readonly: z.boolean(),
  })
  .strict();

export const docuSealSubmitterSchema = z
  .object({
    role: z.string().min(1),
    email: z.string().email(),
    name: z.string().min(1),
    completed: z.boolean().optional(),
    send_email: z.boolean().optional(),
    fields: z.array(docuSealSubmitterFieldSchema),
  })
  .strict();

export const docuSealOutgoingPayloadSchema = z
  .object({
    template_id: z.number().int().positive(),
    send_email: z.boolean(),
    order: z.string().min(1),
    submitters: z.array(docuSealSubmitterSchema).min(1),
  })
  .strict();

export type DocuSealOutgoingPayload = z.infer<
  typeof docuSealOutgoingPayloadSchema
>;

// -----------------------------------------------------------------------
// Legacy types kept for back-compat (Phase 1 exported these)
// -----------------------------------------------------------------------

/** Alias kept for Phase 1 consumers that imported the plain type. */
export type ParsedAnthropicSections = GeneratedSectionsShape;

export interface GenerateSectionsInput {
  prompt: string;
  systemPrompt: string;
  apiKey: string;
  /** Optional fetch override for testing. */
  fetchImpl?: typeof fetch;
}

export interface GenerateSectionsResult {
  rawText: string;
  generatedSections: Record<string, unknown> | null;
  generatedText: string;
}
