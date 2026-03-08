import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai";

import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { OptionsMiddleware } from "../_shared/cors.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import {
  buildUnifiedCrmExpenseCreateAnswerMarkdown,
  buildUnifiedCrmExpenseCreateSuggestedActions,
  buildUnifiedCrmInvoiceDraftAnswerMarkdown,
  buildUnifiedCrmInvoiceDraftSuggestedActions,
  buildUnifiedCrmPaymentDraftFromContext,
  buildUnifiedCrmProjectQuickEpisodeAnswerMarkdown,
  buildUnifiedCrmProjectQuickEpisodeSuggestedActions,
  buildUnifiedCrmServiceCreateAnswerMarkdown,
  buildUnifiedCrmServiceCreateSuggestedActions,
  buildUnifiedCrmSuggestedActions,
  buildUnifiedCrmTravelExpenseAnswerMarkdown,
  buildUnifiedCrmTravelExpenseQuestionCandidates,
  buildUnifiedCrmTravelExpenseSuggestedActions,
  parseUnifiedCrmExpenseCreateQuestion,
  parseUnifiedCrmInvoiceDraftQuestion,
  parseUnifiedCrmProjectQuickEpisodeQuestion,
  validateUnifiedCrmAnswerPayload,
} from "../_shared/unifiedCrmAnswer.ts";
import { createErrorResponse } from "../_shared/utils.ts";

import { buildCrmFlowResponse, resolveTravelEstimate } from "./helpers.ts";
import {
  buildMissingOpenAiAnswerMarkdown,
  unifiedCrmInstructions,
} from "./prompt.ts";

const defaultAnalysisModel = "gpt-5.2";
const allowedModels = new Set(["gpt-5.2", "gpt-5-mini", "gpt-5-nano"]);

const openaiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
const googleMapsApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "";

const openai = new OpenAI({
  apiKey: openaiApiKey,
});

async function handleCreateFlows(
  question: string,
  context: Record<string, unknown>,
) {
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
            googleMapsApiKey,
          })
        : null;

    const isTvProject =
      quickEpisodeQuestion.projectCategory === "produzione_tv" ||
      quickEpisodeQuestion.projectTvShow !== null;

    if (!isTvProject) {
      return buildCrmFlowResponse({
        question,
        model: travelEstimateResult ? "google-maps" : "crm_rule_engine",
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
      });
    }

    return buildCrmFlowResponse({
      question,
      model: travelEstimateResult ? "google-maps" : "crm_rule_engine",
      answerMarkdown: buildUnifiedCrmProjectQuickEpisodeAnswerMarkdown({
        parsedQuestion: quickEpisodeQuestion,
        estimate: travelEstimateResult?.estimate ?? null,
      }),
      suggestedActions: buildUnifiedCrmProjectQuickEpisodeSuggestedActions({
        context,
        parsedQuestion: quickEpisodeQuestion,
        estimate: travelEstimateResult?.estimate ?? null,
      }),
    });
  }

  const travelExpenseQuestions = buildUnifiedCrmTravelExpenseQuestionCandidates(
    { question, context },
  );

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
      googleMapsApiKey,
    });

    if (travelEstimateResult) {
      return buildCrmFlowResponse({
        question,
        model: "google-maps",
        answerMarkdown: buildUnifiedCrmTravelExpenseAnswerMarkdown({
          estimate: travelEstimateResult.estimate,
        }),
        suggestedActions: buildUnifiedCrmTravelExpenseSuggestedActions({
          context,
          estimate: travelEstimateResult.estimate,
        }),
      });
    }
  }

  if (genericExpenseQuestion) {
    return buildCrmFlowResponse({
      question,
      model: "crm_rule_engine",
      answerMarkdown: buildUnifiedCrmExpenseCreateAnswerMarkdown({
        parsedQuestion: genericExpenseQuestion,
      }),
      suggestedActions: buildUnifiedCrmExpenseCreateSuggestedActions({
        context,
        parsedQuestion: genericExpenseQuestion,
      }),
    });
  }

  const invoiceDraftQuestion = parseUnifiedCrmInvoiceDraftQuestion({
    question,
    context,
  });

  if (invoiceDraftQuestion) {
    return buildCrmFlowResponse({
      question,
      model: "crm_rule_engine",
      answerMarkdown: buildUnifiedCrmInvoiceDraftAnswerMarkdown({
        parsedQuestion: invoiceDraftQuestion,
      }),
      suggestedActions: buildUnifiedCrmInvoiceDraftSuggestedActions({
        context,
        parsedQuestion: invoiceDraftQuestion,
      }),
    });
  }

  return null;
}

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
    const createFlowResponse = await handleCreateFlows(question, context);
    if (createFlowResponse) return createFlowResponse;

    const suggestedActions = buildUnifiedCrmSuggestedActions({
      question,
      context,
    });
    const paymentDraft = buildUnifiedCrmPaymentDraftFromContext({
      question,
      context,
    });

    if (!openaiApiKey) {
      return buildCrmFlowResponse({
        question,
        model: "crm_readonly_fallback",
        answerMarkdown: buildMissingOpenAiAnswerMarkdown(),
        suggestedActions,
        paymentDraft,
      });
    }

    const contextJson = JSON.stringify(context);

    const response = await openai.responses.create({
      model: selectedModel,
      instructions: unifiedCrmInstructions,
      input:
        (conversationHistory && conversationHistory.length > 0
          ? `Conversazione recente nel launcher (dal piu vecchio al piu nuovo):\n${JSON.stringify(
              conversationHistory,
              null,
              2,
            )}\n\n`
          : "") +
        `Domanda dell'utente:\n${question}\n\n` +
        `Contesto CRM unificato read-only:\n${contextJson}`,
      max_output_tokens: 2000,
    });

    const answerMarkdown = response.output_text?.trim() ?? "";

    if (!answerMarkdown) {
      console.error("unified_crm_answer.empty_output", {
        status: response.status,
        model: response.model,
        outputLength: response.output?.length ?? 0,
        contextLength: contextJson.length,
      });
      return createErrorResponse(
        502,
        "OpenAI ha restituito una risposta vuota. Riprova tra qualche secondo.",
      );
    }

    return buildCrmFlowResponse({
      question,
      model: selectedModel,
      answerMarkdown,
      suggestedActions,
      paymentDraft,
    });
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
