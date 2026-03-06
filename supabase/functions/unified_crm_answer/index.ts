import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai";

import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import {
  geocodeOpenRouteLocation,
  getOpenRouteDrivingSummary,
} from "../_shared/googleMapsService.ts";
import {
  buildUnifiedCrmExpenseCreateAnswerMarkdown,
  buildUnifiedCrmExpenseCreateSuggestedActions,
  buildUnifiedCrmProjectQuickEpisodeAnswerMarkdown,
  buildUnifiedCrmProjectQuickEpisodeSuggestedActions,
  buildUnifiedCrmPaymentDraftFromContext,
  buildUnifiedCrmServiceCreateAnswerMarkdown,
  buildUnifiedCrmServiceCreateSuggestedActions,
  buildUnifiedCrmTravelExpenseQuestionCandidates,
  buildUnifiedCrmTravelExpenseAnswerMarkdown,
  buildUnifiedCrmTravelExpenseEstimate,
  buildUnifiedCrmTravelExpenseSuggestedActions,
  buildUnifiedCrmSuggestedActions,
  parseUnifiedCrmExpenseCreateQuestion,
  parseUnifiedCrmProjectQuickEpisodeQuestion,
  type ParsedUnifiedCrmTravelExpenseQuestion,
  validateUnifiedCrmAnswerPayload,
} from "../_shared/unifiedCrmAnswer.ts";
import { createErrorResponse } from "../_shared/utils.ts";

const defaultAnalysisModel = "gpt-5.2";
const allowedModels = new Set(["gpt-5.2", "gpt-5-mini", "gpt-5-nano"]);

const openaiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
const googleMapsApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "";

const openai = new OpenAI({
  apiKey: openaiApiKey,
});

const instructions = `
Sei l'assistente operativo read-only del CRM Rosario Furnari.

STILE: sii CONCISO. Preferisci elenchi puntati. Vai dritto al punto. Niente introduzioni o preamboli inutili. Ma quando ci sono clausole, note o avvertenze importanti, dille chiaramente.

Usa solo il contesto JSON fornito e la domanda dell'utente.
Il contesto e una snapshot CRM-wide con:
- conteggi e totali principali
- clienti recenti
- referenti recenti e loro recapiti principali
- preventivi aperti
- progetti attivi con relazioni cliente/referente gia strutturate e i singoli servizi per progetto (max 20 per progetto, ordinati per data). Ogni servizio ha: description (titolo breve, es. "SPOT GS 2026"), serviceType, amount, serviceDate e notes (annotazioni operative). Usa description per identificare il servizio e notes per dettagli operativi — sono campi distinti
- pagamenti pendenti e scaduti
- spese recenti
- servizi client-level (senza progetto, collegati direttamente al cliente — es. conguagli, crediti, compensi extra non legati a un progetto)
- clientFinancials: aggregato per cliente con totalFees, totalPaid, balanceDue e hasUninvoicedServices
- activeWorkflows: automazioni attive che eseguono azioni automatiche su eventi CRM (promemoria, email, notifiche, creazione progetto)
- registri semantico e capability
Il CRM ha un sistema automatico di scadenze fiscali (regime forfettario) che ogni giorno calcola F24, INPS, bollo e dichiarazione redditi partendo dai pagamenti ricevuti e dalla configurazione fiscale. Le scadenze vengono create come promemoria (task di tipo f24, inps, bollo, dichiarazione) e notificate via email/WhatsApp quando imminenti. Se l'utente chiede di scadenze, tasse o obblighi fiscali, spiega che il sistema li gestisce automaticamente e indirizza verso i promemoria fiscali o la configurazione.
Non inventare dati mancanti.
Non fingere di aver letto tabelle o moduli che non sono nel contesto.
Non mostrare MAI ID interni, UUID o riferimenti tecnici nelle risposte: usa solo nomi, date e importi leggibili.
Quando nel contesto esistono referenti, clienti e progetti collegati, usa sempre quelle relazioni strutturate come fonte primaria invece di inferirle da note libere o dal solo testo dei nomi.
Quando l'utente chiede qualcosa che potrebbe essere automatizzato (es. "quando un preventivo viene accettato crea un progetto"), verifica prima se nelle activeWorkflows della snapshot esiste gia un'automazione equivalente: se si, segnalala senza proporne una nuova; se no, suggerisci di crearne una e spiega quali trigger, evento e azione verranno precompilati nel form coerentemente con lo scopo descritto.
Se la domanda richiede dati fuori dalla snapshot, dillo chiaramente.
Se la domanda chiede di creare, modificare, inviare o cancellare qualcosa, spiega chiaramente che questo flow e solo read-only e che le scritture devono passare da workflow dedicati con conferma esplicita.
Se la domanda chiede di preparare o registrare un pagamento, non proporre bozze testuali tipo email o messaggio e non serializzare JSON o campi strutturati nel markdown: limita il markdown a descrivere il perimetro read-only e il fatto che sotto puo apparire una bozza pagamento strutturata preparata dal sistema.
Non scrivere URL, route o istruzioni di navigazione tecniche dentro il markdown: gli handoff verso il CRM vengono aggiunti separatamente dal sistema.
Quando la domanda riguarda importi, soldi dovuti o pagamenti, elenca SEMPRE ogni singola voce con importo, progetto (o "senza progetto") e descrizione/note — non raggruppare ne omettere voci.
Per "quanto mi deve X?": usa clientFinancials per i totali (balanceDue) e poi elenca le voci. Se balanceDue > 0 e hasUninvoicedServices e true, suggerisci di generare la bozza fattura.
Scrivi in italiano semplice, senza gergo tecnico inutile.
Rispondi in markdown semplice, con queste sezioni:

## Risposta
Massimo 2-3 frasi o elenco puntato. Vai dritto al punto.

## Dettaglio
Elenco puntato che collega la risposta ai dati della snapshot. Se ci sono voci finanziarie, elencale tutte singolarmente.

## Note
Solo se c'e' qualcosa di importante: limiti, azioni necessarie, avvertenze. Se la richiesta sarebbe una scrittura, ricorda che serve un workflow confermato. Ometti se non serve.
`.trim();

