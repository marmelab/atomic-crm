import { defaultHistoricalAnalysisModel } from "@/lib/analytics/historicalAnalysis";

export const defaultUnifiedCrmAnswerModel = defaultHistoricalAnalysisModel;
export const unifiedCrmQuestionMaxLength = 1200;

import { suggestionCategories } from "./suggestedQuestionCategories";

export const unifiedCrmSuggestedQuestions: readonly string[] =
  suggestionCategories.flatMap((c) => c.questions);

export type UnifiedCrmConversationTurn = {
  question: string;
  answerMarkdown: string;
  generatedAt: string;
  model: string;
};

export type UnifiedCrmSuggestedAction = {
  id: string;
  kind: "page" | "list" | "show" | "approved_action";
  resource:
    | "dashboard"
    | "clients"
    | "contacts"
    | "client_tasks"
    | "quotes"
    | "projects"
    | "services"
    | "payments"
    | "expenses"
    | "workflows";
  label: string;
  description: string;
  href: string;
  recommended?: boolean;
  recommendationReason?: string;
  capabilityActionId?:
    | "quote_create_payment"
    | "client_create_payment"
    | "project_quick_episode"
    | "service_create"
    | "project_quick_payment"
    | "expense_create"
    | "expense_create_km"
    | "task_create"
    | "generate_invoice_draft"
    | "workflow_create"
    | "workflow_show"
    | "follow_unified_crm_handoff";
};

export type UnifiedCrmPaymentDraft = {
  id: string;
  resource: "payments";
  originActionId: "quote_create_payment" | "project_quick_payment";
  draftKind: "payment_create" | "project_quick_payment";
  label: string;
  explanation: string;
  quoteId: string | null;
  clientId: string;
  projectId: string | null;
  paymentType: "acconto" | "saldo" | "parziale" | "rimborso_spese";
  amount: number;
  status: "in_attesa" | "ricevuto";
  href: string;
};

export type UnifiedCrmAnswer = {
  question: string;
  model: string;
  generatedAt: string;
  answerMarkdown: string;
  suggestedActions: UnifiedCrmSuggestedAction[];
  paymentDraft: UnifiedCrmPaymentDraft | null;
};
