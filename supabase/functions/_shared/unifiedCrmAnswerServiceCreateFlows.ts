import type {
  ParsedUnifiedCrmExpenseCreateQuestion,
  ParsedUnifiedCrmProjectQuickEpisodeQuestion,
  UnifiedCrmSuggestedAction,
  UnifiedCrmTravelExpenseEstimate,
} from "./unifiedCrmAnswerTypes.ts";
import { getProjectQuickEpisodeServiceTypeLabel } from "./unifiedCrmAnswerIntents.ts";
import {
  buildCreateHref,
  buildShowHref,
  formatIsoDateForHumans,
  formatNumber,
  getRoutePrefix,
} from "./unifiedCrmAnswerUtils.ts";
import { getRequestedWorkLabelInfo } from "./unifiedCrmAnswerCreateFlowShared.ts";
import { buildExpenseCreateHref } from "./unifiedCrmAnswerExpenseCreateFlows.ts";

const buildServiceCreateSummaryLine = ({
  parsedQuestion,
  estimate,
}: {
  parsedQuestion: ParsedUnifiedCrmProjectQuickEpisodeQuestion;
  estimate?: UnifiedCrmTravelExpenseEstimate | null;
}) => {
  const { article } = getRequestedWorkLabelInfo(parsedQuestion.requestedLabel);
  const dateLabel = formatIsoDateForHumans(parsedQuestion.serviceDate);
  const serviceTypeLabel = getProjectQuickEpisodeServiceTypeLabel(
    parsedQuestion.serviceType,
  );

  if (estimate != null) {
    return `Da qui non salvo direttamente, ma ti apro Servizi gia collegato al progetto ${parsedQuestion.projectName} per registrare ${article}${dateLabel ? ` del ${dateLabel}` : ""}${serviceTypeLabel ? ` come ${serviceTypeLabel}` : ""}, con ${formatNumber(estimate.totalDistanceKm)} km gia stimati.`;
  }

  return `Da qui non salvo direttamente, ma ti apro Servizi gia collegato al progetto ${parsedQuestion.projectName} per registrare ${article}${dateLabel ? ` del ${dateLabel}` : ""}${serviceTypeLabel ? ` come ${serviceTypeLabel}` : ""}.`;
};

const buildServiceCreateEvidenceLines = ({
  parsedQuestion,
  estimate,
  linkedExpenseDraft,
}: {
  parsedQuestion: ParsedUnifiedCrmProjectQuickEpisodeQuestion;
  estimate?: UnifiedCrmTravelExpenseEstimate | null;
  linkedExpenseDraft?: ParsedUnifiedCrmExpenseCreateQuestion | null;
}) => [
  `- Nello snapshot c'e' un progetto attivo compatibile: ${parsedQuestion.projectName}.`,
  ...(parsedQuestion.description
    ? [
        `- Dalla richiesta ho estratto la descrizione del servizio "${parsedQuestion.description}".`,
      ]
    : []),
  ...(parsedQuestion.notes
    ? [
        `- Dalla richiesta ho estratto la nota operativa "${parsedQuestion.notes}".`,
      ]
    : []),
  ...(estimate != null
    ? [
        `- Tratta risolta via routing: ${estimate.originLabel} -> ${estimate.destinationLabel}, quindi ${formatNumber(estimate.totalDistanceKm)} km totali.`,
      ]
    : []),
  ...(linkedExpenseDraft?.description
    ? [
        `- Ho rilevato anche una spesa extra non km: ${linkedExpenseDraft.description}${linkedExpenseDraft.amount != null ? ` (${formatNumber(linkedExpenseDraft.amount)} EUR)` : ""}.`,
      ]
    : []),
];

export const buildServiceCreateHref = ({
  context,
  parsedQuestion,
  estimate,
}: {
  context: Record<string, unknown>;
  parsedQuestion: ParsedUnifiedCrmProjectQuickEpisodeQuestion;
  estimate?: UnifiedCrmTravelExpenseEstimate | null;
}) =>
  buildCreateHref(getRoutePrefix(context), "services", {
    project_id: parsedQuestion.projectId,
    service_date: parsedQuestion.serviceDate,
    service_type: parsedQuestion.serviceType,
    description: parsedQuestion.description,
    km_distance: estimate != null ? String(estimate.totalDistanceKm) : null,
    km_rate: estimate?.kmRate != null ? String(estimate.kmRate) : null,
    location:
      estimate?.destinationQuery ??
      parsedQuestion.travelRoute?.destination ??
      undefined,
    notes: parsedQuestion.notes,
    launcher_source: "unified_ai_launcher",
    launcher_action: "service_create",
  });

