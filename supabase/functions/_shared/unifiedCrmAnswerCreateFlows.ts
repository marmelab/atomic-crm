import type {
  ParsedUnifiedCrmExpenseCreateQuestion,
  ParsedUnifiedCrmInvoiceDraftQuestion,
  ParsedUnifiedCrmProjectQuickEpisodeQuestion,
  ParsedUnifiedCrmTravelExpenseQuestion,
  UnifiedCrmSuggestedAction,
  UnifiedCrmTravelExpenseEstimate,
} from "./unifiedCrmAnswerTypes.ts";
import {
  buildCreateHref,
  buildListHref,
  buildShowHref,
  buildShowHrefWithSearch,
  formatIsoDateForHumans,
  formatNumber,
  getBusinessTimezone,
  getDefaultKmRate,
  getNumber,
  getObjectArray,
  getRoutePrefix,
  getString,
  includesAny,
  isObject,
  normalizeText,
} from "./unifiedCrmAnswerUtils.ts";
import {
  buildImplicitTravelRouteCandidates,
  getNamedTravelRouteSource,
  getTravelRouteSource,
  getProjectQuickEpisodeServiceTypeLabel,
  hasExpenseCreationIntent,
  hasExpenseIntent,
  hasInvoiceDraftIntent,
  hasTravelEstimationIntent,
  hasTravelIntent,
  hasProjectQuickEpisodeIntent,
  inferAmountFromQuestion,
  inferDateFromQuestion,
  inferExpenseDescriptionFromQuestion,
  inferExpenseTypeFromQuestion,
  inferProjectQuickEpisodeDescription,
  inferProjectQuickEpisodeNotes,
  inferProjectQuickEpisodeRequestedLabel,
  inferProjectQuickEpisodeServiceType,
  pickClientFromQuestion,
  pickProjectFromQuestion,
  splitTravelRoute,
} from "./unifiedCrmAnswerIntents.ts";

