import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai";

import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { visualModeInstructions } from "../_shared/visualModePrompt.ts";

const defaultHistoricalAnalysisModel = "gpt-5.2";
const allowedModels = new Set(["gpt-5.2", "gpt-5-mini", "gpt-5-nano"]);

const openaiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";

const openai = new OpenAI({
  apiKey: openaiApiKey,
});

const baseInstructions = `
Sei un analista che parla con il titolare del gestionale Rosario Furnari.
Usa solo il contesto JSON fornito.
Non inventare dati mancanti.
Non confrontare mai un anno YTD con un anno chiuso completo, salvo che il contesto lo chieda esplicitamente.
Se un confronto non è dimostrabile, dillo chiaramente.
Scrivi in italiano semplice, senza gergo finanziario.
Se devi usare un termine tecnico, spiegalo subito in parole semplici.
Preferisci:
- "anno in corso fino a oggi" invece di "YTD"
- "crescita rispetto all'anno prima" invece di "YoY"
- "valore del lavoro attribuito a quell'anno" invece di "competenza"
Non citare mai codici interni come "partial_current_year".
`.trim();

const markdownOutputInstructions = `
Scrivi in markdown semplice, con queste sezioni:

## In breve
Spiega cosa sta succedendo nell'azienda in 2 o 3 frasi molto chiare.

## Cose importanti
3 bullet concreti, comprensibili anche da chi non ha basi di analisi dati.

## Attenzione
Bullet brevi su limiti, anno in corso parziale, confronti corretti e caveat del contesto.

## Cosa controllare adesso
2 o 3 verifiche operative utili.
`.trim();

async function createHistoricalAnalyticsSummary(
  req: Request,
  currentUserSale: any,
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
    return createErrorResponse(400, "Missing analytics context");
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
      input: `Contesto analytics storico:\n${JSON.stringify(context, null, 2)}`,
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
          blocks: JSON.parse(outputText),
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
    console.error("historical_analytics_summary.error", error);
    return createErrorResponse(
      500,
      "Impossibile generare l'analisi AI dello storico",
    );
  }
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user) => {
        const currentUserSale = user ? await getUserSale(user) : null;
        if (!currentUserSale) {
          return createErrorResponse(401, "Unauthorized");
        }

        if (req.method === "POST") {
          return createHistoricalAnalyticsSummary(req, currentUserSale);
        }

        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