export const buildUnifiedCrmServiceCreateAnswerMarkdown = ({
  parsedQuestion,
  estimate,
  linkedExpenseDraft,
}: {
  parsedQuestion: ParsedUnifiedCrmProjectQuickEpisodeQuestion;
  estimate?: UnifiedCrmTravelExpenseEstimate | null;
  linkedExpenseDraft?: ParsedUnifiedCrmExpenseCreateQuestion | null;
}) =>
  [
    "## Risposta breve",
    buildServiceCreateSummaryLine({
      parsedQuestion,
      estimate,
    }),
    "",
    "## Dati usati",
    ...buildServiceCreateEvidenceLines({
      parsedQuestion,
      estimate,
      linkedExpenseDraft,
    }),
    "",
    "## Limiti o prossima azione",
    "- La chat resta read-only: la scrittura reale parte solo dal form Servizi con conferma esplicita.",
    linkedExpenseDraft
      ? "- Per la spesa extra non km ti propongo anche Spese gia collegata a cliente/progetto, perche' fuori dal TV non conviene forzare un mega-form unico."
      : "- Se oltre al servizio devi registrare costi non km, usa la superficie Spese collegata a cliente/progetto.",
  ].join("\n");

export const buildUnifiedCrmServiceCreateSuggestedActions = ({
  context,
  parsedQuestion,
  estimate,
  linkedExpenseDraft,
}: {
  context: Record<string, unknown>;
  parsedQuestion: ParsedUnifiedCrmProjectQuickEpisodeQuestion;
  estimate?: UnifiedCrmTravelExpenseEstimate | null;
  linkedExpenseDraft?: ParsedUnifiedCrmExpenseCreateQuestion | null;
}): UnifiedCrmSuggestedAction[] => {
  const routePrefix = getRoutePrefix(context);
  const projectHref = buildShowHref(
    routePrefix,
    "projects",
    parsedQuestion.projectId,
  );
  const linkedExpenseHref = linkedExpenseDraft
    ? buildExpenseCreateHref({
        context,
        parsedQuestion: linkedExpenseDraft,
      })
    : null;

  return [
    {
      id: "service-create-handoff",
      kind: "approved_action",
      resource: "services",
      capabilityActionId: "service_create",
      label: "Apri Servizi e registra questo servizio",
      description:
        estimate != null
          ? "Apre il form servizi gia collegato al progetto, precompilato con data, tipo servizio, chilometri, tariffa e note lette dalla richiesta."
          : "Apre il form servizi gia collegato al progetto, precompilato con i dettagli letti dalla richiesta.",
      href: buildServiceCreateHref({
        context,
        parsedQuestion,
        estimate,
      }),
      recommended: true,
      recommendationReason:
        "Consigliata perche fuori dai progetti TV il punto Pareto corretto e' riusare il form Servizi gia approvato, non creare un nuovo workflow dedicato.",
    },
    ...(linkedExpenseHref
      ? [
          {
            id: "expense-create-linked-from-service-context",
            kind: "approved_action" as const,
            resource: "expenses" as const,
            capabilityActionId: "expense_create" as const,
            label: "Registra anche la spesa collegata",
            description:
              "Apre il form spese gia precompilato con cliente, progetto e dati base della spesa extra non km emersa dalla richiesta.",
            href: linkedExpenseHref,
          },
        ]
      : []),
    ...(projectHref
      ? [
          {
            id: "open-project-from-service-context",
            kind: "show" as const,
            resource: "projects" as const,
            capabilityActionId: "follow_unified_crm_handoff" as const,
            label: "Apri il progetto senza form",
            description:
              "Vai alla scheda progetto se vuoi controllare prima il contesto operativo e finanziario.",
            href: projectHref,
          },
        ]
      : []),
  ];
};
