/**
 * generateReportContent — anropar Anthropic för månadsrapportens kundtext.
 *
 * Speglar generateSections.ts (samma model, headers, max_tokens, endpoint via
 * getAnthropicApiUrl), men med EGET parse-regex och Zod-schema eftersom
 * generateSections är hårt knuten till offert-fälten summary_pitch/proposal_body.
 *
 * Vid schema-miss → quarantine via reportValidationFailure (DB-rad + valfri
 * Discord-ping) och content returneras som null så att anroparen markerar
 * rapporten 'failed' i stället för att skicka ett halvfärdigt mail.
 */

import { getAnthropicApiUrl } from "../serviceEndpoints.ts";
import {
  reportValidationFailure,
  summarizeZodError,
} from "../quoteWorkflow/validationReporter.ts";
import { monthlyReportContentSchema } from "./reportSchemas.ts";
import type { ReportAiContent } from "./types.ts";

// Behåll samma modell/parametrar som offert-pipelinen för konsekvens.
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const ANTHROPIC_MAX_TOKENS = 1500;
const ANTHROPIC_API_VERSION = "2023-06-01";

export interface GenerateReportContentInput {
  prompt: string;
  systemPrompt: string;
  apiKey: string;
  /** Tillåt injektion i tester. */
  fetchImpl?: typeof fetch;
  /** Quarantine-hook (samma mönster som generateSections). */
  validation?: {
    supabase: Parameters<typeof reportValidationFailure>[0]["supabase"];
    notifyDiscord?: (summary: {
      schemaName: string;
      validationError: string;
    }) => Promise<void>;
  };
}

export interface GenerateReportContentResult {
  content: ReportAiContent | null;
  rawText: string;
}

/** Plockar ut JSON-objektet med rapport-fälten ur AI-svaret. */
export function parseReportContent(rawText: string): ReportAiContent | null {
  try {
    const match = rawText.match(
      /\{[\s\S]*"greeting"[\s\S]*"recommended_action"[\s\S]*\}/,
    );
    if (!match) return null;
    return JSON.parse(match[0]) as ReportAiContent;
  } catch (error) {
    console.warn("parseReportContent: JSON parse failed:", error);
    return null;
  }
}

export async function generateReportContent(
  input: GenerateReportContentInput,
): Promise<GenerateReportContentResult> {
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
    console.error("generateReportContent: Claude API error:", errorText);
    // Ta med Anthropics meddelande (t.ex. "credit balance is too low") så
    // orsaken syns i monthly_reports.error utan att behöva läsa edge-loggen.
    throw new Error(
      `Anthropic API request failed: ${response.status} — ${errorText.slice(0, 300)}`,
    );
  }

  const result = (await response.json()) as {
    content?: Array<{ text?: string }>;
  };
  const rawText = result.content?.[0]?.text || "";

  const parsed = parseReportContent(rawText);
  if (!parsed) {
    if (input.validation) {
      await reportValidationFailure({
        supabase: input.validation.supabase,
        quoteId: null,
        boundary: "ai_output",
        schemaName: "monthlyReportContentSchema",
        policy: "quarantine",
        rawInput: { rawText: rawText.slice(0, 2000) },
        validationError: "could not parse JSON from AI response",
        notifyDiscord: input.validation.notifyDiscord
          ? (s) =>
              input.validation!.notifyDiscord!({
                schemaName: s.schemaName,
                validationError: s.validationError,
              })
          : undefined,
      });
    }
    return { content: null, rawText };
  }

  const validated = monthlyReportContentSchema.safeParse(parsed);
  if (!validated.success) {
    if (input.validation) {
      await reportValidationFailure({
        supabase: input.validation.supabase,
        quoteId: null,
        boundary: "ai_output",
        schemaName: "monthlyReportContentSchema",
        policy: "quarantine",
        rawInput: parsed,
        validationError: summarizeZodError(validated.error),
        errorDetails: { issues: validated.error.issues },
        notifyDiscord: input.validation.notifyDiscord
          ? (s) =>
              input.validation!.notifyDiscord!({
                schemaName: s.schemaName,
                validationError: s.validationError,
              })
          : undefined,
      });
    }
    return { content: null, rawText };
  }

  return { content: validated.data, rawText };
}