const buildMissingOpenAiAnswerMarkdown = () =>
  `
## Risposta breve
La risposta AI generativa non e disponibile in questo runtime locale.

## Dati usati
- La domanda e il contesto CRM read-only sono stati ricevuti correttamente.
- Gli handoff strutturati sotto restano disponibili anche senza modello generativo.

## Limiti o prossima azione
- Per le domande generiche serve configurare \`OPENAI_API_KEY\` nelle Edge Functions locali.
- In alternativa usa una richiesta operativa gia coperta dal rule engine oppure gli handoff suggeriti sotto.
`.trim();

const resolveTravelEstimate = async ({
  context,
  travelQuestions,
}: {
  context: Record<string, unknown>;
  travelQuestions: ParsedUnifiedCrmTravelExpenseQuestion[];
}) => {
  if (!googleMapsApiKey) {
    return null;
  }

  for (const travelQuestion of travelQuestions) {
    try {
      const [origin, destination] = await Promise.all([
        geocodeOpenRouteLocation({
          apiKey: googleMapsApiKey,

          text: travelQuestion.origin,
        }),
        geocodeOpenRouteLocation({
          apiKey: googleMapsApiKey,

          text: travelQuestion.destination,
        }),
      ]);
      const route = await getOpenRouteDrivingSummary({
        apiKey: googleMapsApiKey,

        coordinates: [
          [origin.longitude, origin.latitude],
          [destination.longitude, destination.latitude],
        ],
      });
      const estimate = buildUnifiedCrmTravelExpenseEstimate({
        context,
        parsedQuestion: travelQuestion,
        originLabel: origin.label,
        destinationLabel: destination.label,
        oneWayDistanceMeters: route.distanceMeters,
      });

      return {
        estimate,
      };
    } catch (travelError) {
      console.warn(
        "unified_crm_answer.travel_route_candidate_failed",
        travelQuestion,
        travelError,
      );
    }
  }

  return null;
};

