import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai";

import { UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { visualModeInstructions } from "../_shared/visualModePrompt.ts";
import {
  parseAiVisualBlocks,
  InvalidAiOutputError,
} from "../_shared/parseAiVisualBlocks.ts";

const defaultHistoricalAnalysisModel = "gpt-5.2";
const allowedModels = new Set(["gpt-5.2", "gpt-5-mini", "gpt-5-nano"]);

const openaiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";

const openai = new OpenAI({
  apiKey: openaiApiKey,
});

const baseInstructions = `
Sei un analista che parla con il titolare del gestionale Rosario Furnari.
Usa solo il contesto JSON fornito.
Qui stai leggendo incassi ricevuti, non valore del lavoro per competenza.
Non inventare dati mancanti.
Non confrontare mai un anno in corso parziale con un anno chiuso completo, salvo che il contesto lo chieda esplicitamente.
Se un confronto non è dimostrabile, dillo chiaramente.
Scrivi in italiano semplice, senza gergo finanziario.
Se devi usare un termine tecnico, spiegalo subito in parole semplici.
Preferisci:
- "anno in corso fino a oggi" invece di "YTD"
- "soldi già ricevuti" invece di "cash inflow"
- "incassi" invece di "competenza" o "fatturato" se il contesto non lo dimostra
Non citare mai codici interni.
`.trim();

const markdownOutputInstructions = `
Rispondi in markdown semplice, con queste sezioni:

## In breve
Spiega cosa raccontano questi incassi in 2 o 3 frasi molto chiare.

## Cose importanti
3 bullet concreti che restino sempre sul tema incassi ricevuti.

## Attenzione
Bullet brevi su anno in corso parziale, limiti del dato e differenza tra incassi e valore del lavoro.

## Cosa controllare adesso
2 o 3 controlli pratici solo se davvero giustificati dal contesto.
`.trim();

async function createHistoricalCashInflowSummary(
  req: Request,
  currentUserSale: unknown,
) {
  if (!openaiApiKey) {
    return createErrorResponse(
      500,
      "OPENAI_API_KEY non configurata nelle Edge Functions",
    );
  }

  if (!currentUserSale) {
    return createErrorResponse(401, "Unauthorized");
  }

  const { context, model, visualMode } = await req.json();

  if (!context) {
    return createErrorResponse(400, "Missing historical cash inflow context");
  }

  const selectedModel =
    typeof model === "string" && allowedModels.has(model)
      ? model
      : defaultHistoricalAnalysisModel;

  const isVisual = visualMode === true;
  const instructions = isVisual
    ? `${baseInstructions}\n\n${visualModeInstructions}`
    : `${baseInstructions}\n\n${markdownOutputInstructions}`;

  try {
    const response = await openai.responses.create({
      model: selectedModel,
      instructions,
      input: `Contesto storico incassi:\n${JSON.stringify(context, null, 2)}`,
      reasoning: {
        effort: "medium",
      },
      max_output_tokens: isVisual ? 2500 : 900,
    });

    const outputText = response.output_text?.trim();

    if (!outputText) {
      return createErrorResponse(
        502,
        "OpenAI ha restituito una risposta vuota",
      );
    }

    const data = isVisual
      ? {
          model: selectedModel,
          generatedAt: new Date().toISOString(),
          blocks: parseAiVisualBlocks(outputText),
        }
      : {
          model: selectedModel,
          generatedAt: new Date().toISOString(),
          summaryMarkdown: outputText,
        };

    return new Response(JSON.stringify({ data }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    if (error instanceof InvalidAiOutputError) {
      return createErrorResponse(502, error.message);
    }
    console.error("historical_cash_inflow_summary.error", error);
    return createErrorResponse(
      500,
      "Impossibile generare l'analisi AI degli incassi storici",
    );
  }
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    UserMiddleware(req, async (_req, user) => {
      const currentUserSale = user ? await getUserSale(user) : null;
      if (!currentUserSale) {
        return createErrorResponse(401, "Unauthorized");
      }

      if (req.method === "POST") {
        return createHistoricalCashInflowSummary(req, currentUserSale);
      }

      return createErrorResponse(405, "Method Not Allowed");
    }),
  ),
);
