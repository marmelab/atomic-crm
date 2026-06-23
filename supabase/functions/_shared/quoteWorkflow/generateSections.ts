/**
 * Shared AI section generation for the quote workflow.
 *
 * Phase 1 extraction — this file is now the ONLY place in the codebase
 * that calls the Anthropic Messages API for quote generation and the ONLY
 * place that parses the response. Both `orchestrate_proposal` and
 * `generate_quote_text` delegate here.
 *
 * Behavioral requirements (verified by tests/workflow baseline):
 *  - Must use the same Anthropic model, max_tokens and headers as before
 *  - Must use the same regex to locate the JSON block inside the response
 *  - Must fall back silently to null generatedSections on parse failure
 *  - Must return proposal_body as generatedText when parse succeeds,
 *    otherwise return rawText unchanged
 *
 * Phase 3 addition — quarantine policy for AI output:
 *  - When the caller passes `validation` input, parsed sections are
 *    validated against `generatedSectionsSchema`. On mismatch:
 *      1. A row is written to `quote_validation_failures` via
 *         `reportValidationFailure` (boundary = 'ai_output',
 *         policy = 'quarantine').
 *      2. If a Discord alert callback is provided, the dev channel is
 *         pinged so someone notices an AI drift.
 *      3. `generatedSections` is returned as `null` so the existing
 *         downstream fallback (normalize → legacy template) kicks in
 *         and production keeps working.
 *  - Callers that do not pass `validation` get legacy behavior.
 */

import { getAnthropicApiUrl } from "../serviceEndpoints.ts";
import { generatedSectionsSchema } from "./schemas.ts";
import type {
  GenerateSectionsInput,
  GenerateSectionsResult,
} from "./schemas.ts";
import {
  reportValidationFailure,
  summarizeZodError,
} from "./validationReporter.ts";

const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_MAX_TOKENS = 3000;
const ANTHROPIC_API_VERSION = "2023-06-01";

/**
 * Parse a raw Anthropic response text into structured sections. This is a
 * direct extraction of the regex previously duplicated in both edge
 * functions — it must match the frozen behavior recorded in
 * tests/workflow/baseline/generated-sections.shape.json.
 *
 * Returns generatedSections=null when no JSON block is found or parsing
 * fails. generatedText is proposal_body when sections were parsed and the
 * body string is non-empty, otherwise rawText unchanged.
 */
export function parseAnthropicSections(rawText: string): {
  generatedSections: Record<string, unknown> | null;
  generatedText: string;
} {
  let generatedSections: Record<string, unknown> | null = null;
  let generatedText = rawText;

  try {
    const jsonMatch = rawText.match(
      /\{[\s\S]*"summary_pitch"[\s\S]*"proposal_body"[\s\S]*\}/,
    );
    if (jsonMatch) {
      generatedSections = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      const body = (generatedSections as { proposal_body?: string })
        .proposal_body;
      if (body) {
        generatedText = body;
      }
    }
  } catch (parseError) {
    // Preserve legacy behavior: log and fall back to raw text.
    console.warn(
      "parseAnthropicSections: JSON parse failed, falling back to plain text:",
      parseError,
    );
    generatedSections = null;
    generatedText = rawText;
  }

  return { generatedSections, generatedText };
}

/**
 * Optional Phase 3 validation hook passed alongside the generation
 * input. When provided, parsed sections are validated against
 * `generatedSectionsSchema` and any mismatch is quarantined (DB write
 * + optional Discord ping) while the generation result falls back to
 * null sections — production keeps running on the legacy template.
 */
export interface AiOutputValidationInput {
  /** Supabase client with an insert into public.quote_validation_failures
   *  (service role). Used by the reporter to persist the failing row. */
  supabase: Parameters<typeof reportValidationFailure>[0]["supabase"];
  /** Quote id if known at call time, null when the quote row has not
   *  been created yet. */
  quoteId: number | null;
  /** Optional Discord alert callback. Invoked only on a quarantine event. */
  notifyDiscord?: (summary: {
    boundary: "ai_output";
    schemaName: string;
    quoteId: number | null;
    validationError: string;
  }) => Promise<void>;
}

/**
 * Call Anthropic with the given prompt pair and return parsed sections.
 * Throws on HTTP failure; callers decide how to surface errors to the user.
 *
 * Phase 3: pass the optional `validation` arg to enable quarantine of
 * shape-mismatched AI output. See the module-level comment for the
 * quarantine policy details.
 */
export async function generateSections(
  input: GenerateSectionsInput & { validation?: AiOutputValidationInput },
): Promise<GenerateSectionsResult> {
  const fetchImpl = input.fetchImpl ?? fetch;

  const response = await fetchImpl(getAnthropicApiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": input.apiKey,
      "anthropic-version": ANTHROPIC_API_VERSION,
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      messages: [{ role: "user", content: input.prompt }],
      system: input.systemPrompt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Claude API error:", errorText);
    throw new Error(`Anthropic API request failed: ${response.status}`);
  }

  const result = (await response.json()) as {
    content?: Array<{ text?: string }>;
  };
  const rawText = result.content?.[0]?.text || "Failed to generate text";

  let { generatedSections, generatedText } = parseAnthropicSections(rawText);

  // Phase 3: quarantine mismatched AI output when a validation hook
  // is wired in. The legacy fallback (null sections → legacy template)
  // still kicks in on failure, so production stays safe.
  if (input.validation && generatedSections) {
    const parseResult = generatedSectionsSchema.safeParse(generatedSections);
    if (!parseResult.success) {
      await reportValidationFailure({
        supabase: input.validation.supabase,
        quoteId: input.validation.quoteId,
        boundary: "ai_output",
        schemaName: "generatedSectionsSchema",
        policy: "quarantine",
        rawInput: generatedSections,
        validationError: summarizeZodError(parseResult.error),
        errorDetails: { issues: parseResult.error.issues },
        notifyDiscord: input.validation.notifyDiscord
          ? (summary) =>
              input.validation!.notifyDiscord!({
                ...summary,
                boundary: "ai_output",
              })
          : undefined,
      });
      generatedSections = null;
      generatedText = rawText;
    }
  }

  return { rawText, generatedSections, generatedText };
}
