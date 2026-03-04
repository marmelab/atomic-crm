// Barrel re-exports — keeps all existing consumer imports working unchanged.

export type {
  ParsedUnifiedCrmExpenseCreateQuestion,
  ParsedUnifiedCrmProjectQuickEpisodeQuestion,
  ParsedUnifiedCrmTravelExpenseQuestion,
  UnifiedCrmAnswerPayload,
  UnifiedCrmPaymentDraft,
  UnifiedCrmSuggestedAction,
  UnifiedCrmTravelExpenseEstimate,
  UnifiedCrmTravelRouteCandidate,
} from "./unifiedCrmAnswerTypes.ts";

export { unifiedCrmAnswerMaxQuestionLength } from "./unifiedCrmAnswerTypes.ts";

export {
  buildExpenseCreateHref,
  buildProjectQuickEpisodeHref,
  buildServiceCreateHref,
  buildTravelExpenseCreateHref,
  buildUnifiedCrmExpenseCreateAnswerMarkdown,
  buildUnifiedCrmExpenseCreateSuggestedActions,
  buildUnifiedCrmProjectQuickEpisodeAnswerMarkdown,
  buildUnifiedCrmProjectQuickEpisodeSuggestedActions,
  buildUnifiedCrmServiceCreateAnswerMarkdown,
  buildUnifiedCrmServiceCreateSuggestedActions,
  buildUnifiedCrmTravelExpenseAnswerMarkdown,
  buildUnifiedCrmTravelExpenseEstimate,
  buildUnifiedCrmTravelExpenseQuestionCandidates,
  buildUnifiedCrmTravelExpenseSuggestedActions,
  parseUnifiedCrmExpenseCreateQuestion,
  parseUnifiedCrmProjectQuickEpisodeQuestion,
  parseUnifiedCrmTravelExpenseQuestion,
} from "./unifiedCrmAnswerCreateFlows.ts";

export {
  buildUnifiedCrmPaymentDraft,
  buildUnifiedCrmPaymentDraftFromContext,
  buildUnifiedCrmSuggestedActions,
  validateUnifiedCrmAnswerPayload,
} from "./unifiedCrmAnswerSuggestions.ts";
