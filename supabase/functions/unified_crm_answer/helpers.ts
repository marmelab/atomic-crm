import { corsHeaders } from "../_shared/cors.ts";
import {
  geocodeOpenRouteLocation,
  getOpenRouteDrivingSummary,
} from "../_shared/googleMapsService.ts";
import {
  buildUnifiedCrmTravelExpenseEstimate,
  type ParsedUnifiedCrmTravelExpenseQuestion,
  type UnifiedCrmPaymentDraft,
  type UnifiedCrmSuggestedAction,
  type UnifiedCrmTravelExpenseEstimate,
} from "../_shared/unifiedCrmAnswer.ts";

export const buildCrmFlowResponse = ({
  question,
  model,
  answerMarkdown,
  suggestedActions,
  paymentDraft = null,
}: {
  question: string;
  model: string;
  answerMarkdown: string;
  suggestedActions: UnifiedCrmSuggestedAction[];
  paymentDraft?: UnifiedCrmPaymentDraft | null;
}) =>
  new Response(
    JSON.stringify({
      data: {
        question,
        model,
        generatedAt: new Date().toISOString(),
        answerMarkdown,
        suggestedActions,
        paymentDraft,
      },
    }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } },
  );

export const resolveTravelEstimate = async ({
  context,
  travelQuestions,
  googleMapsApiKey,
}: {
  context: Record<string, unknown>;
  travelQuestions: ParsedUnifiedCrmTravelExpenseQuestion[];
  googleMapsApiKey: string;
}): Promise<{ estimate: UnifiedCrmTravelExpenseEstimate } | null> => {
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

      return { estimate };
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
