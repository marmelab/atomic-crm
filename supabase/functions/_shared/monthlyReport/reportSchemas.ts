/**
 * Zod-schema för AI-genererat månadsrapport-innehåll.
 *
 * Speglar mönstret i quoteWorkflow/schemas.ts. Validering sker i
 * generateReportContent.ts; vid miss → quarantine (DB + Discord) och rapporten
 * markeras 'failed' i stället för att skicka ett halvfärdigt mail.
 *
 * Runtime-import: `npm:zod@4` (fungerar i Deno + aliasas i vitest.functions.config.ts).
 */

import { z } from "npm:zod@4";

export const monthlyReportContentSchema = z
  .object({
    /** Hälsningsfras, t.ex. "Hej Anna," */
    greeting: z.string().min(1),
    /** 1–2 meningar om månadens utveckling, kundvänt. */
    summary: z.string().min(1),
    /** Exakt EN rekommenderad åtgärd, kopplad till den valda upsellen. */
    recommended_action: z.string().min(1),
    /** Motivering för den föreslagna tjänsten (utan pris). */
    upsell_pitch: z.string().min(1),
  })
  .strict();

export type MonthlyReportContent = z.infer<typeof monthlyReportContentSchema>;