async function answerUnifiedCrmQuestion(
  req: Request,
  currentUserSale: unknown,
) {
  if (!currentUserSale) {
    return createErrorResponse(401, "Unauthorized");
  }

  const payloadResult = validateUnifiedCrmAnswerPayload(await req.json());

  if (payloadResult.error || !payloadResult.data) {
    return createErrorResponse(
      400,
      payloadResult.error ?? "Payload non valido",
    );
  }

  const { context, question, model, conversationHistory } = payloadResult.data;
  const selectedModel =
    typeof model === "string" && allowedModels.has(model)
      ? model
      : defaultAnalysisModel;

  try {
    const quickEpisodeQuestion = parseUnifiedCrmProjectQuickEpisodeQuestion({
      question,
      context,
    });
    const genericExpenseQuestion = parseUnifiedCrmExpenseCreateQuestion({
      question,
      context,
    });

    if (quickEpisodeQuestion) {
      const quickEpisodeTravelQuestions = (
        quickEpisodeQuestion.travelRoute
          ? [quickEpisodeQuestion.travelRoute]
          : quickEpisodeQuestion.travelRouteCandidates
      ).map((route) => ({
        origin: route.origin,
        destination: route.destination,
        isRoundTrip: quickEpisodeQuestion.isRoundTrip,
        expenseDate: quickEpisodeQuestion.serviceDate,
      }));

      const travelEstimateResult =
        quickEpisodeTravelQuestions.length > 0
          ? await resolveTravelEstimate({
              context,
              travelQuestions: quickEpisodeTravelQuestions,
            })
          : null;

      const isTvProject =
        quickEpisodeQuestion.projectCategory === "produzione_tv" ||
        quickEpisodeQuestion.projectTvShow !== null;

      if (!isTvProject) {
        return new Response(
          JSON.stringify({
            data: {
              question,
              model: travelEstimateResult ? "google-maps" : "crm_rule_engine",
              generatedAt: new Date().toISOString(),
              answerMarkdown: buildUnifiedCrmServiceCreateAnswerMarkdown({
                parsedQuestion: quickEpisodeQuestion,
                estimate: travelEstimateResult?.estimate ?? null,
                linkedExpenseDraft: genericExpenseQuestion,
              }),
              suggestedActions: buildUnifiedCrmServiceCreateSuggestedActions({
                context,
                parsedQuestion: quickEpisodeQuestion,
                estimate: travelEstimateResult?.estimate ?? null,
                linkedExpenseDraft: genericExpenseQuestion,
              }),
              paymentDraft: null,
            },
          }),
          {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      return new Response(
        JSON.stringify({
          data: {
            question,
            model: travelEstimateResult ? "google-maps" : "crm_rule_engine",
            generatedAt: new Date().toISOString(),
            answerMarkdown: buildUnifiedCrmProjectQuickEpisodeAnswerMarkdown({
              parsedQuestion: quickEpisodeQuestion,
              estimate: travelEstimateResult?.estimate ?? null,
            }),
            suggestedActions:
              buildUnifiedCrmProjectQuickEpisodeSuggestedActions({
                context,
                parsedQuestion: quickEpisodeQuestion,
                estimate: travelEstimateResult?.estimate ?? null,
              }),
            paymentDraft: null,
          },
        }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const travelExpenseQuestions =
      buildUnifiedCrmTravelExpenseQuestionCandidates({
        question,
        context,
      });

    if (travelExpenseQuestions.length > 0) {
      if (!googleMapsApiKey) {
        return createErrorResponse(
          500,
          "GOOGLE_MAPS_API_KEY non configurata nelle Edge Functions",
        );
      }

      const travelEstimateResult = await resolveTravelEstimate({
        context,
        travelQuestions: travelExpenseQuestions,
      });

      if (travelEstimateResult) {
        return new Response(
          JSON.stringify({
            data: {
              question,
              model: "google-maps",
              generatedAt: new Date().toISOString(),
              answerMarkdown: buildUnifiedCrmTravelExpenseAnswerMarkdown({
                estimate: travelEstimateResult.estimate,
              }),
              suggestedActions: buildUnifiedCrmTravelExpenseSuggestedActions({
                context,
                estimate: travelEstimateResult.estimate,
              }),
              paymentDraft: null,
            },
          }),
          {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }
    }

    if (genericExpenseQuestion) {
      return new Response(
        JSON.stringify({
          data: {
            question,
            model: "crm_rule_engine",
            generatedAt: new Date().toISOString(),
            answerMarkdown: buildUnifiedCrmExpenseCreateAnswerMarkdown({
              parsedQuestion: genericExpenseQuestion,
            }),
            suggestedActions: buildUnifiedCrmExpenseCreateSuggestedActions({
              context,
              parsedQuestion: genericExpenseQuestion,
            }),
            paymentDraft: null,
          },
        }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const suggestedActions = buildUnifiedCrmSuggestedActions({
      question,
      context,
    });
    const paymentDraft = buildUnifiedCrmPaymentDraftFromContext({
      question,
      context,
    });

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({
          data: {
            question,
            model: "crm_readonly_fallback",
            generatedAt: new Date().toISOString(),
            answerMarkdown: buildMissingOpenAiAnswerMarkdown(),
            suggestedActions,
            paymentDraft,
          },
        }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const response = await openai.responses.create({
      model: selectedModel,
      instructions,
      input:
        (conversationHistory && conversationHistory.length > 0
          ? `Conversazione recente nel launcher (dal piu vecchio al piu nuovo):\n${JSON.stringify(
              conversationHistory,
              null,
              2,
            )}\n\n`
          : "") +
        `Domanda dell'utente:\n${question}\n\n` +
        `Contesto CRM unificato read-only:\n${JSON.stringify(context, null, 2)}`,
      reasoning: {
        effort: "medium",
      },
      max_output_tokens: 1200,
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
          question,
          model: selectedModel,
          generatedAt: new Date().toISOString(),
          answerMarkdown,
          suggestedActions,
          paymentDraft,
        },
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error) {
    console.error("unified_crm_answer.error", error);
    return createErrorResponse(
      500,
      "Impossibile ottenere una risposta AI sul CRM unificato",
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
          return answerUnifiedCrmQuestion(req, currentUserSale);
        }

        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