// ---------------------------------------------------------------------------
// Travel expense flows
// ---------------------------------------------------------------------------

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
  const isRoundTrip = includesAny(normalizedQuestion, [
    "andata e ritorno",
    "andate e ritorno",
    "andata ritorno",
    "andate ritorno",
    "andata che il ritorno",
    "sia l'andata che il ritorno",
    "a/r",
    "a-r",
  ]);
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
    isRoundTrip,
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
  const expenseCreateHref = buildTravelExpenseCreateHref({
    routePrefix,
    estimate,
  });

  return [
    {
      id: "expense-create-km-handoff",
      kind: "approved_action",
      resource: "expenses",
      capabilityActionId: "expense_create_km",
      label: "Registra questa spesa km",
      description:
        "Apre il form spese gia precompilato con tipo spostamento km, data, chilometri, tariffa e descrizione della tratta.",
      href: expenseCreateHref,
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

// ---------------------------------------------------------------------------
// Project quick episode flows
// ---------------------------------------------------------------------------

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

  const routeSource = getNamedTravelRouteSource(question);
  const explicitTravelRoute =
    hasTravelIntent(normalizedQuestion) && routeSource
      ? splitTravelRoute(routeSource)
      : null;

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
    isRoundTrip: includesAny(normalizedQuestion, [
      "andata e ritorno",
      "andate e ritorno",
      "andata ritorno",
      "andate ritorno",
      "andata che il ritorno",
      "sia l'andata che il ritorno",
      "a/r",
      "a-r",
    ]),
    travelRoute:
      explicitTravelRoute &&
      explicitTravelRoute.origin &&
      explicitTravelRoute.destination
        ? explicitTravelRoute
        : null,
    travelRouteCandidates:
      explicitTravelRoute &&
      explicitTravelRoute.origin &&
      explicitTravelRoute.destination
        ? []
        : hasTravelIntent(normalizedQuestion) && routeSource
          ? buildImplicitTravelRouteCandidates(routeSource)
          : [],
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
}) => {
  const requestedLabel = parsedQuestion.requestedLabel;
  const requestedLabelArticle =
    requestedLabel === "puntata"
      ? "questa puntata"
      : requestedLabel === "servizio"
        ? "questo servizio"
        : "questo lavoro";
  const dateLabel = formatIsoDateForHumans(parsedQuestion.serviceDate);
  const serviceTypeLabel = getProjectQuickEpisodeServiceTypeLabel(
    parsedQuestion.serviceType,
  );
  const shortRouteLabel =
    estimate != null
      ? `${estimate.originQuery} - ${estimate.destinationQuery}${estimate.isRoundTrip ? " A/R" : ""}`
      : parsedQuestion.travelRoute != null
        ? `${parsedQuestion.travelRoute.origin} - ${parsedQuestion.travelRoute.destination}${parsedQuestion.isRoundTrip ? " A/R" : ""}`
        : null;

  return [
    "## Risposta breve",
    estimate != null
      ? `Da qui non salvo direttamente, ma ti apro il progetto ${parsedQuestion.projectName} sul workflow approvato per registrare ${requestedLabelArticle}, gia precompilato con ${serviceTypeLabel ?? "il tipo servizio"}${dateLabel ? ` del ${dateLabel}` : ""} e ${formatNumber(estimate.totalDistanceKm)} km${estimate.isRoundTrip ? " A/R" : ""}.`
      : `Da qui non salvo direttamente, ma ti apro il progetto ${parsedQuestion.projectName} sul workflow approvato per registrare ${requestedLabelArticle}${dateLabel ? ` del ${dateLabel}` : ""}${serviceTypeLabel ? ` come ${serviceTypeLabel}` : ""}.`,
    "",
    "## Dati usati",
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
          `- Tratta risolta via routing: ${estimate.originLabel} -> ${estimate.destinationLabel}.`,
          estimate.kmRate != null && estimate.reimbursementAmount != null
            ? `- Rimborso km stimato: ${formatNumber(estimate.reimbursementAmount)} EUR con tariffa ${formatNumber(estimate.kmRate)} EUR/km.`
            : `- Distanza stimata: ${formatNumber(estimate.totalDistanceKm)} km${estimate.isRoundTrip ? " complessivi" : ""}.`,
        ]
      : shortRouteLabel
        ? [
            `- La richiesta contiene la tratta ${shortRouteLabel}, ma i km andranno confermati nel dialog prima del salvataggio.`,
          ]
        : []),
    "",
    "## Limiti o prossima azione",
    "- La chat resta read-only: la scrittura reale parte solo dal dialog del progetto con conferma esplicita.",
    estimate != null
      ? "- Prima di salvare puoi ancora correggere km, tariffa, localita', note e aggiungere spese extra non km come casello o pranzo."
      : "- Se i km non sono gia precompilati, usa il calcolatore tratta dentro il dialog prima di confermare; nello stesso dialog puoi anche aggiungere spese extra non km.",
  ].join("\n");
};

