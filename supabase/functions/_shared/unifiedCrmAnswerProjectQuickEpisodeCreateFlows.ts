import type {
  ParsedUnifiedCrmProjectQuickEpisodeQuestion,
  UnifiedCrmSuggestedAction,
  UnifiedCrmTravelExpenseEstimate,
  UnifiedCrmTravelRouteCandidate,
} from "./unifiedCrmAnswerTypes.ts";
import {
  buildImplicitTravelRouteCandidates,
  getNamedTravelRouteSource,
  getProjectQuickEpisodeServiceTypeLabel,
  hasProjectQuickEpisodeIntent,
  hasTravelIntent,
  inferDateFromQuestion,
  inferProjectQuickEpisodeDescription,
  inferProjectQuickEpisodeNotes,
  inferProjectQuickEpisodeRequestedLabel,
  inferProjectQuickEpisodeServiceType,
  pickProjectFromQuestion,
  splitTravelRoute,
} from "./unifiedCrmAnswerIntents.ts";
import {
  buildListHref,
  buildShowHref,
  buildShowHrefWithSearch,
  formatIsoDateForHumans,
  formatNumber,
  getBusinessTimezone,
  getRoutePrefix,
  getString,
  normalizeText,
} from "./unifiedCrmAnswerUtils.ts";
import {
  buildTravelRouteLabel,
  getRequestedWorkLabelInfo,
  hasRoundTripIntent,
} from "./unifiedCrmAnswerCreateFlowShared.ts";

const hasCompleteTravelRoute = (
  route: UnifiedCrmTravelRouteCandidate | null,
): route is UnifiedCrmTravelRouteCandidate =>
  Boolean(route?.origin && route.destination);

const resolveProjectQuickEpisodeTravelFields = ({
  question,
  normalizedQuestion,
}: {
  question: string;
  normalizedQuestion: string;
}) => {
  if (!hasTravelIntent(normalizedQuestion)) {
    return {
      travelRoute: null,
      travelRouteCandidates: [],
    };
  }

  const routeSource = getNamedTravelRouteSource(question);

  if (!routeSource) {
    return {
      travelRoute: null,
      travelRouteCandidates: [],
    };
  }

  const explicitTravelRoute = splitTravelRoute(routeSource);

  if (hasCompleteTravelRoute(explicitTravelRoute)) {
    return {
      travelRoute: explicitTravelRoute,
      travelRouteCandidates: [],
    };
  }

  return {
    travelRoute: null,
    travelRouteCandidates: buildImplicitTravelRouteCandidates(routeSource),
  };
};

const buildProjectQuickEpisodeSummaryLine = ({
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
    return `Da qui non salvo direttamente, ma ti apro il progetto ${parsedQuestion.projectName} sul workflow approvato per registrare ${article}, gia precompilato con ${serviceTypeLabel ?? "il tipo servizio"}${dateLabel ? ` del ${dateLabel}` : ""} e ${formatNumber(estimate.totalDistanceKm)} km${estimate.isRoundTrip ? " A/R" : ""}.`;
  }

  return `Da qui non salvo direttamente, ma ti apro il progetto ${parsedQuestion.projectName} sul workflow approvato per registrare ${article}${dateLabel ? ` del ${dateLabel}` : ""}${serviceTypeLabel ? ` come ${serviceTypeLabel}` : ""}.`;
};

const buildProjectQuickEpisodeTravelLines = ({
  parsedQuestion,
  estimate,
}: {
  parsedQuestion: ParsedUnifiedCrmProjectQuickEpisodeQuestion;
  estimate?: UnifiedCrmTravelExpenseEstimate | null;
}) => {
  if (estimate != null) {
    return [
      `- Tratta risolta via routing: ${estimate.originLabel} -> ${estimate.destinationLabel}.`,
      estimate.kmRate != null && estimate.reimbursementAmount != null
        ? `- Rimborso km stimato: ${formatNumber(estimate.reimbursementAmount)} EUR con tariffa ${formatNumber(estimate.kmRate)} EUR/km.`
        : `- Distanza stimata: ${formatNumber(estimate.totalDistanceKm)} km${estimate.isRoundTrip ? " complessivi" : ""}.`,
    ];
  }

  if (!parsedQuestion.travelRoute) {
    return [];
  }

  return [
    `- La richiesta contiene la tratta ${buildTravelRouteLabel(parsedQuestion.travelRoute, parsedQuestion.isRoundTrip)}, ma i km andranno confermati nel dialog prima del salvataggio.`,
  ];
};

