import type {
  ParsedUnifiedCrmTravelExpenseQuestion,
  UnifiedCrmSuggestedAction,
  UnifiedCrmTravelExpenseEstimate,
} from "./unifiedCrmAnswerTypes.ts";
import {
  buildCreateHref,
  buildListHref,
  formatNumber,
  getBusinessTimezone,
  getDefaultKmRate,
  getRoutePrefix,
  normalizeText,
} from "./unifiedCrmAnswerUtils.ts";
import {
  buildImplicitTravelRouteCandidates,
  getTravelRouteSource,
  hasExpenseIntent,
  hasTravelEstimationIntent,
  hasTravelIntent,
  inferDateFromQuestion,
  splitTravelRoute,
} from "./unifiedCrmAnswerIntents.ts";
import { hasRoundTripIntent } from "./unifiedCrmAnswerCreateFlowShared.ts";

export const buildUnifiedCrmTravelExpenseQuestionCandidates = ({
  question,
  context,
}: {
  question: string;
  context: Record<string, unknown>;
}): ParsedUnifiedCrmTravelExpenseQuestion[] => {
  const normalizedQuestion = normalizeText(question);
  const travelIntent = hasTravelIntent(normalizedQuestion);
  const canEstimateRoute =
    hasExpenseIntent(normalizedQuestion) ||
    hasTravelEstimationIntent(normalizedQuestion);

  if (!travelIntent || !canEstimateRoute) {
    return [];
  }

  const routeSource = getTravelRouteSource(question);
  const explicitRoute = splitTravelRoute(routeSource);
  const expenseDate = inferDateFromQuestion(
    question,
    normalizedQuestion,
    getBusinessTimezone(context),
  );
  const routeCandidates =
    explicitRoute && explicitRoute.origin && explicitRoute.destination
      ? [explicitRoute]
      : buildImplicitTravelRouteCandidates(routeSource);

  return routeCandidates.map((route) => ({
    origin: route.origin,
    destination: route.destination,
    isRoundTrip: hasRoundTripIntent(normalizedQuestion),
    expenseDate,
  }));
};

export const parseUnifiedCrmTravelExpenseQuestion = ({
  question,
  context,
}: {
  question: string;
  context: Record<string, unknown>;
}): ParsedUnifiedCrmTravelExpenseQuestion | null =>
  buildUnifiedCrmTravelExpenseQuestionCandidates({
    question,
    context,
  })[0] ?? null;

export const buildUnifiedCrmTravelExpenseEstimate = ({
  context,
  parsedQuestion,
  originLabel,
  destinationLabel,
  oneWayDistanceMeters,
}: {
  context: Record<string, unknown>;
  parsedQuestion: ParsedUnifiedCrmTravelExpenseQuestion;
  originLabel: string;
  destinationLabel: string;
  oneWayDistanceMeters: number;
}): UnifiedCrmTravelExpenseEstimate => {
  const oneWayDistanceKm = Number((oneWayDistanceMeters / 1000).toFixed(2));
  const totalDistanceKm = Number(
    (oneWayDistanceKm * (parsedQuestion.isRoundTrip ? 2 : 1)).toFixed(2),
  );
  const kmRate = getDefaultKmRate(context);
  const reimbursementAmount =
    kmRate != null ? Number((totalDistanceKm * kmRate).toFixed(2)) : null;

  return {
    originQuery: parsedQuestion.origin,
    destinationQuery: parsedQuestion.destination,
    originLabel,
    destinationLabel,
    isRoundTrip: parsedQuestion.isRoundTrip,
    oneWayDistanceKm,
    totalDistanceKm,
    expenseDate: parsedQuestion.expenseDate,
    kmRate,
    reimbursementAmount,
  };
};

export const buildTravelExpenseCreateHref = ({
  routePrefix,
  estimate,
}: {
  routePrefix: string;
  estimate: UnifiedCrmTravelExpenseEstimate;
}) =>
  buildCreateHref(routePrefix, "expenses", {
    expense_type: "spostamento_km",
    expense_date: estimate.expenseDate,
    km_distance: String(estimate.totalDistanceKm),
    km_rate: estimate.kmRate != null ? String(estimate.kmRate) : null,
    description: `Trasferta ${estimate.originQuery} - ${estimate.destinationQuery}${estimate.isRoundTrip ? " A/R" : ""}`,
    launcher_source: "unified_ai_launcher",
    launcher_action: "expense_create_km",
  });

export const buildUnifiedCrmTravelExpenseAnswerMarkdown = ({
  estimate,
}: {
  estimate: UnifiedCrmTravelExpenseEstimate;
}) => {
  const routeLabel = `${estimate.originQuery} - ${estimate.destinationQuery}${
    estimate.isRoundTrip ? " A/R" : ""
  }`;
  const dateLabel = estimate.expenseDate
    ? ` con data proposta ${estimate.expenseDate}`
    : "";
  const reimbursementLine =
    estimate.kmRate != null && estimate.reimbursementAmount != null
      ? `- Con tariffa predefinita ${formatNumber(estimate.kmRate)} EUR/km il rimborso stimato e' ${formatNumber(estimate.reimbursementAmount)} EUR.`
      : null;

  return [
    "## Risposta breve",
    `Per la tratta ${routeLabel} ho stimato ${formatNumber(estimate.totalDistanceKm)} km${estimate.isRoundTrip ? " complessivi" : ""}${dateLabel}.`,
    "",
    "## Dati usati",
    `- Origine risolta tramite routing come ${estimate.originLabel}.`,
    `- Destinazione risolta tramite routing come ${estimate.destinationLabel}.`,
    `- Distanza stimata: ${formatNumber(estimate.oneWayDistanceKm)} km a tratta${estimate.isRoundTrip ? `, quindi ${formatNumber(estimate.totalDistanceKm)} km totali` : ""}.`,
    ...(reimbursementLine ? [reimbursementLine] : []),
    "",
    "## Limiti o prossima azione",
    "- Se il punto preciso di partenza/arrivo o il percorso reale erano diversi, correggi i km nel form prima di salvare.",
    "- Se vuoi registrarla nel CRM, usa l'azione suggerita per aprire Spese gia precompilata: la scrittura non parte direttamente dalla chat.",
  ].join("\n");
};

export const buildUnifiedCrmTravelExpenseSuggestedActions = ({
  context,
  estimate,
}: {
  context: Record<string, unknown>;
  estimate: UnifiedCrmTravelExpenseEstimate;
}): UnifiedCrmSuggestedAction[] => {
  const routePrefix = getRoutePrefix(context);

  return [
    {
      id: "expense-create-km-handoff",
      kind: "approved_action",
      resource: "expenses",
      capabilityActionId: "expense_create_km",
      label: "Registra questa spesa km",
      description:
        "Apre il form spese gia precompilato con tipo spostamento km, data, chilometri, tariffa e descrizione della tratta.",
      href: buildTravelExpenseCreateHref({
        routePrefix,
        estimate,
      }),
      recommended: true,
      recommendationReason:
        "Consigliata perche la tratta e' gia stata risolta e i km possono essere corretti direttamente sulla superficie spese approvata prima del salvataggio.",
    },
    {
      id: "open-expenses-list",
      kind: "list",
      resource: "expenses",
      capabilityActionId: "follow_unified_crm_handoff",
      label: "Apri tutte le spese",
      description:
        "Controlla le spese gia registrate prima di salvare una nuova trasferta km.",
      href: buildListHref(routePrefix, "expenses"),
    },
  ];
};
