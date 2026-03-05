export const unifiedCrmAnswerMaxQuestionLength = 1200;

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
    | "follow_unified_crm_handoff"
    | "workflow_create"
    | "workflow_show";
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

export type UnifiedCrmAnswerPayload = {
  context: Record<string, unknown>;
  question: string;
  model: string;
  conversationHistory?: Array<{
    question: string;
    answerMarkdown: string;
    generatedAt: string;
    model: string;
  }>;
};

export type ParsedUnifiedCrmTravelExpenseQuestion = {
  origin: string;
  destination: string;
  isRoundTrip: boolean;
  expenseDate: string | null;
};

export type UnifiedCrmTravelExpenseEstimate = {
  originQuery: string;
  destinationQuery: string;
  originLabel: string;
  destinationLabel: string;
  isRoundTrip: boolean;
  oneWayDistanceKm: number;
  totalDistanceKm: number;
  expenseDate: string | null;
  kmRate: number | null;
  reimbursementAmount: number | null;
};

export type UnifiedCrmTravelRouteCandidate = {
  origin: string;
  destination: string;
};

export type ParsedUnifiedCrmProjectQuickEpisodeQuestion = {
  projectId: string;
  clientId: string | null;
  projectName: string;
  projectCategory: string | null;
  projectTvShow: string | null;
  requestedLabel: "servizio" | "puntata" | "lavoro";
  serviceDate: string | null;
  serviceType:
    | "riprese"
    | "montaggio"
    | "riprese_montaggio"
    | "fotografia"
    | "sviluppo_web"
    | "altro"
    | null;
  description: string | null;
  notes: string | null;
  isRoundTrip: boolean;
  travelRoute: UnifiedCrmTravelRouteCandidate | null;
  travelRouteCandidates: UnifiedCrmTravelRouteCandidate[];
};

export type ParsedUnifiedCrmExpenseCreateQuestion = {
  clientId: string;
  projectId: string | null;
  clientName: string | null;
  projectName: string | null;
  expenseDate: string | null;
  expenseType: "acquisto_materiale" | "noleggio" | "altro";
  description: string | null;
  amount: number | null;
  markupPercent: number | null;
};