const buildProjectQuickEpisodeEvidenceLines = ({
  parsedQuestion,
  estimate,
}: {
  parsedQuestion: ParsedUnifiedCrmProjectQuickEpisodeQuestion;
  estimate?: UnifiedCrmTravelExpenseEstimate | null;
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
  ...buildProjectQuickEpisodeTravelLines({
    parsedQuestion,
    estimate,
  }),
];

export const parseUnifiedCrmProjectQuickEpisodeQuestion = ({
  question,
  context,
}: {
  question: string;
  context: Record<string, unknown>;
}): ParsedUnifiedCrmProjectQuickEpisodeQuestion | null => {
  const normalizedQuestion = normalizeText(question);

  if (!hasProjectQuickEpisodeIntent(normalizedQuestion)) {
    return null;
  }

  const matchedProject = pickProjectFromQuestion({
    normalizedQuestion,
    context,
  });
  const projectId = getString(matchedProject?.projectId);
  const projectName = getString(matchedProject?.projectName);

  if (!projectId || !projectName) {
    return null;
  }

  return {
    projectId,
    clientId: getString(matchedProject?.clientId),
    projectName,
    projectCategory: getString(matchedProject?.projectCategory),
    projectTvShow: getString(matchedProject?.projectTvShow),
    requestedLabel: inferProjectQuickEpisodeRequestedLabel(normalizedQuestion),
    serviceDate: inferDateFromQuestion(
      question,
      normalizedQuestion,
      getBusinessTimezone(context),
    ),
    serviceType: inferProjectQuickEpisodeServiceType(normalizedQuestion),
    description: inferProjectQuickEpisodeDescription(question),
    notes: inferProjectQuickEpisodeNotes(question),
    isRoundTrip: hasRoundTripIntent(normalizedQuestion),
    ...resolveProjectQuickEpisodeTravelFields({
      question,
      normalizedQuestion,
    }),
  };
};

export const buildProjectQuickEpisodeHref = ({
  context,
  parsedQuestion,
  estimate,
}: {
  context: Record<string, unknown>;
  parsedQuestion: ParsedUnifiedCrmProjectQuickEpisodeQuestion;
  estimate?: UnifiedCrmTravelExpenseEstimate | null;
}) =>
  buildShowHrefWithSearch(
    getRoutePrefix(context),
    "projects",
    parsedQuestion.projectId,
    {
      project_id: parsedQuestion.projectId,
      client_id: parsedQuestion.clientId,
      service_date: parsedQuestion.serviceDate,
      service_type: parsedQuestion.serviceType,
      description: parsedQuestion.description,
      km_distance:
        estimate != null ? String(estimate.totalDistanceKm) : undefined,
      km_rate: estimate?.kmRate != null ? String(estimate.kmRate) : undefined,
      location:
        estimate?.destinationQuery ??
        parsedQuestion.travelRoute?.destination ??
        undefined,
      notes: parsedQuestion.notes,
      launcher_source: "unified_ai_launcher",
      launcher_action: "project_quick_episode",
      open_dialog: "quick_episode",
    },
  );

export const buildUnifiedCrmProjectQuickEpisodeAnswerMarkdown = ({
  parsedQuestion,
  estimate,
}: {
  parsedQuestion: ParsedUnifiedCrmProjectQuickEpisodeQuestion;
  estimate?: UnifiedCrmTravelExpenseEstimate | null;
}) =>
  [
    "## Risposta breve",
    buildProjectQuickEpisodeSummaryLine({
      parsedQuestion,
      estimate,
    }),
    "",
    "## Dati usati",
    ...buildProjectQuickEpisodeEvidenceLines({
      parsedQuestion,
      estimate,
    }),
    "",
    "## Limiti o prossima azione",
    "- La chat resta read-only: la scrittura reale parte solo dal dialog del progetto con conferma esplicita.",
    estimate != null
      ? "- Prima di salvare puoi ancora correggere km, tariffa, localita', note e aggiungere spese extra non km come casello o pranzo."
      : "- Se i km non sono gia precompilati, usa il calcolatore tratta dentro il dialog prima di confermare; nello stesso dialog puoi anche aggiungere spese extra non km.",
  ].join("\n");

export const buildUnifiedCrmProjectQuickEpisodeSuggestedActions = ({
  context,
  parsedQuestion,
  estimate,
}: {
  context: Record<string, unknown>;
  parsedQuestion: ParsedUnifiedCrmProjectQuickEpisodeQuestion;
  estimate?: UnifiedCrmTravelExpenseEstimate | null;
}): UnifiedCrmSuggestedAction[] => {
  const routePrefix = getRoutePrefix(context);
  const quickEpisodeHref = buildProjectQuickEpisodeHref({
    context,
    parsedQuestion,
    estimate,
  });
  const projectHref = buildShowHref(
    routePrefix,
    "projects",
    parsedQuestion.projectId,
  );
  const { article, dialogLabel } = getRequestedWorkLabelInfo(
    parsedQuestion.requestedLabel,
  );

  return [
    {
      id: "project-quick-episode-handoff",
      kind: "approved_action",
      resource: "projects",
      capabilityActionId: "project_quick_episode",
      label: `Apri il progetto e registra ${article}`,
      description:
        estimate != null
          ? `Apre il progetto con il dialog ${dialogLabel} gia pronto, precompilato con data, note, localita', chilometri e tariffa km; dentro puoi aggiungere anche spese extra non km.`
          : `Apre il progetto con il dialog ${dialogLabel} gia pronto, precompilato con i dettagli letti dalla richiesta e con supporto a spese extra non km.`,
      href: quickEpisodeHref ?? buildListHref(routePrefix, "projects"),
      recommended: true,
      recommendationReason:
        "Consigliata perche usa il workflow TV gia approvato del progetto corretto e lascia la conferma finale all'utente prima della scrittura.",
    },
    ...(projectHref
      ? [
          {
            id: "open-project-from-quick-episode-context",
            kind: "show" as const,
            resource: "projects" as const,
            capabilityActionId: "follow_unified_crm_handoff" as const,
            label: "Apri il progetto senza dialog",
            description:
              "Vai alla scheda progetto se vuoi controllare prima il contesto operativo e finanziario.",
            href: projectHref,
          },
        ]
      : []),
  ];
};
