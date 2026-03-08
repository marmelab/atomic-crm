import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai";

import {
  buildAnnualOperationsAiGuidance,
  reframeAnnualOperationsQuestion,
} from "../_shared/annualOperationsAiGuidance.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { createErrorResponse } from "../_shared/utils.ts";

const defaultAnalysisModel = "gpt-5.2";
const allowedModels = new Set(["gpt-5.2", "gpt-5-mini", "gpt-5-nano"]);
const maxQuestionLength = 300;

const openaiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";

const openai = new OpenAI({
  apiKey: openaiApiKey,
});

const instructions = `
Sei un analista che parla con il titolare del gestionale Rosario Furnari.
Usa solo il contesto JSON fornito e la domanda dell'utente.
Non inventare dati mancanti.
Scrivi in italiano semplice, senza gergo finanziario.
Se devi usare un termine tecnico, spiegalo subito in parole semplici.
Questo contesto riguarda solo la parte operativa dell'anno scelto.
Non parlare di simulazione fiscale o di alert giornalieri se non compaiono nel contesto.
Distingui sempre:
- "valore del lavoro" = lavoro svolto nell'anno, non incassi
- "pagamenti da ricevere" = soldi attesi, non lavoro gia svolto
- "preventivi aperti" = opportunita potenziali, non ricavi gia acquisiti
- "spese operative" = costi sostenuti nell'anno (esclusi crediti ricevuti), incluso rimborso km calcolato
Se il contesto include la sezione "expenses", usala per dare il quadro completo:
- totale spese e breakdown per tipo
- margine lordo operativo = valore del lavoro - spese operative
Il margine lordo operativo e un indicatore approssimativo, non e il reddito fiscale.
Non confondere mai le spese operative con le tasse o i contributi (che restano fuori da questo contesto).
Se l'anno non e ancora chiuso, spese e margini sono stime provvisorie: dillo esplicitamente, non presentarli come dati definitivi.
Se l'anno scelto e l'anno in corso, ricordati che e letto solo fino alla data indicata.
Se una risposta non e dimostrabile, dillo chiaramente.
Non trasformare mai un valore a 0 in un problema automatico.
Non suggerire dati mancanti o registrazioni mancanti se il contesto non lo prova.
Per anni chiusi, evita formule come "quest'anno", "oggi", "in questo momento" e "futuro".
Per anni chiusi, non parlare della situazione attuale dell'azienda: resta nel perimetro dell'anno selezionato.
Evita frasi assolute come "tutto arriva da", "nessuno", "il punto piu debole e" se il contesto non lo dimostra in modo diretto.
Se la "Interpretazione corretta della domanda" corregge una domanda originale ambigua, segui sempre l'interpretazione corretta.
Non citare mai codici interni come "partial_current_year".
Rispondi in markdown semplice, con queste sezioni:

## Risposta breve
Massimo 3 frasi molto chiare.

## Perche lo dico
2 o 3 bullet che collegano la risposta ai dati operativi.

## Cosa controllare adesso
1 o 2 controlli pratici solo se davvero utili.
`.trim();

async function answerAnnualOperationsQuestion(
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

  const { context, question, model } = await req.json();

  if (!context) {
    return createErrorResponse(400, "Missing annual operations context");
  }

  if (typeof question !== "string" || !question.trim()) {
    return createErrorResponse(400, "La domanda e obbligatoria");
  }

  const trimmedQuestion = question.trim();
  if (trimmedQuestion.length > maxQuestionLength) {
    return createErrorResponse(
      400,
      `La domanda e troppo lunga. Limite: ${maxQuestionLength} caratteri.`,
    );
  }

  const selectedModel =
    typeof model === "string" && allowedModels.has(model)
      ? model
      : defaultAnalysisModel;
  const reframedQuestion = reframeAnnualOperationsQuestion({
    context,
    question: trimmedQuestion,
  });
  const guidance = buildAnnualOperationsAiGuidance({
    mode: "answer",
    context,
    question: trimmedQuestion,
  });

  try {
    const response = await openai.responses.create({
      model: selectedModel,
      instructions,
      input:
        `Domanda dell'utente:\n${trimmedQuestion}\n\n` +
        `Interpretazione corretta della domanda da seguire:\n${reframedQuestion}\n\n` +
        `Regole interpretative obbligatorie:\n${guidance}\n\n` +
        `Contesto operativo annuale:\n${JSON.stringify(context, null, 2)}`,
      reasoning: {
        effort: "medium",
      },
      max_output_tokens: 1500,
    });

    const answerMarkdown = response.output_text?.trim();

    if (!answerMarkdown) {
      return createErrorResponse(
        502,
        "OpenAI ha restituito una risposta vuota",
      );
    }

    return new Response(
      JSON.stringify({
        data: {
          question: trimmedQuestion,
          model: selectedModel,
          generatedAt: new Date().toISOString(),
          answerMarkdown,
        },
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error) {
    console.error("annual_operations_answer.error", error);
    return createErrorResponse(
      500,
      "Impossibile ottenere una risposta AI sulla vista Annuale",
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
          return answerAnnualOperationsQuestion(req, currentUserSale);
        }

        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
