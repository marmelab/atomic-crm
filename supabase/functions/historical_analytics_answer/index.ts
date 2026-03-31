import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai";

import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
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
const maxQuestionLength = 300;

const openaiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";

const openai = new OpenAI({
  apiKey: openaiApiKey,
});

const baseInstructions = `
Sei un analista che parla con il titolare del gestionale Rosario Furnari.
Usa solo il contesto JSON fornito e la domanda dell'utente.
Non inventare dati mancanti.
Non confrontare mai un anno in corso parziale con un anno chiuso completo, salvo che il contesto lo chieda esplicitamente.
Se una risposta non è dimostrabile, dillo chiaramente.
Scrivi in italiano semplice, senza gergo finanziario.
Se devi usare un termine tecnico, spiegalo subito in parole semplici.
Preferisci:
- "anno in corso fino a oggi" invece di "YTD"
- "crescita rispetto all'anno prima" invece di "YoY"
- "valore del lavoro attribuito a quell'anno" invece di "competenza"
Non citare mai codici interni come "partial_current_year".
`.trim();

const markdownOutputInstructions = `
Rispondi in markdown semplice, con queste sezioni:

## Risposta breve
Massimo 3 frasi molto chiare.

## Perché lo dico
2 o 3 bullet che collegano direttamente la risposta ai dati.

## Cosa controllare adesso
1 o 2 controlli pratici solo se davvero utili.
`.trim();

async function answerHistoricalAnalyticsQuestion(
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

  const { context, question, model, visualMode } = await req.json();

  if (!context) {
    return createErrorResponse(400, "Missing analytics context");
  }

  if (typeof question !== "string" || !question.trim()) {
    return createErrorResponse(400, "La domanda è obbligatoria");
  }

  const trimmedQuestion = question.trim();
  if (trimmedQuestion.length > maxQuestionLength) {
    return createErrorResponse(
      400,
      `La domanda è troppo lunga. Limite: ${maxQuestionLength} caratteri.`,
    );
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
      input: `Domanda dell'utente:\n${trimmedQuestion}\n\nContesto analytics storico:\n${JSON.stringify(context, null, 2)}`,
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
          question: trimmedQuestion,
          model: selectedModel,
          generatedAt: new Date().toISOString(),
          blocks: parseAiVisualBlocks(outputText),
        }
      : {
          question: trimmedQuestion,
          model: selectedModel,
          generatedAt: new Date().toISOString(),
          answerMarkdown: outputText,
        };

    return new Response(JSON.stringify({ data }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    if (error instanceof InvalidAiOutputError) {
      return createErrorResponse(502, error.message);
    }
    console.error("historical_analytics_answer.error", error);
    return createErrorResponse(
      500,
      "Impossibile ottenere una risposta AI sullo storico",
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
          return answerHistoricalAnalyticsQuestion(req, currentUserSale);
        }

        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