export const buildUnifiedCrmProjectQuickEpisodeSuggestedActions = ({
  context,
  parsedQuestion,
  estimate,
}: {
  context: Record<string, unknown>;
  parsedQuestion: ParsedUnifiedCrmProjectQuickEpisodeQuestion;
  estimate?: UnifiedCrmTravelExpenseEstimate | null;
}): UnifiedCrmSuggestedAction[] => {
  const quickEpisodeHref = buildProjectQuickEpisodeHref({
    context,
    parsedQuestion,
    estimate,
  });
  const projectHref = buildShowHref(
    getRoutePrefix(context),
    "projects",
    parsedQuestion.projectId,
  );
  const requestedLabel =
    parsedQuestion.requestedLabel === "puntata"
      ? "puntata"
      : parsedQuestion.requestedLabel === "servizio"
        ? "servizio"
        : "lavoro";
  const requestedLabelArticle =
    requestedLabel === "puntata"
      ? "questa puntata"
      : requestedLabel === "servizio"
        ? "questo servizio"
        : "questo lavoro";
  const dialogLabel = requestedLabel === "puntata" ? "Puntata" : "servizio";

  return [
    {
      id: "project-quick-episode-handoff",
      kind: "approved_action",
      resource: "projects",
      capabilityActionId: "project_quick_episode",
      label: `Apri il progetto e registra ${requestedLabelArticle}`,
      description:
        estimate != null
          ? `Apre il progetto con il dialog ${dialogLabel} gia pronto, precompilato con data, note, localita', chilometri e tariffa km; dentro puoi aggiungere anche spese extra non km.`
          : `Apre il progetto con il dialog ${dialogLabel} gia pronto, precompilato con i dettagli letti dalla richiesta e con supporto a spese extra non km.`,
      href:
        quickEpisodeHref ?? buildListHref(getRoutePrefix(context), "projects"),
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

// ---------------------------------------------------------------------------
// Service create flows
// ---------------------------------------------------------------------------

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
}) => {
  const requestedLabel =
    parsedQuestion.requestedLabel === "puntata"
      ? "questa puntata"
      : parsedQuestion.requestedLabel === "servizio"
        ? "questo servizio"
        : "questo lavoro";
  const dateLabel = formatIsoDateForHumans(parsedQuestion.serviceDate);
  const serviceTypeLabel = getProjectQuickEpisodeServiceTypeLabel(
    parsedQuestion.serviceType,
  );

  return [
    "## Risposta breve",
    estimate != null
      ? `Da qui non salvo direttamente, ma ti apro Servizi gia collegato al progetto ${parsedQuestion.projectName} per registrare ${requestedLabel}${dateLabel ? ` del ${dateLabel}` : ""}${serviceTypeLabel ? ` come ${serviceTypeLabel}` : ""}, con ${formatNumber(estimate.totalDistanceKm)} km gia stimati.`
      : `Da qui non salvo direttamente, ma ti apro Servizi gia collegato al progetto ${parsedQuestion.projectName} per registrare ${requestedLabel}${dateLabel ? ` del ${dateLabel}` : ""}${serviceTypeLabel ? ` come ${serviceTypeLabel}` : ""}.`,
    "",
    "## Dati usati",
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
    "",
    "## Limiti o prossima azione",
    "- La chat resta read-only: la scrittura reale parte solo dal form Servizi con conferma esplicita.",
    linkedExpenseDraft
      ? "- Per la spesa extra non km ti propongo anche Spese gia collegata a cliente/progetto, perche' fuori dal TV non conviene forzare un mega-form unico."
      : "- Se oltre al servizio devi registrare costi non km, usa la superficie Spese collegata a cliente/progetto.",
  ].join("\n");
};

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
  const serviceCreateHref = buildServiceCreateHref({
    context,
    parsedQuestion,
    estimate,
  });
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
      href: serviceCreateHref,
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

// ---------------------------------------------------------------------------
// Expense create flows
// ---------------------------------------------------------------------------

export const parseUnifiedCrmExpenseCreateQuestion = ({
  question,
  context,
}: {
  question: string;
  context: Record<string, unknown>;
}): ParsedUnifiedCrmExpenseCreateQuestion | null => {
  const normalizedQuestion = normalizeText(question);
  const mentionsNonKmExpense = includesAny(normalizedQuestion, [
    "casell",
    "pranz",
    "cena",
    "carbur",
    "benzin",
    "diesel",
    "nolegg",
    "material",
    "attrezz",
    "acquist",
  ]);

  if (
    !hasExpenseCreationIntent(normalizedQuestion) ||
    (hasTravelIntent(normalizedQuestion) && !mentionsNonKmExpense)
  ) {
    return null;
  }

  const matchedProject = pickProjectFromQuestion({
    normalizedQuestion,
    context,
  });
  const matchedClient =
    matchedProject == null
      ? pickClientFromQuestion({
          normalizedQuestion,
          context,
        })
      : null;

  const clientId =
    getString(matchedProject?.clientId) ?? getString(matchedClient?.clientId);

  if (!clientId) {
    return null;
  }

  return {
    clientId,
    projectId: getString(matchedProject?.projectId),
    clientName:
      getString(matchedProject?.clientName) ??
      getString(matchedClient?.clientName),
    projectName: getString(matchedProject?.projectName),
    expenseDate: inferDateFromQuestion(
      question,
      normalizedQuestion,
      getBusinessTimezone(context),
    ),
    expenseType: inferExpenseTypeFromQuestion(normalizedQuestion),
    description: inferExpenseDescriptionFromQuestion(
      question,
      normalizedQuestion,
    ),
    amount: inferAmountFromQuestion(question),
    markupPercent: 0,
  };
};

export const buildExpenseCreateHref = ({
  context,
  parsedQuestion,
}: {
  context: Record<string, unknown>;
  parsedQuestion: ParsedUnifiedCrmExpenseCreateQuestion;
}) =>
  buildCreateHref(getRoutePrefix(context), "expenses", {
    client_id: parsedQuestion.clientId,
    project_id: parsedQuestion.projectId,
    expense_date: parsedQuestion.expenseDate,
    expense_type: parsedQuestion.expenseType,
    amount:
      parsedQuestion.amount != null ? String(parsedQuestion.amount) : undefined,
    markup_percent:
      parsedQuestion.markupPercent != null
        ? String(parsedQuestion.markupPercent)
        : undefined,
    description: parsedQuestion.description,
    launcher_source: "unified_ai_launcher",
    launcher_action: "expense_create",
  });

export const buildUnifiedCrmExpenseCreateAnswerMarkdown = ({
  parsedQuestion,
}: {
  parsedQuestion: ParsedUnifiedCrmExpenseCreateQuestion;
}) => {
  const targetLabel = parsedQuestion.projectName
    ? `cliente ${parsedQuestion.clientName ?? "collegato"} e progetto ${parsedQuestion.projectName}`
    : `cliente ${parsedQuestion.clientName ?? "collegato"}`;
  const dateLabel = formatIsoDateForHumans(parsedQuestion.expenseDate);
  const amountLabel =
    parsedQuestion.amount != null
      ? ` da ${formatNumber(parsedQuestion.amount)} EUR`
      : "";

  return [
    "## Risposta breve",
    `Da qui non salvo direttamente, ma ti apro Spese gia collegata a ${targetLabel}${parsedQuestion.description ? ` per registrare ${parsedQuestion.description.toLowerCase()}` : " per registrare la spesa"}${amountLabel}${dateLabel ? ` del ${dateLabel}` : ""}.`,
    "",
    "## Dati usati",
    ...(parsedQuestion.projectName
      ? [
          `- Ho collegato la spesa al progetto ${parsedQuestion.projectName}, quindi nel form arriveranno sia progetto sia cliente.`,
        ]
      : [
          "- Ho collegato la spesa direttamente al cliente, senza forzare un progetto che non emerge con certezza dalla snapshot.",
        ]),
    ...(parsedQuestion.description
      ? [
          `- Dalla richiesta ho estratto la descrizione operativa "${parsedQuestion.description}".`,
        ]
      : []),
    ...(parsedQuestion.amount != null
      ? [
          `- Importo letto dalla richiesta: ${formatNumber(parsedQuestion.amount)} EUR.`,
        ]
      : []),
    "",
    "## Limiti o prossima azione",
    "- La chat resta read-only: la scrittura reale parte solo dal form Spese con conferma esplicita.",
    "- Prima di salvare puoi ancora correggere tipo spesa, importo, data e collegamenti.",
  ].join("\n");
};

export const buildUnifiedCrmExpenseCreateSuggestedActions = ({
  context,
  parsedQuestion,
}: {
  context: Record<string, unknown>;
  parsedQuestion: ParsedUnifiedCrmExpenseCreateQuestion;
}): UnifiedCrmSuggestedAction[] => {
  const routePrefix = getRoutePrefix(context);
  const expenseCreateHref = buildExpenseCreateHref({
    context,
    parsedQuestion,
  });
  const projectHref = buildShowHref(
    routePrefix,
    "projects",
    parsedQuestion.projectId,
  );
  const clientHref = buildShowHref(
    routePrefix,
    "clients",
    parsedQuestion.clientId,
  );

  return [
    {
      id: "expense-create-generic-handoff",
      kind: "approved_action",
      resource: "expenses",
      capabilityActionId: "expense_create",
      label: "Apri Spese e registra questa uscita",
      description:
        "Apre il form spese gia precompilato con cliente, progetto se presente, data, tipo, importo e descrizione letti dalla richiesta.",
      href: expenseCreateHref,
      recommended: true,
      recommendationReason:
        "Consigliata perche usa la superficie Spese gia approvata e mantiene il legame corretto con cliente o cliente+progetto senza inventare nuovi form.",
    },
    ...(projectHref
      ? [
          {
            id: "open-project-from-expense-create-context",
            kind: "show" as const,
            resource: "projects" as const,
            capabilityActionId: "follow_unified_crm_handoff" as const,
            label: "Apri il progetto collegato",
            description:
              "Vai alla scheda progetto se vuoi controllare prima il contesto operativo.",
            href: projectHref,
          },
        ]
      : clientHref
        ? [
            {
              id: "open-client-from-expense-create-context",
              kind: "show" as const,
              resource: "clients" as const,
              capabilityActionId: "follow_unified_crm_handoff" as const,
              label: "Apri il cliente collegato",
              description:
                "Vai alla scheda cliente se vuoi verificare il contesto prima del salvataggio.",
              href: clientHref,
            },
          ]
        : []),
  ];
};

// ---------------------------------------------------------------------------
// Invoice draft flow
// ---------------------------------------------------------------------------

const getClientFinancials = (
  context: Record<string, unknown>,
  clientId: string,
) => {
  const snapshot = isObject(context.snapshot) ? context.snapshot : null;
  const financials = getObjectArray(snapshot?.clientFinancials);
  const match = financials.find((f) => getString(f.clientId) === clientId);

  if (!match) return null;

  const totalFees = getNumber(match.totalFees) ?? 0;
  const totalExpenses = getNumber(match.totalExpenses) ?? 0;
  const totalPaid = getNumber(match.totalPaid) ?? 0;
  const balanceDue = getNumber(match.balanceDue) ?? totalFees - totalPaid;

  return {
    totalFees,
    totalExpenses,
    totalPaid,
    balanceDue,
    hasUninvoicedServices: match.hasUninvoicedServices === true,
  };
};

export const parseUnifiedCrmInvoiceDraftQuestion = ({
  question,
  context,
}: {
  question: string;
  context: Record<string, unknown>;
}): ParsedUnifiedCrmInvoiceDraftQuestion | null => {
  const normalizedQuestion = normalizeText(question);

  if (!hasInvoiceDraftIntent(normalizedQuestion)) return null;

  const snapshot = isObject(context.snapshot) ? context.snapshot : {};
  const openQuotes = getObjectArray(snapshot.openQuotes);
  const activeProjects = getObjectArray(snapshot.activeProjects);
  const recentClients = getObjectArray(snapshot.recentClients);

  const matchedClient = pickClientFromQuestion({
    normalizedQuestion,
    context,
  });
  const matchedProject = pickProjectFromQuestion({
    normalizedQuestion,
    context,
  });

  const matchedClientId = getString(matchedClient?.clientId);
  const matchedProjectId = getString(matchedProject?.projectId);

  // Mention of "preventivo" → prefer quote surface
  const mentionsQuote = includesAny(normalizedQuestion, [
    "preventiv",
    "offert",
  ]);

  // Try to find the best surface in order: quote > project > client
  if (mentionsQuote || (!matchedProjectId && !matchedClientId)) {
    const quote = matchedClientId
      ? openQuotes.find((q) => getString(q.clientId) === matchedClientId)
      : matchedProjectId
        ? openQuotes.find((q) => getString(q.projectId) === matchedProjectId)
        : openQuotes[0];
    const quoteId = getString(quote?.quoteId);
    const quoteClientId = getString(quote?.clientId) ?? matchedClientId ?? null;
    const quoteClientName =
      getString(quote?.clientName) ??
      getString(matchedClient?.clientName) ??
      "Cliente";

    if (quoteId && quoteClientId) {
      return {
        surface: "quote",
        recordId: quoteId,
        entityLabel:
          getString(quote?.description) ??
          `Preventivo ${getString(quote?.quoteNumber) ?? ""}`.trim(),
        clientName: quoteClientName,
        clientId: quoteClientId,
        financials: getClientFinancials(context, quoteClientId),
      };
    }

    // User explicitly asked about a quote but none matched — bail out to AI
    // instead of falling through to project/client which would be misleading
    if (mentionsQuote) return null;
  }

  // Project surface
  const projectRecord = matchedProjectId
    ? matchedProject
    : matchedClientId
      ? activeProjects.find((p) => getString(p.clientId) === matchedClientId)
      : activeProjects[0];
  const projectId = getString(projectRecord?.projectId);
  const projectClientId =
    getString(projectRecord?.clientId) ?? matchedClientId ?? null;
  const projectClientName =
    getString(
      recentClients.find((c) => getString(c.clientId) === projectClientId)
        ?.clientName,
    ) ??
    getString(matchedClient?.clientName) ??
    "Cliente";

  if (projectId && projectClientId) {
    return {
      surface: "project",
      recordId: projectId,
      entityLabel: getString(projectRecord?.projectName) ?? "Progetto",
      clientName: projectClientName,
      clientId: projectClientId,
      financials: getClientFinancials(context, projectClientId),
    };
  }

  // Client surface (fallback)
  const clientRecord = matchedClient ?? recentClients[0];
  const clientId = getString(clientRecord?.clientId);
  const clientName = getString(clientRecord?.clientName) ?? "Cliente";

  if (clientId) {
    return {
      surface: "client",
      recordId: clientId,
      entityLabel: clientName,
      clientName,
      clientId,
      financials: getClientFinancials(context, clientId),
    };
  }

  return null;
};

export const buildUnifiedCrmInvoiceDraftAnswerMarkdown = ({
  parsedQuestion,
}: {
  parsedQuestion: ParsedUnifiedCrmInvoiceDraftQuestion;
}) => {
  const { surface, entityLabel, financials } = parsedQuestion;

  const surfaceLabel =
    surface === "quote"
      ? "preventivo"
      : surface === "project"
        ? "progetto"
        : "cliente";

  const lines: string[] = [
    "## Risposta",
    "",
    `Ti apro la scheda ${surfaceLabel} **${entityLabel}** con la bozza fattura gia pronta.`,
    `La bozza e un riferimento interno per compilare la fattura su Aruba — nessuna scrittura nel DB.`,
    "",
  ];

  if (financials) {
    lines.push("## Dettaglio finanziario");
    lines.push("");
    lines.push(`- **Compensi**: ${formatNumber(financials.totalFees)} EUR`);
    if (financials.totalExpenses > 0) {
      lines.push(`- **Spese**: ${formatNumber(financials.totalExpenses)} EUR`);
    }
    lines.push(`- **Gia pagato**: ${formatNumber(financials.totalPaid)} EUR`);

    if (financials.balanceDue > 0) {
      lines.push(
        `- **Da incassare**: ${formatNumber(financials.balanceDue)} EUR`,
      );
    }

    if (financials.hasUninvoicedServices) {
      lines.push("- Ci sono servizi non ancora fatturati.");
    } else {
      lines.push("- Tutti i servizi risultano gia fatturati.");
    }

    lines.push("");
  }

  lines.push("## Note");
  lines.push("");
  lines.push(
    `- Nella scheda ${surfaceLabel} trovi il bottone **Bozza fattura** per generare PDF e XML FatturaPA.`,
  );
  lines.push(
    "- Il PDF e la bozza commerciale, l'XML e pronto per il caricamento su Aruba.",
  );
  lines.push(
    "- Per l'XML serve inserire il numero fattura nel campo dedicato.",
  );

  if (surface === "client" && financials?.hasUninvoicedServices) {
    lines.push(
      "- La bozza dal cliente aggrega TUTTI i servizi non fatturati — controlla che sia quello che vuoi.",
    );
  }

  return lines.join("\n").trim();
};

export const buildUnifiedCrmInvoiceDraftSuggestedActions = ({
  context,
  parsedQuestion,
}: {
  context: Record<string, unknown>;
  parsedQuestion: ParsedUnifiedCrmInvoiceDraftQuestion;
}): UnifiedCrmSuggestedAction[] => {
  const routePrefix = getRoutePrefix(context);
  const { surface, recordId, entityLabel, clientId } = parsedQuestion;

  const resourceMap = {
    quote: "quotes",
    project: "projects",
    client: "clients",
  } as const;

  const surfaceLabelMap = {
    quote: "preventivo",
    project: "progetto",
    client: "cliente",
  } as const;

  const primaryHref = buildShowHrefWithSearch(
    routePrefix,
    resourceMap[surface],
    recordId,
    { invoiceDraft: "true" },
  );

  const suggestions: UnifiedCrmSuggestedAction[] = [];

  if (primaryHref) {
    suggestions.push({
      id: `invoice-draft-${surface}-handoff`,
      kind: "approved_action",
      resource: resourceMap[surface],
      capabilityActionId: "generate_invoice_draft",
      label: `Genera bozza fattura da ${surfaceLabelMap[surface]}`,
      description: `Apre ${entityLabel} con il dialog bozza fattura gia visibile — da li puoi scaricare PDF e XML.`,
      href: primaryHref,
      recommended: true,
      recommendationReason: `Consigliata perche apre direttamente la bozza fattura dalla superficie piu pertinente (${surfaceLabelMap[surface]}).`,
    });
  }

  // Secondary: the other surfaces if available
  const snapshot = isObject(context.snapshot) ? context.snapshot : {};
  const activeProjects = getObjectArray(snapshot.activeProjects);
  const openQuotes = getObjectArray(snapshot.openQuotes);

  if (surface !== "client") {
    const clientHref = buildShowHrefWithSearch(
      routePrefix,
      "clients",
      clientId,
      { invoiceDraft: "true" },
    );

    if (clientHref) {
      suggestions.push({
        id: "invoice-draft-client-fallback",
        kind: "approved_action",
        resource: "clients",
        capabilityActionId: "generate_invoice_draft",
        label: "Bozza fattura dal cliente",
        description:
          "Aggrega tutti i servizi non fatturati del cliente in un'unica bozza.",
        href: clientHref,
      });
    }
  }

  if (surface !== "project") {
    const project = activeProjects.find(
      (p) => getString(p.clientId) === clientId,
    );
    const projectHref = buildShowHrefWithSearch(
      routePrefix,
      "projects",
      getString(project?.projectId),
      { invoiceDraft: "true" },
    );

    if (projectHref) {
      suggestions.push({
        id: "invoice-draft-project-fallback",
        kind: "approved_action",
        resource: "projects",
        capabilityActionId: "generate_invoice_draft",
        label: "Bozza fattura dal progetto",
        description:
          "Genera la bozza solo dai servizi del progetto attivo collegato.",
        href: projectHref,
      });
    }
  }

  if (surface !== "quote") {
    const quote = openQuotes.find((q) => getString(q.clientId) === clientId);
    const quoteHref = buildShowHrefWithSearch(
      routePrefix,
      "quotes",
      getString(quote?.quoteId),
      { invoiceDraft: "true" },
    );

    if (quoteHref) {
      suggestions.push({
        id: "invoice-draft-quote-fallback",
        kind: "approved_action",
        resource: "quotes",
        capabilityActionId: "generate_invoice_draft",
        label: "Bozza fattura dal preventivo",
        description:
          "Genera la bozza dall'importo del preventivo, al netto dei pagamenti ricevuti.",
        href: quoteHref,
      });
    }
  }

  return suggestions.slice(0, 3);
};
