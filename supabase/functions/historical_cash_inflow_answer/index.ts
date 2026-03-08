import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai";

import { UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { visualModeInstructions } from "../_shared/visualModePrompt.ts";

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
Qui stai leggendo incassi ricevuti, non valore del lavoro per competenza.
Non inventare dati mancanti.
Non confrontare mai un anno in corso parziale con un anno chiuso completo, salvo che il contesto lo chieda esplicitamente.
Se una risposta non è dimostrabile, dillo chiaramente.
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

## Risposta breve
Massimo 3 frasi molto chiare.

## Perché lo dico
2 o 3 bullet che colleghino la risposta solo ai dati di incasso ricevuto.

## Cosa controllare adesso
1 o 2 controlli pratici solo se davvero utili.
`.trim();

async function answerHistoricalCashInflowQuestion(
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

  const { context, question, model, visualMode } = await req.json();

  if (!context) {
    return createErrorResponse(400, "Missing historical cash inflow context");
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
      input: `Domanda dell'utente:\n${trimmedQuestion}\n\nContesto storico incassi:\n${JSON.stringify(context, null, 2)}`,
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
          blocks: JSON.parse(outputText),
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
    console.error("historical_cash_inflow_answer.error", error);
    return createErrorResponse(
      500,
      "Impossibile ottenere una risposta AI sugli incassi storici",
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
        return answerHistoricalCashInflowQuestion(req, currentUserSale);
      }

      return createErrorResponse(405, "Method Not Allowed");
    }),
  ),
);
