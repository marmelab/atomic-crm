const requiredScope = "crm_read_snapshot";

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
    | "expenses";
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

const italianMonthNumbers: Record<string, number> = {
  gennaio: 1,
  febbraio: 2,
  marzo: 3,
  aprile: 4,
  maggio: 5,
  giugno: 6,
  luglio: 7,
  agosto: 8,
  settembre: 9,
  ottobre: 10,
  novembre: 11,
  dicembre: 12,
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getString = (value: unknown) =>
  typeof value === "string" ? value : null;
const getNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const formatNumber = (value: number) =>
  value.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const includesAny = (value: string, patterns: string[]) =>
  patterns.some((pattern) => value.includes(pattern));

const hasTravelIntent = (normalizedQuestion: string) =>
  includesAny(normalizedQuestion, [
    "tratta",
    "tragitt",
    "percor",
    "chilometr",
    "km",
    "spostament",
    "trasfert",
    "andata e ritorno",
    "andate e ritorno",
    "a/r",
    "distanz",
    "viaggi",
  ]);

const hasExpenseIntent = (normalizedQuestion: string) =>
  includesAny(normalizedQuestion, [
    "spes",
    "rimbor",
    "costo",
    "spostament",
    "uscit",
    "fornitor",
    "nolegg",
  ]);

const hasExpenseCreationIntent = (normalizedQuestion: string) =>
  hasExpenseIntent(normalizedQuestion) &&
  includesAny(normalizedQuestion, [
    "registr",
    "aggiung",
    "inser",
    "crea",
    "segn",
    "precompilat",
    "prepar",
    "bozza",
  ]);

const hasTaskIntent = (normalizedQuestion: string) =>
  includesAny(normalizedQuestion, [
    "promemori",
    "ricordam",
    "follow up",
    "follow-up",
    "attivit",
    "todo",
    "to do",
    "scadenz",
  ]);

const hasTaskCreationIntent = (normalizedQuestion: string) =>
  hasTaskIntent(normalizedQuestion) &&
  includesAny(normalizedQuestion, [
    "crea",
    "aggiung",
    "inser",
    "prepar",
    "imposta",
    "segn",
    "nuov",
    "bozza",
  ]);

const hasInvoiceDraftIntent = (normalizedQuestion: string) => {
  const mentionsFattura = includesAny(normalizedQuestion, [
    "bozza fattura",
    "bozza di fattura",
    "fattura",
    "aruba",
    "prefattura",
  ]);

  if (!mentionsFattura) return false;

  // Explicit action verb → always trigger
  if (
    includesAny(normalizedQuestion, [
      "crea",
      "genera",
      "prepar",
      "compila",
      "bozza",
      "aiut",
    ])
  )
    return true;

  // Directional "fattura per/di/del..." → intent to generate for a specific entity
  return includesAny(normalizedQuestion, [
    "fattura per ",
    "fattura di ",
    "fattura del ",
    "fattura della ",
    "fattura dai ",
    "fattura dei ",
    "fattura delle ",
    "fattura dal ",
  ]);
};

const hasTravelEstimationIntent = (normalizedQuestion: string) =>
  includesAny(normalizedQuestion, [
    "calcol",
    "quanti km",
    "quanto dista",
    "distanz",
    "andata e ritorno",
    "andate e ritorno",
    "andata ritorno",
    "andate ritorno",
    "solo andata",
    "a/r",
    "a-r",
  ]);

const hasProjectQuickEpisodeIntent = (normalizedQuestion: string) =>
  includesAny(normalizedQuestion, [
    "nuovo lavoro",
    "nuov lavor",
    "nuovo servizio",
    "nuov serviz",
    "nuova puntata",
    "registra puntata",
    "intervist",
  ]) &&
  includesAny(normalizedQuestion, [
    "registr",
    "aggiung",
    "inser",
    "crea",
    "precompilat",
    "prepar",
    "caric",
    "mi serv",
    "serve",
    "vogli",
    "devo",
    "metti",
    "salv",
  ]) &&
  includesAny(normalizedQuestion, ["progett", "serviz", "puntat", "lavor"]);

const getRoutePrefix = (context: Record<string, unknown>) => {
  const meta = isObject(context.meta) ? context.meta : null;
  return getString(meta?.routePrefix) ?? "/#/";
};

const getBusinessTimezone = (context: Record<string, unknown>) => {
  const meta = isObject(context.meta) ? context.meta : null;
  return getString(meta?.businessTimezone) ?? "Europe/Rome";
};

const getDefaultKmRate = (context: Record<string, unknown>) => {
  const registries = isObject(context.registries) ? context.registries : null;
  const semantic = isObject(registries?.semantic) ? registries.semantic : null;
  const rules = isObject(semantic?.rules) ? semantic.rules : null;
  const travelReimbursement = isObject(rules?.travelReimbursement)
    ? rules.travelReimbursement
    : null;
  return getNumber(travelReimbursement?.defaultKmRate);
};

const formatDateInTimezone = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : null;
};

const stripTrailingTravelContext = (value: string) =>
  value
    .replace(
      /\s*(?:\/\s*)?(?:(?:andata|andate)\s+e\s+ritorno|(?:andata|andate)\s+ritorno|a\/r|a-r|ritorno)\b.*$/i,
      "",
    )
    .replace(
      /\s*(?:e\s+)?(?:[,.!?;:]\s*)?(?:bisogna\s+)?(?:calcol\w*|quanti|quanto|dimmi|come|devo|vorrei|posso|registr|caric|inser|preparami)\b.*$/i,
      "",
    )
    .replace(/^[\s\-–—/]+|[\s\-–—/.,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

const getTravelRouteSource = (question: string) => {
  const compactQuestion = question.replace(/\s+/g, " ").trim();
  const namedRouteSource = getNamedTravelRouteSource(question);

  if (namedRouteSource) {
    return namedRouteSource;
  }

  if (splitTravelRoute(compactQuestion)) {
    return compactQuestion;
  }

  const markerPatterns = [
    /\btratta\s+/gi,
    /\bpercor(?:so|sa)?\s+/gi,
    /\btragitt(?:o|a)?\s+/gi,
    /\b(?:devi\s+)?calcol\w*\s+/gi,
    /\bstim\w*\s+/gi,
  ];
  let bestMarkerEnd = -1;

  markerPatterns.forEach((pattern) => {
    const matches = compactQuestion.matchAll(pattern);

    for (const match of matches) {
      if (typeof match.index !== "number") {
        continue;
      }

      const markerEnd = match.index + match[0].length;

      if (markerEnd > bestMarkerEnd) {
        bestMarkerEnd = markerEnd;
      }
    }
  });

  return bestMarkerEnd >= 0
    ? compactQuestion.slice(bestMarkerEnd).trim()
    : compactQuestion;
};

const buildImplicitTravelRouteCandidates = (value: string) => {
  const cleanedValue = stripTrailingTravelContext(value)
    .replace(/^(?:tra|fra)\s+/i, "")
    .trim();
  const tokens = cleanedValue.split(/\s+/).filter(Boolean);

  if (tokens.length < 2 || tokens.length > 6) {
    return [];
  }

  const splitIndices = Array.from(
    { length: tokens.length - 1 },
    (_, index) => index + 1,
  ).sort((left, right) => {
    const midpoint = tokens.length / 2;
    const leftDistance = Math.abs(midpoint - left);
    const rightDistance = Math.abs(midpoint - right);

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    return right - left;
  });

  return splitIndices
    .map((splitIndex) => ({
      origin: tokens.slice(0, splitIndex).join(" ").trim(),
      destination: tokens.slice(splitIndex).join(" ").trim(),
    }))
    .filter(
      (candidate, index, candidates) =>
        candidate.origin.length >= 3 &&
        candidate.destination.length >= 3 &&
        candidates.findIndex(
          (otherCandidate) =>
            otherCandidate.origin === candidate.origin &&
            otherCandidate.destination === candidate.destination,
        ) === index,
    );
};

const splitTravelRoute = (value: string) => {
  const dashMatch = value.match(/^(.+?)\s[-–—]\s(.+)$/);
  if (dashMatch) {
    return {
      origin: stripTrailingTravelContext(dashMatch[1] ?? ""),
      destination: stripTrailingTravelContext(dashMatch[2] ?? ""),
    };
  }

  const fromToMatch = value.match(/\bda\s+(.+?)\s+a\s+(.+)$/i);
  if (fromToMatch) {
    return {
      origin: stripTrailingTravelContext(fromToMatch[1] ?? ""),
      destination: stripTrailingTravelContext(fromToMatch[2] ?? ""),
    };
  }

  const fromUntilMatch = value.match(
    /\bda\s+(.+?)\s+fino\s+a(?:l|lla|llo|ll')?\s+(.+)$/i,
  );
  if (fromUntilMatch) {
    return {
      origin: stripTrailingTravelContext(fromUntilMatch[1] ?? ""),
      destination: stripTrailingTravelContext(fromUntilMatch[2] ?? ""),
    };
  }

  const fromVersusMatch = value.match(
    /\bda\s+(.+?)\s+(?:verso|fino\s+in)\s+(.+)$/i,
  );
  if (fromVersusMatch) {
    return {
      origin: stripTrailingTravelContext(fromVersusMatch[1] ?? ""),
      destination: stripTrailingTravelContext(fromVersusMatch[2] ?? ""),
    };
  }

  return null;
};

const inferDateFromQuestion = (
  question: string,
  normalizedQuestion: string,
  timeZone: string,
) => {
  const explicitDateMatch = normalizeText(question).match(
    /\b(?:giorno\s+)?(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})\b/i,
  );

  if (explicitDateMatch) {
    const day = Number(explicitDateMatch[1]);
    const month = italianMonthNumbers[explicitDateMatch[2].toLowerCase()];
    const year = Number(explicitDateMatch[3]);

    if (
      Number.isInteger(day) &&
      day >= 1 &&
      day <= 31 &&
      Number.isInteger(month) &&
      Number.isInteger(year)
    ) {
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const now = new Date();

  if (includesAny(normalizedQuestion, ["oggi", "stasera", "stamattina"])) {
    return formatDateInTimezone(now, timeZone);
  }

  if (includesAny(normalizedQuestion, ["ieri"])) {
    return formatDateInTimezone(
      new Date(now.getTime() - 24 * 60 * 60 * 1000),
      timeZone,
    );
  }

  return null;
};

const getNamedTravelRouteSource = (question: string) => {
  const compactQuestion = question.replace(/\s+/g, " ").trim();
  return (
    compactQuestion.match(/\btratta\s+(.+)$/i)?.[1] ??
    compactQuestion.match(/\bpercor(?:so|sa)?\s+(.+)$/i)?.[1] ??
    null
  );
};

const projectNameStopwords = new Set([
  "il",
  "lo",
  "la",
  "i",
  "gli",
  "le",
  "di",
  "del",
  "della",
  "dei",
  "degli",
  "delle",
  "da",
  "dai",
  "dagli",
  "dalle",
  "per",
  "con",
  "nel",
  "nella",
  "nei",
  "nelle",
  "su",
  "un",
  "uno",
  "una",
  "e",
]);

const tokenizeProjectName = (value: string) =>
  normalizeText(value)
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 3 && !projectNameStopwords.has(token));

const tokenizeClientName = tokenizeProjectName;

const pickProjectFromQuestion = ({
  normalizedQuestion,
  context,
}: {
  normalizedQuestion: string;
  context: Record<string, unknown>;
}) => {
  const snapshot = isObject(context.snapshot) ? context.snapshot : null;
  const activeProjects = getObjectArray(snapshot?.activeProjects);

  if (activeProjects.length === 0) {
    return null;
  }

  const rankedProjects = activeProjects
    .map((project) => {
      const projectName = getString(project.projectName);

      if (!projectName) {
        return null;
      }

      const normalizedProjectName = normalizeText(projectName);
      const projectTokens = tokenizeProjectName(projectName);
      const tokenScore = projectTokens.filter((token) =>
        normalizedQuestion.includes(token),
      ).length;
      const score =
        tokenScore +
        (normalizedQuestion.includes(normalizedProjectName) ? 10 : 0);

      return {
        project,
        score,
      };
    })
    .filter(
      (
        project,
      ): project is {
        project: Record<string, unknown>;
        score: number;
      } => project !== null,
    )
    .sort((left, right) => right.score - left.score);

  const firstProject = rankedProjects[0];
  const secondProject = rankedProjects[1];

  if (!firstProject) {
    return null;
  }

  if (
    firstProject.score <= 0 &&
    activeProjects.length === 1 &&
    includesAny(normalizedQuestion, ["progett", "puntat", "serviz", "lavor"])
  ) {
    return activeProjects[0];
  }

  if (
    firstProject.score > 0 &&
    (!secondProject || firstProject.score > secondProject.score)
  ) {
    return firstProject.project;
  }

  return null;
};

const scoreEntityNames = ({
  normalizedQuestion,
  names,
}: {
  normalizedQuestion: string;
  names: string[];
}) => {
  const normalizedNames = names
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => normalizeText(name));
  const uniqueNames = Array.from(new Set(normalizedNames));

  if (uniqueNames.length === 0) {
    return 0;
  }

  return uniqueNames.reduce((bestScore, name) => {
    const tokenScore = tokenizeClientName(name).filter((token) =>
      normalizedQuestion.includes(token),
    ).length;
    const score = tokenScore + (normalizedQuestion.includes(name) ? 10 : 0);
    return Math.max(bestScore, score);
  }, 0);
};

const pickClientFromQuestion = ({
  normalizedQuestion,
  context,
}: {
  normalizedQuestion: string;
  context: Record<string, unknown>;
}) => {
  const snapshot = isObject(context.snapshot) ? context.snapshot : null;
  const recentClients = getObjectArray(snapshot?.recentClients);

  if (recentClients.length === 0) {
    return null;
  }

  const rankedClients = recentClients
    .map((client) => {
      const clientName = getString(client.clientName);
      const billingName = getString(client.billingName);
      const operationalName = getString(client.operationalName);
      const score = scoreEntityNames({
        normalizedQuestion,
        names: [clientName, billingName, operationalName].filter(
          (value): value is string => Boolean(value),
        ),
      });

      return {
        client,
        score,
      };
    })
    .sort((left, right) => right.score - left.score);

  const firstClient = rankedClients[0];
  const secondClient = rankedClients[1];

  if (!firstClient) {
    return null;
  }

  if (
    firstClient.score > 0 &&
    (!secondClient || firstClient.score > secondClient.score)
  ) {
    return firstClient.client;
  }

  return null;
};

const inferProjectQuickEpisodeServiceType = (
  normalizedQuestion: string,
): ParsedUnifiedCrmProjectQuickEpisodeQuestion["serviceType"] => {
  const mentionsShooting = includesAny(normalizedQuestion, [
    "ripres",
    "ripresa",
  ]);
  const mentionsEditing = includesAny(normalizedQuestion, [
    "montagg",
    "editing",
    "post-produ",
  ]);

  if (mentionsShooting && mentionsEditing) {
    return "riprese_montaggio";
  }

  if (mentionsShooting) {
    return "riprese";
  }

  if (mentionsEditing) {
    return "montaggio";
  }

  if (includesAny(normalizedQuestion, ["fotograf"])) {
    return "fotografia";
  }

  if (includesAny(normalizedQuestion, ["web", "sito", "svilupp"])) {
    return "sviluppo_web";
  }

  return null;
};

const inferProjectQuickEpisodeNotes = (question: string) => {
  const compactQuestion = question.replace(/\s+/g, " ").trim();
  const interviewMatch = compactQuestion.match(
    /\b(?:abbiamo\s+)?intervistat[oaie]*\s+(.+?)(?=\s*(?:[-–—]|,|;|\.|:|\bcome\b|\btratta\b|\bspesa\b|\bservizio\b|$))/i,
  );

  if (interviewMatch?.[1]) {
    return `Intervista a ${interviewMatch[1].trim()}`;
  }

  return null;
};

const inferProjectQuickEpisodeRequestedLabel = (
  normalizedQuestion: string,
): ParsedUnifiedCrmProjectQuickEpisodeQuestion["requestedLabel"] => {
  if (includesAny(normalizedQuestion, ["puntat"])) {
    return "puntata";
  }

  if (includesAny(normalizedQuestion, ["serviz"])) {
    return "servizio";
  }

  return "lavoro";
};

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

const inferExpenseTypeFromQuestion = (
  normalizedQuestion: string,
): ParsedUnifiedCrmExpenseCreateQuestion["expenseType"] => {
  if (includesAny(normalizedQuestion, ["nolegg"])) {
    return "noleggio";
  }

  if (
    includesAny(normalizedQuestion, [
      "material",
      "attrezz",
      "acquist",
      "comprat",
    ])
  ) {
    return "acquisto_materiale";
  }

  return "altro";
};

const inferExpenseDescriptionFromQuestion = (
  question: string,
  normalizedQuestion: string,
) => {
  if (includesAny(normalizedQuestion, ["casell"])) {
    return "Casello autostradale";
  }

  if (includesAny(normalizedQuestion, ["pranz"])) {
    return "Pranzo";
  }

  if (includesAny(normalizedQuestion, ["cena"])) {
    return "Cena";
  }

  if (includesAny(normalizedQuestion, ["carbur", "benzin", "diesel"])) {
    return "Carburante";
  }

  if (includesAny(normalizedQuestion, ["nolegg"])) {
    return "Noleggio";
  }

  if (includesAny(normalizedQuestion, ["material", "attrezz", "acquist"])) {
    return "Acquisto materiale";
  }

  const compactQuestion = question.replace(/\s+/g, " ").trim();
  const explicitDescription =
    compactQuestion.match(
      /\b(?:spesa|costo|uscita)\s+(?:di|per)\s+(.+?)(?=\s+(?:da|di)?\s*(?:€|\d+(?:[.,]\d{1,2})?\s*(?:euro|eur))|[.;,]|$)/i,
    )?.[1] ??
    compactQuestion.match(
      /\b(?:pagamento|pagato)\s+(?:del|di|per)\s+(.+?)(?=\s+(?:€|\d+(?:[.,]\d{1,2})?\s*(?:euro|eur))|[.;,]|$)/i,
    )?.[1] ??
    null;

  return explicitDescription?.trim() ?? null;
};

const inferAmountFromQuestion = (question: string) => {
  const compactQuestion = question.replace(/\s+/g, " ").trim();
  const amountMatch =
    compactQuestion.match(/(?:€|eur(?:o)?)\s*(\d+(?:[.,]\d{1,2})?)/i)?.[1] ??
    compactQuestion.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur(?:o)?)/i)?.[1] ??
    compactQuestion.match(
      /\b(?:importo|totale|costo|spesa)\s+(?:di\s+)?(\d+(?:[.,]\d{1,2})?)/i,
    )?.[1] ??
    null;

  if (!amountMatch) {
    return null;
  }

  const normalizedAmount = Number(amountMatch.replace(",", "."));
  return Number.isFinite(normalizedAmount) ? normalizedAmount : null;
};

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

const quoteStatusesEligibleForPaymentCreation = new Set([
  "accettato",
  "acconto_ricevuto",
  "in_lavorazione",
  "completato",
]);

const buildListHref = (routePrefix: string, resource: string) =>
  `${routePrefix}${resource}`;

const buildCreateHref = (
  routePrefix: string,
  resource: string,
  searchParams: Record<string, string | null | undefined>,
) => {
  const query = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });

  const search = query.toString();
  return search
    ? `${routePrefix}${resource}/create?${search}`
    : `${routePrefix}${resource}/create`;
};

const normalizeConversationHistory = (
  value: unknown,
): UnifiedCrmAnswerPayload["conversationHistory"] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isObject)
    .map((item) => ({
      question: getString(item.question)?.trim() ?? "",
      answerMarkdown: getString(item.answerMarkdown)?.trim() ?? "",
      generatedAt: getString(item.generatedAt)?.trim() ?? "",
      model: getString(item.model)?.trim() ?? "",
    }))
    .filter(
      (item) =>
        item.question && item.answerMarkdown && item.generatedAt && item.model,
    )
    .slice(-6);
};

const buildShowHrefWithSearch = (
  routePrefix: string,
  resource: string,
  recordId: string | null,
  searchParams: Record<string, string | null | undefined>,
) => {
  const baseHref = buildShowHref(routePrefix, resource, recordId);

  if (!baseHref) {
    return null;
  }

  const query = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });

  const search = query.toString();
  return search ? `${baseHref}?${search}` : baseHref;
};

const buildShowHref = (
  routePrefix: string,
  resource: string,
  recordId: string | null,
) => (recordId ? `${routePrefix}${resource}/${recordId}/show` : null);

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

const getObjectArray = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value) ? value.filter(isObject) : [];

const canCreatePaymentFromQuoteStatus = (status: string | null) =>
  Boolean(status && quoteStatusesEligibleForPaymentCreation.has(status));

const inferPreferredPaymentType = (normalizedQuestion: string) => {
  if (includesAny(normalizedQuestion, ["rimborso spese", "rimborso", "spes"])) {
    return "rimborso_spese";
  }

  if (includesAny(normalizedQuestion, ["acconto", "anticip"])) {
    return "acconto";
  }

  if (includesAny(normalizedQuestion, ["saldo", "residu", "chiuder"])) {
    return "saldo";
  }

  if (includesAny(normalizedQuestion, ["parzial"])) {
    return "parziale";
  }

  return null;
};

const inferQuoteDraftPaymentType = (normalizedQuestion: string) => {
  const inferred = inferPreferredPaymentType(normalizedQuestion);

  if (
    inferred === "acconto" ||
    inferred === "saldo" ||
    inferred === "parziale"
  ) {
    return inferred;
  }

  return "parziale";
};

const inferProjectDraftPaymentType = (normalizedQuestion: string) => {
  const inferred = inferPreferredPaymentType(normalizedQuestion);

  if (
    inferred === "acconto" ||
    inferred === "saldo" ||
    inferred === "rimborso_spese"
  ) {
    return inferred;
  }

  return "saldo";
};

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

const formatIsoDateForHumans = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

const getProjectQuickEpisodeServiceTypeLabel = (
  serviceType: ParsedUnifiedCrmProjectQuickEpisodeQuestion["serviceType"],
) => {
  switch (serviceType) {
    case "riprese":
      return "Riprese";
    case "montaggio":
      return "Montaggio";
    case "riprese_montaggio":
      return "Riprese + Montaggio";
    case "fotografia":
      return "Fotografia";
    case "sviluppo_web":
      return "Sviluppo Web";
    case "altro":
      return "Altro";
    default:
      return null;
  }
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
        "Consigliata perche usa il workflow TV gia approvato del progetto e lascia la conferma finale all'utente prima della scrittura.",
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

const buildRecommendedReason = ({
  suggestion,
  focusPayments,
  focusQuotes,
  focusProjects,
  focusClients,
  quoteStatus,
}: {
  suggestion: UnifiedCrmSuggestedAction;
  focusPayments: boolean;
  focusQuotes: boolean;
  focusProjects: boolean;
  focusClients: boolean;
  quoteStatus: string | null;
}) => {
  if (suggestion.capabilityActionId === "quote_create_payment") {
    if (quoteStatus) {
      return `Consigliata perche il preventivo rilevante e' in stato ${quoteStatus} e qui il pagamento si apre gia precompilato dal record corretto.`;
    }

    return "Consigliata perche apre il pagamento gia precompilato dal preventivo corretto, senza inventare un nuovo workflow.";
  }

  if (suggestion.capabilityActionId === "client_create_payment") {
    return "Consigliata perche la domanda e' orientata all'incasso e qui il form pagamenti si apre gia sul cliente coerente.";
  }

  if (suggestion.capabilityActionId === "project_quick_payment") {
    return "Consigliata perche il progetto collegato e' gia la superficie approvata per proseguire il flusso commerciale.";
  }

  if (suggestion.capabilityActionId === "project_quick_episode") {
    return "Consigliata perche apre il workflow puntata gia approvato sul progetto corretto e lascia all'utente l'ultima conferma prima della scrittura.";
  }

  if (suggestion.capabilityActionId === "service_create") {
    return "Consigliata perche riusa il form Servizi gia approvato sul progetto corretto senza introdurre un nuovo workflow separato.";
  }

  if (suggestion.capabilityActionId === "expense_create") {
    return "Consigliata perche riusa il form Spese gia approvato con il collegamento corretto a cliente o cliente+progetto.";
  }

  if (suggestion.capabilityActionId === "expense_create_km") {
    return "Consigliata perche apre il form spese gia precompilato con la tratta km calcolata e lascia comunque l'ultima correzione all'utente.";
  }

  if (suggestion.capabilityActionId === "task_create") {
    return "Consigliata perche porta direttamente nel modulo Promemoria gia approvato per registrare follow-up e scadenze operative.";
  }

  if (suggestion.capabilityActionId === "generate_invoice_draft") {
    return "Consigliata perche apre una superficie gia approvata del CRM dove puoi generare la bozza fattura senza produrre documenti fiscali ufficiali.";
  }

  if (focusPayments && suggestion.resource === "quotes") {
    return "Consigliata perche prima di agire conviene verificare il preventivo collegato al pagamento pendente principale.";
  }

  if (focusQuotes && suggestion.resource === "quotes") {
    return "Consigliata perche il preventivo aperto principale e' il punto giusto da controllare prima di proseguire.";
  }

  if (focusProjects && suggestion.resource === "projects") {
    return "Consigliata perche il progetto attivo principale e' la superficie piu coerente da cui continuare.";
  }

  if (focusClients && suggestion.resource === "clients") {
    return "Consigliata perche la scheda cliente e' il punto piu diretto per verificare il contesto commerciale collegato.";
  }

  return "Consigliata come prossimo passo piu coerente con lo snapshot corrente.";
};

const markRecommendedSuggestion = ({
  suggestions,
  focusPayments,
  focusQuotes,
  focusProjects,
  focusClients,
  quoteStatus,
}: {
  suggestions: UnifiedCrmSuggestedAction[];
  focusPayments: boolean;
  focusQuotes: boolean;
  focusProjects: boolean;
  focusClients: boolean;
  quoteStatus: string | null;
}) =>
  suggestions.map((suggestion, index) =>
    index === 0
      ? {
          ...suggestion,
          recommended: true,
          recommendationReason: buildRecommendedReason({
            suggestion,
            focusPayments,
            focusQuotes,
            focusProjects,
            focusClients,
            quoteStatus,
          }),
        }
      : suggestion,
  );

export const buildUnifiedCrmPaymentDraft = ({
  normalizedQuestion,
  routePrefix,
  firstQuote,
  firstProject,
  preferPaymentAction,
  preferProjectDraft,
}: {
  normalizedQuestion: string;
  routePrefix: string;
  firstQuote: Record<string, unknown> | undefined;
  firstProject: Record<string, unknown> | undefined;
  preferPaymentAction: boolean;
  preferProjectDraft: boolean;
}): UnifiedCrmPaymentDraft | null => {
  if (
    !preferPaymentAction ||
    !includesAny(normalizedQuestion, [
      "prepar",
      "bozza",
      "registr",
      "aggiung",
      "crea",
    ])
  ) {
    return null;
  }

  const buildProjectDraft = () => {
    const projectId = getString(firstProject?.projectId);
    const clientId = getString(firstProject?.clientId);
    const totalFees = getNumber(firstProject?.totalFees);
    const totalExpenses = getNumber(firstProject?.totalExpenses);
    const balanceDue = getNumber(firstProject?.balanceDue);

    if (!projectId || !clientId) {
      return null;
    }

    const paymentType = inferProjectDraftPaymentType(normalizedQuestion);
    const amount =
      paymentType === "rimborso_spese"
        ? totalExpenses
        : paymentType === "acconto"
          ? totalFees
          : balanceDue;

    if (amount == null || amount <= 0) {
      return null;
    }

    const href = buildShowHrefWithSearch(routePrefix, "projects", projectId, {
      project_id: projectId,
      client_id: clientId,
      launcher_source: "unified_ai_launcher",
      launcher_action: "project_quick_payment",
      open_dialog: "quick_payment",
      payment_type: paymentType,
      amount: String(amount),
      status: "in_attesa",
      draft_kind: "project_quick_payment",
    });

    if (!href) {
      return null;
    }

    return {
      id: "payment-draft-from-active-project",
      resource: "payments" as const,
      originActionId: "project_quick_payment" as const,
      draftKind: "project_quick_payment" as const,
      label: "Bozza quick payment dal progetto attivo",
      explanation:
        "Questa bozza usa i financials del progetto attivo principale. Puoi correggere importo, tipo e stato qui e poi aprire il quick payment del progetto per confermare davvero.",
      quoteId: null,
      clientId,
      projectId,
      paymentType,
      amount,
      status: "in_attesa" as const,
      href,
    };
  };

  if (preferProjectDraft) {
    const projectDraft = buildProjectDraft();
    if (projectDraft) {
      return projectDraft;
    }
  }

  const quoteId = getString(firstQuote?.quoteId);
  const clientId = getString(firstQuote?.clientId);
  const projectId = getString(firstQuote?.projectId);
  const remainingAmount = getNumber(firstQuote?.remainingAmount);
  const status = getString(firstQuote?.status);

  if (
    !quoteId ||
    !clientId ||
    !canCreatePaymentFromQuoteStatus(status) ||
    remainingAmount == null ||
    remainingAmount <= 0
  ) {
    return preferProjectDraft ? buildProjectDraft() : null;
  }

  const paymentType = inferQuoteDraftPaymentType(normalizedQuestion);
  const href = buildCreateHref(routePrefix, "payments", {
    quote_id: quoteId,
    client_id: clientId,
    project_id: projectId,
    payment_type: paymentType,
    amount: String(remainingAmount),
    status: "in_attesa",
    launcher_source: "unified_ai_launcher",
    launcher_action: "quote_create_payment",
    draft_kind: "payment_create",
  });

  return {
    id: "payment-draft-from-open-quote",
    resource: "payments",
    originActionId: "quote_create_payment",
    draftKind: "payment_create",
    label: "Bozza pagamento dal preventivo aperto",
    explanation:
      "Questa bozza usa il residuo ancora non collegato del preventivo aperto principale. Puoi correggerla qui e poi aprire il form pagamenti per confermare davvero.",
    quoteId,
    clientId,
    projectId,
    paymentType,
    amount: remainingAmount,
    status: "in_attesa",
    href,
  };
};

export const buildUnifiedCrmSuggestedActions = ({
  question,
  context,
}: {
  question: string;
  context: Record<string, unknown>;
}): UnifiedCrmSuggestedAction[] => {
  const normalizedQuestion = normalizeText(question);
  const routePrefix = getRoutePrefix(context);
  const snapshot = isObject(context.snapshot) ? context.snapshot : {};

  const recentClients = getObjectArray(snapshot.recentClients);
  const recentContacts = getObjectArray(snapshot.recentContacts);
  const openQuotes = getObjectArray(snapshot.openQuotes);
  const activeProjects = getObjectArray(snapshot.activeProjects);
  const pendingPayments = getObjectArray(snapshot.pendingPayments);
  const recentExpenses = getObjectArray(snapshot.recentExpenses);

  const suggestions: UnifiedCrmSuggestedAction[] = [];
  const seenHrefs = new Set<string>();

  const pushSuggestion = (suggestion: UnifiedCrmSuggestedAction | null) => {
    if (!suggestion || seenHrefs.has(suggestion.href)) {
      return;
    }

    seenHrefs.add(suggestion.href);
    suggestions.push(suggestion);
  };

  const firstClient = recentClients[0];
  const firstContact = recentContacts[0];
  const firstQuote = openQuotes[0];
  const firstProject = activeProjects[0];
  const firstPayment = pendingPayments[0];
  const firstExpense = recentExpenses[0];

  const focusPayments = includesAny(normalizedQuestion, [
    "pagament",
    "incass",
    "saldo",
    "acconto",
    "scadut",
    "sollecit",
    "deve ancora pag",
    "in attesa",
  ]);
  const focusQuotes = includesAny(normalizedQuestion, [
    "preventiv",
    "offert",
    "trattativa",
    "apert",
    "accettat",
  ]);
  const focusProjects = includesAny(normalizedQuestion, [
    "progett",
    "lavor",
    "attiv",
  ]);
  const focusExpenses = includesAny(normalizedQuestion, [
    "spes",
    "cost",
    "fornitor",
    "uscit",
    "rimbor",
    "nolegg",
  ]);
  const expenseCreationIntent = hasExpenseCreationIntent(normalizedQuestion);
  const focusTasks = hasTaskIntent(normalizedQuestion);
  const taskCreationIntent = hasTaskCreationIntent(normalizedQuestion);
  const invoiceDraftIntent = hasInvoiceDraftIntent(normalizedQuestion);
  const focusContacts = includesAny(normalizedQuestion, [
    "referent",
    "contatt",
    "persona",
    "telefono",
    "cellulare",
    "mail",
    "email",
    "linkedin",
  ]);
  const focusClients = includesAny(normalizedQuestion, [
    "client",
    "anagraf",
    "azienda",
    "ragione sociale",
    "fatturaz",
  ]);
  const preferPaymentAction =
    (focusPayments || focusQuotes || focusProjects || focusClients) &&
    !expenseCreationIntent &&
    !taskCreationIntent &&
    !invoiceDraftIntent &&
    includesAny(normalizedQuestion, [
      "registr",
      "aggiung",
      "inser",
      "crea",
      "segn",
      "incass",
      "precompilat",
      "prepar",
      "bozza",
    ]);
  const preferProjectQuickPaymentLanding =
    focusProjects &&
    preferPaymentAction &&
    Boolean(firstProject) &&
    !firstPayment;
  const genericSummary =
    includesAny(normalizedQuestion, [
      "riepilog",
      "riassunt",
      "panoram",
      "situaz",
      "operativ",
      "crm",
      "attenzion",
      "subito",
    ]) ||
    (!focusPayments &&
      !focusQuotes &&
      !focusProjects &&
      !focusExpenses &&
      !focusTasks &&
      !focusContacts &&
      !focusClients);
  const inferredPaymentType = inferPreferredPaymentType(normalizedQuestion);
  const launcherCreatePaymentContext = {
    launcher_source: "unified_ai_launcher",
    payment_type: inferredPaymentType,
  };

  const paymentHref = buildShowHref(
    routePrefix,
    "payments",
    getString(firstPayment?.paymentId),
  );
  const paymentQuoteHref = buildShowHref(
    routePrefix,
    "quotes",
    getString(firstPayment?.quoteId),
  );
  const paymentClientHref = buildShowHref(
    routePrefix,
    "clients",
    getString(firstPayment?.clientId),
  );
  const paymentProjectHref = buildShowHrefWithSearch(
    routePrefix,
    "projects",
    getString(firstPayment?.projectId),
    {
      launcher_source: "unified_ai_launcher",
      launcher_action: "project_quick_payment",
      open_dialog: "quick_payment",
      payment_type: inferredPaymentType,
    },
  );
  const quoteHref = buildShowHref(
    routePrefix,
    "quotes",
    getString(firstQuote?.quoteId),
  );
  const quoteCreatePaymentHref = canCreatePaymentFromQuoteStatus(
    getString(firstQuote?.status),
  )
    ? buildCreateHref(routePrefix, "payments", {
        quote_id: getString(firstQuote?.quoteId),
        client_id: getString(firstQuote?.clientId),
        project_id: getString(firstQuote?.projectId),
        launcher_action: "quote_create_payment",
        ...launcherCreatePaymentContext,
      })
    : null;
  const quoteClientHref = buildShowHref(
    routePrefix,
    "clients",
    getString(firstQuote?.clientId),
  );
  const quoteProjectHref = buildShowHrefWithSearch(
    routePrefix,
    "projects",
    getString(firstQuote?.projectId),
    {
      launcher_source: "unified_ai_launcher",
      launcher_action: "project_quick_payment",
      open_dialog: "quick_payment",
      payment_type: inferredPaymentType,
    },
  );
  const projectHref = buildShowHref(
    routePrefix,
    "projects",
    getString(firstProject?.projectId),
  );
  const projectQuickPaymentHref = buildShowHrefWithSearch(
    routePrefix,
    "projects",
    getString(firstProject?.projectId),
    {
      launcher_source: "unified_ai_launcher",
      launcher_action: "project_quick_payment",
      open_dialog: "quick_payment",
      payment_type: inferredPaymentType,
    },
  );
  const projectClientHref = buildShowHref(
    routePrefix,
    "clients",
    getString(firstProject?.clientId),
  );
  const expenseHref = buildShowHref(
    routePrefix,
    "expenses",
    getString(firstExpense?.expenseId),
  );
  const clientHref = buildShowHref(
    routePrefix,
    "clients",
    getString(firstClient?.clientId),
  );
  const contactHref = buildShowHref(
    routePrefix,
    "contacts",
    getString(firstContact?.contactId),
  );
  const clientCreatePaymentHref = getString(firstClient?.clientId)
    ? buildCreateHref(routePrefix, "payments", {
        client_id: getString(firstClient?.clientId),
        launcher_action: "client_create_payment",
        ...launcherCreatePaymentContext,
      })
    : null;
  const paymentClientCreateHref = getString(firstPayment?.clientId)
    ? buildCreateHref(routePrefix, "payments", {
        client_id: getString(firstPayment?.clientId),
        launcher_action: "client_create_payment",
        ...launcherCreatePaymentContext,
      })
    : null;

  if (genericSummary) {
    pushSuggestion(
      quoteHref
        ? {
            id: "open-first-open-quote",
            kind: "show",
            resource: "quotes",
            label: "Apri il preventivo aperto piu rilevante",
            description:
              "Vai al dettaglio del primo preventivo aperto nello snapshot corrente.",
            href: quoteHref,
          }
        : null,
    );
    pushSuggestion(
      quoteCreatePaymentHref
        ? {
            id: "quote-create-payment-handoff",
            kind: "approved_action",
            resource: "payments",
            capabilityActionId: "quote_create_payment",
            label: "Registra un pagamento dal preventivo",
            description:
              "Apre il form pagamenti gia precompilato dal preventivo aperto principale.",
            href: quoteCreatePaymentHref,
          }
        : null,
    );
    pushSuggestion(
      clientCreatePaymentHref
        ? {
            id: "client-create-payment-handoff",
            kind: "approved_action",
            resource: "payments",
            capabilityActionId: "client_create_payment",
            label: "Registra un pagamento diretto dal cliente",
            description:
              "Apre il form pagamenti precompilato sul cliente piu recente dello snapshot.",
            href: clientCreatePaymentHref,
          }
        : {
            id: "open-dashboard",
            kind: "page",
            resource: "dashboard",
            label: "Apri la dashboard",
            description:
              "Usa la dashboard come quadro generale prima di aprire un record specifico.",
            href: routePrefix,
          },
    );
  } else if (invoiceDraftIntent) {
    // Context-aware entity matching: find the specific client/project mentioned
    const matchedClient = pickClientFromQuestion({
      normalizedQuestion,
      context,
    });
    const matchedProject = pickProjectFromQuestion({
      normalizedQuestion,
      context,
    });
    const matchedClientId = matchedClient
      ? getString(matchedClient.clientId)
      : null;
    const matchedProjectId = matchedProject
      ? getString(matchedProject.projectId)
      : null;

    // Find relevant surfaces scoped to the matched entity
    const draftQuote = matchedClientId
      ? openQuotes.find((q) => getString(q.clientId) === matchedClientId)
      : matchedProjectId
        ? openQuotes.find((q) => getString(q.projectId) === matchedProjectId)
        : firstQuote;
    const draftProjectRecord = matchedProjectId
      ? matchedProject
      : matchedClientId
        ? activeProjects.find(
            (p) => getString(p.clientId) === matchedClientId,
          )
        : firstProject;
    const draftClientRecord = matchedClient ?? firstClient;

    const draftQuoteHref = buildShowHrefWithSearch(
      routePrefix,
      "quotes",
      getString(draftQuote?.quoteId),
      { invoiceDraft: "true" },
    );
    const draftProjectHref = buildShowHrefWithSearch(
      routePrefix,
      "projects",
      getString(draftProjectRecord?.projectId),
      { invoiceDraft: "true" },
    );
    const draftClientHref = buildShowHrefWithSearch(
      routePrefix,
      "clients",
      getString(draftClientRecord?.clientId),
      { invoiceDraft: "true" },
    );

    // Show ALL available invoice draft surfaces (not a single fixed cascade)
    pushSuggestion(
      draftQuoteHref
        ? {
            id: "open-quote-for-invoice-draft",
            kind: "approved_action" as const,
            resource: "quotes" as const,
            capabilityActionId: "generate_invoice_draft" as const,
            label: "Genera bozza fattura dal preventivo",
            description:
              "Nella scheda preventivo trovi il bottone per generare una bozza fattura interna da usare come riferimento Aruba.",
            href: draftQuoteHref,
          }
        : null,
    );
    pushSuggestion(
      draftProjectHref
        ? {
            id: "open-project-for-invoice-draft",
            kind: "approved_action" as const,
            resource: "projects" as const,
            capabilityActionId: "generate_invoice_draft" as const,
            label: "Genera bozza fattura dal progetto",
            description:
              "Nella scheda progetto trovi il bottone per generare una bozza fattura interna.",
            href: draftProjectHref,
          }
        : null,
    );
    pushSuggestion(
      draftClientHref
        ? {
            id: "open-client-for-invoice-draft",
            kind: "approved_action" as const,
            resource: "clients" as const,
            capabilityActionId: "generate_invoice_draft" as const,
            label: "Genera bozza fattura dal cliente",
            description:
              "Nella scheda cliente puoi generare la bozza fattura da tutti i servizi non ancora fatturati.",
            href: draftClientHref,
          }
        : null,
    );
  } else if (preferProjectQuickPaymentLanding) {
    const projectShowSuggestion = projectHref
      ? {
          id: "open-first-active-project",
          kind: "show" as const,
          resource: "projects" as const,
          capabilityActionId: "follow_unified_crm_handoff" as const,
          label: "Apri il progetto attivo principale",
          description:
            "Vai al dettaglio del primo progetto attivo nello snapshot corrente.",
          href: projectHref,
        }
      : null;
    const projectApprovedSuggestion = projectQuickPaymentHref
      ? {
          id: "project-quick-payment-handoff",
          kind: "approved_action" as const,
          resource: "projects" as const,
          capabilityActionId: "project_quick_payment" as const,
          label: "Apri il progetto e usa Pagamento",
          description:
            "Apre il progetto attivo principale con contesto launcher e quick payment pronto da aprire.",
          href: projectQuickPaymentHref,
        }
      : null;

    pushSuggestion(projectApprovedSuggestion);
    pushSuggestion(projectShowSuggestion);
    pushSuggestion(
      projectClientHref
        ? {
            id: "open-linked-client-from-project",
            kind: "show",
            resource: "clients",
            capabilityActionId: "follow_unified_crm_handoff",
            label: "Apri il cliente collegato",
            description:
              "Vai alla scheda cliente collegata al primo progetto attivo.",
            href: projectClientHref,
          }
        : {
            id: "open-projects-list",
            kind: "list",
            resource: "projects",
            capabilityActionId: "follow_unified_crm_handoff",
            label: "Apri tutti i progetti",
            description:
              "Controlla la lista completa dei progetti per approfondire stato e lavori attivi.",
            href: buildListHref(routePrefix, "projects"),
          },
    );
  } else if (focusPayments) {
    const paymentShowSuggestion = paymentQuoteHref
      ? {
          id: "open-linked-quote-from-payment",
          kind: "show" as const,
          resource: "quotes" as const,
          capabilityActionId: "follow_unified_crm_handoff" as const,
          label: "Apri il preventivo collegato",
          description:
            "Vai al preventivo collegato al pagamento pendente piu rilevante.",
          href: paymentQuoteHref,
        }
      : paymentHref
        ? {
            id: "open-first-pending-payment",
            kind: "show" as const,
            resource: "payments" as const,
            capabilityActionId: "follow_unified_crm_handoff" as const,
            label: "Apri il pagamento piu urgente",
            description:
              "Vai al dettaglio del primo pagamento pendente nello snapshot corrente.",
            href: paymentHref,
          }
        : null;
    const paymentApprovedSuggestion = quoteCreatePaymentHref
      ? {
          id: "quote-create-payment-handoff",
          kind: "approved_action" as const,
          resource: "payments" as const,
          capabilityActionId: "quote_create_payment" as const,
          label: "Registra un altro pagamento dal preventivo",
          description:
            "Apre il form pagamenti gia precompilato dal preventivo aperto piu rilevante.",
          href: quoteCreatePaymentHref,
        }
      : paymentClientCreateHref
        ? {
            id: "client-create-payment-from-payment-context",
            kind: "approved_action" as const,
            resource: "payments" as const,
            capabilityActionId: "client_create_payment" as const,
            label: "Registra un pagamento diretto dal cliente",
            description:
              "Apre il form pagamenti precompilato sul cliente del pagamento pendente principale.",
            href: paymentClientCreateHref,
          }
        : null;

    if (preferPaymentAction) {
      pushSuggestion(paymentApprovedSuggestion);
      pushSuggestion(paymentShowSuggestion);
    } else {
      pushSuggestion(paymentShowSuggestion);
      pushSuggestion(paymentApprovedSuggestion);
    }
    pushSuggestion(
      paymentProjectHref
        ? {
            id: "project-quick-payment-handoff-from-payment-context",
            kind: "approved_action",
            resource: "projects",
            capabilityActionId: "project_quick_payment",
            label: "Apri il progetto e usa Pagamento",
            description:
              "Apre il progetto collegato con contesto launcher e quick payment pronto da aprire.",
            href: paymentProjectHref,
          }
        : paymentClientHref
          ? {
              id: "open-linked-client-from-payment",
              kind: "show",
              resource: "clients",
              capabilityActionId: "follow_unified_crm_handoff",
              label: "Apri il cliente collegato",
              description:
                "Vai alla scheda cliente collegata al primo pagamento pendente.",
              href: paymentClientHref,
            }
          : null,
    );
  } else if (focusQuotes) {
    const quoteShowSuggestion = quoteHref
      ? {
          id: "open-first-open-quote",
          kind: "show" as const,
          resource: "quotes" as const,
          capabilityActionId: "follow_unified_crm_handoff" as const,
          label: "Apri il preventivo aperto piu rilevante",
          description:
            "Vai al dettaglio del primo preventivo aperto nello snapshot corrente.",
          href: quoteHref,
        }
      : null;
    const quoteApprovedSuggestion = quoteCreatePaymentHref
      ? {
          id: "quote-create-payment-handoff",
          kind: "approved_action" as const,
          resource: "payments" as const,
          capabilityActionId: "quote_create_payment" as const,
          label: "Registra pagamento dal preventivo",
          description:
            "Apre il form pagamenti gia precompilato dal preventivo aperto principale.",
          href: quoteCreatePaymentHref,
        }
      : quoteProjectHref
        ? {
            id: "project-quick-payment-handoff-from-quote",
            kind: "approved_action" as const,
            resource: "projects" as const,
            capabilityActionId: "project_quick_payment" as const,
            label: "Apri il progetto e usa Pagamento",
            description:
              "Apre il progetto collegato con contesto launcher e quick payment pronto da aprire.",
            href: quoteProjectHref,
          }
        : null;

    if (preferPaymentAction) {
      pushSuggestion(quoteApprovedSuggestion);
      pushSuggestion(quoteShowSuggestion);
    } else {
      pushSuggestion(quoteShowSuggestion);
      pushSuggestion(quoteApprovedSuggestion);
    }
    pushSuggestion(
      quoteClientHref
        ? {
            id: "open-linked-client-from-quote",
            kind: "show",
            resource: "clients",
            capabilityActionId: "follow_unified_crm_handoff",
            label: "Apri il cliente collegato",
            description:
              "Vai alla scheda cliente collegata al primo preventivo aperto.",
            href: quoteClientHref,
          }
        : {
            id: "open-quotes-list",
            kind: "list",
            resource: "quotes",
            capabilityActionId: "follow_unified_crm_handoff",
            label: "Apri tutti i preventivi",
            description:
              "Controlla la lista completa dei preventivi per vedere pipeline e stati.",
            href: buildListHref(routePrefix, "quotes"),
          },
    );
  } else if (taskCreationIntent || focusTasks) {
    pushSuggestion({
      id: "task-create-handoff",
      kind: "approved_action",
      resource: "client_tasks",
      capabilityActionId: "task_create",
      label: "Apri Promemoria e crea un follow-up",
      description:
        "Vai nel modulo Promemoria per registrare subito l'attività con scadenza.",
      href: `${buildListHref(routePrefix, "client_tasks")}?launcher_source=unified_ai_launcher&launcher_action=task_create`,
    });
    pushSuggestion(
      clientHref
        ? {
            id: "open-first-client-from-task-context",
            kind: "show",
            resource: "clients",
            capabilityActionId: "follow_unified_crm_handoff",
            label: "Apri il cliente collegato",
            description:
              "Controlla il cliente principale dello snapshot prima di confermare il promemoria.",
            href: clientHref,
          }
        : null,
    );
  } else if (focusExpenses || expenseCreationIntent) {
    pushSuggestion(
      expenseHref
        ? {
            id: "open-first-recent-expense",
            kind: "show",
            resource: "expenses",
            capabilityActionId: "follow_unified_crm_handoff",
            label: "Apri la spesa piu recente",
            description:
              "Vai al dettaglio della prima spesa recente nello snapshot corrente.",
            href: expenseHref,
          }
        : null,
    );
    pushSuggestion({
      id: "open-expenses-list",
      kind: "list",
      resource: "expenses",
      label: "Apri tutte le spese",
      description:
        "Controlla la lista completa delle spese per proseguire sul flusso costi e rimborsi, non su quello pagamenti.",
      href: buildListHref(routePrefix, "expenses"),
    });
    pushSuggestion(
      projectHref
        ? {
            id: "open-first-active-project-from-expense-context",
            kind: "show",
            resource: "projects",
            capabilityActionId: "follow_unified_crm_handoff",
            label: "Apri il progetto collegato",
            description:
              "Usa il progetto attivo come contesto operativo, ma continua il salvataggio dalla risorsa spese.",
            href: projectHref,
          }
        : null,
    );
  } else if (focusProjects) {
    const projectShowSuggestion = projectHref
      ? {
          id: "open-first-active-project",
          kind: "show" as const,
          resource: "projects" as const,
          capabilityActionId: "follow_unified_crm_handoff" as const,
          label: "Apri il progetto attivo principale",
          description:
            "Vai al dettaglio del primo progetto attivo nello snapshot corrente.",
          href: projectHref,
        }
      : null;
    const projectApprovedSuggestion = projectQuickPaymentHref
      ? {
          id: "project-quick-payment-handoff",
          kind: "approved_action" as const,
          resource: "projects" as const,
          capabilityActionId: "project_quick_payment" as const,
          label: "Apri il progetto e usa Pagamento",
          description:
            "Apre il progetto attivo principale con contesto launcher e quick payment pronto da aprire.",
          href: projectQuickPaymentHref,
        }
      : null;

    if (preferPaymentAction) {
      pushSuggestion(projectApprovedSuggestion);
      pushSuggestion(projectShowSuggestion);
    } else {
      pushSuggestion(projectShowSuggestion);
      pushSuggestion(projectApprovedSuggestion);
    }
    pushSuggestion(
      projectClientHref
        ? {
            id: "open-linked-client-from-project",
            kind: "show",
            resource: "clients",
            capabilityActionId: "follow_unified_crm_handoff",
            label: "Apri il cliente collegato",
            description:
              "Vai alla scheda cliente collegata al primo progetto attivo.",
            href: projectClientHref,
          }
        : {
            id: "open-projects-list",
            kind: "list",
            resource: "projects",
            capabilityActionId: "follow_unified_crm_handoff",
            label: "Apri tutti i progetti",
            description:
              "Controlla la lista completa dei progetti per approfondire stato e lavori attivi.",
            href: buildListHref(routePrefix, "projects"),
          },
    );
  } else if (focusContacts) {
    pushSuggestion(
      contactHref
        ? {
            id: "open-first-recent-contact",
            kind: "show",
            resource: "contacts",
            capabilityActionId: "follow_unified_crm_handoff",
            label: "Apri il referente piu recente",
            description:
              "Vai alla scheda del referente piu recente presente nello snapshot corrente.",
            href: contactHref,
          }
        : {
            id: "open-contacts-list",
            kind: "list",
            resource: "contacts",
            capabilityActionId: "follow_unified_crm_handoff",
            label: "Apri tutti i referenti",
            description:
              "Controlla l'anagrafica referenti per vedere persone, recapiti e relazioni con clienti e progetti.",
            href: buildListHref(routePrefix, "contacts"),
          },
    );
    pushSuggestion(
      buildShowHref(routePrefix, "clients", getString(firstContact?.clientId))
        ? {
            id: "open-linked-client-from-contact",
            kind: "show",
            resource: "clients",
            capabilityActionId: "follow_unified_crm_handoff",
            label: "Apri il cliente collegato",
            description:
              "Vai alla scheda cliente collegata al referente principale dello snapshot.",
            href: buildShowHref(
              routePrefix,
              "clients",
              getString(firstContact?.clientId),
            ),
          }
        : null,
    );
    pushSuggestion(
      buildShowHref(
        routePrefix,
        "projects",
        getString(getObjectArray(firstContact?.linkedProjects)[0]?.projectId),
      )
        ? {
            id: "open-linked-project-from-contact",
            kind: "show",
            resource: "projects",
            capabilityActionId: "follow_unified_crm_handoff",
            label: "Apri il progetto collegato",
            description:
              "Vai al primo progetto collegato al referente principale dello snapshot.",
            href: buildShowHref(
              routePrefix,
              "projects",
              getString(
                getObjectArray(firstContact?.linkedProjects)[0]?.projectId,
              ),
            ),
          }
        : null,
    );
  } else if (focusClients) {
    const clientShowSuggestion = clientHref
      ? {
          id: "open-first-recent-client",
          kind: "show" as const,
          resource: "clients" as const,
          capabilityActionId: "follow_unified_crm_handoff" as const,
          label: "Apri il cliente piu recente",
          description:
            "Vai alla scheda del cliente piu recente presente nello snapshot corrente.",
          href: clientHref,
        }
      : null;
    const clientApprovedSuggestion = clientCreatePaymentHref
      ? {
          id: "client-create-payment-handoff",
          kind: "approved_action" as const,
          resource: "payments" as const,
          capabilityActionId: "client_create_payment" as const,
          label: "Registra pagamento dal cliente",
          description:
            "Apre il form pagamenti precompilato sul cliente piu recente dello snapshot.",
          href: clientCreatePaymentHref,
        }
      : {
          id: "open-clients-list",
          kind: "list" as const,
          resource: "clients" as const,
          capabilityActionId: "follow_unified_crm_handoff" as const,
          label: "Apri tutti i clienti",
          description:
            "Controlla l'anagrafica completa per approfondire i clienti nel CRM.",
          href: buildListHref(routePrefix, "clients"),
        };

    if (preferPaymentAction && clientCreatePaymentHref) {
      pushSuggestion(clientApprovedSuggestion);
      pushSuggestion(clientShowSuggestion);
    } else {
      pushSuggestion(clientShowSuggestion);
      pushSuggestion(clientApprovedSuggestion);
    }
    pushSuggestion(
      quoteHref
        ? {
            id: "open-open-quote-from-client-context",
            kind: "show",
            resource: "quotes",
            capabilityActionId: "follow_unified_crm_handoff",
            label: "Apri il preventivo aperto collegato",
            description:
              "Apri un preventivo aperto dallo snapshot per proseguire il controllo commerciale.",
            href: quoteHref,
          }
        : null,
    );
  }

  if (suggestions.length === 0) {
    pushSuggestion({
      id: "open-dashboard",
      kind: "page",
      resource: "dashboard",
      label: "Torna alla dashboard",
      description:
        "Riapri la dashboard come punto di partenza per proseguire l'analisi operativa.",
      href: routePrefix,
    });
  }

  return markRecommendedSuggestion({
    suggestions: suggestions.slice(0, 3),
    focusPayments,
    focusQuotes,
    focusProjects,
    focusClients: focusClients || focusContacts,
    quoteStatus: getString(firstQuote?.status),
  });
};

export const buildUnifiedCrmPaymentDraftFromContext = ({
  question,
  context,
}: {
  question: string;
  context: Record<string, unknown>;
}) => {
  const normalizedQuestion = normalizeText(question);
  const snapshot = isObject(context.snapshot) ? context.snapshot : {};
  const routePrefix = getRoutePrefix(context);
  const firstQuote = getObjectArray(snapshot.openQuotes)[0];
  const firstProject = getObjectArray(snapshot.activeProjects)[0];
  const focusPayments = includesAny(normalizedQuestion, [
    "pagament",
    "incass",
    "saldo",
    "acconto",
    "scadut",
    "sollecit",
    "deve ancora pag",
    "in attesa",
  ]);
  const focusQuotes = includesAny(normalizedQuestion, [
    "preventiv",
    "offert",
    "trattativa",
    "apert",
    "accettat",
  ]);
  const focusProjects = includesAny(normalizedQuestion, [
    "progett",
    "lavor",
    "attiv",
  ]);
  const focusClients = includesAny(normalizedQuestion, [
    "client",
    "anagraf",
    "contatt",
  ]);
  const expenseCreationIntent = hasExpenseCreationIntent(normalizedQuestion);
  const preferPaymentAction =
    (focusPayments || focusQuotes || focusProjects || focusClients) &&
    !expenseCreationIntent &&
    includesAny(normalizedQuestion, [
      "registr",
      "aggiung",
      "inser",
      "crea",
      "segn",
      "incass",
      "precompilat",
      "prepar",
      "bozza",
    ]);
  const preferProjectDraft =
    focusProjects &&
    !focusQuotes &&
    includesAny(normalizedQuestion, ["progett", "attiv", "lavor"]);

  return buildUnifiedCrmPaymentDraft({
    normalizedQuestion,
    routePrefix,
    firstQuote,
    firstProject,
    preferPaymentAction,
    preferProjectDraft,
  });
};

export const validateUnifiedCrmAnswerPayload = (payload: unknown) => {
  if (!isObject(payload)) {
    return { error: "Payload non valido", data: null };
  }

  if (typeof payload.model !== "string" || !payload.model.trim()) {
    return { error: "Il modello e obbligatorio", data: null };
  }

  if (typeof payload.question !== "string" || !payload.question.trim()) {
    return { error: "La domanda e obbligatoria", data: null };
  }

  const trimmedQuestion = payload.question.trim();
  if (trimmedQuestion.length > unifiedCrmAnswerMaxQuestionLength) {
    return {
      error: `La domanda e troppo lunga. Limite: ${unifiedCrmAnswerMaxQuestionLength} caratteri.`,
      data: null,
    };
  }

  if (!isObject(payload.context)) {
    return { error: "Manca il contesto CRM unificato", data: null };
  }

  const meta = isObject(payload.context.meta) ? payload.context.meta : null;
  const snapshot = isObject(payload.context.snapshot)
    ? payload.context.snapshot
    : null;
  const registries = isObject(payload.context.registries)
    ? payload.context.registries
    : null;

  if (!meta || meta.scope !== requiredScope) {
    return {
      error: "Il contesto CRM unificato non ha lo scope read-only atteso",
      data: null,
    };
  }

  if (!snapshot || !registries) {
    return { error: "Il contesto CRM unificato e incompleto", data: null };
  }

  return {
    error: null,
    data: {
      context: payload.context,
      question: trimmedQuestion,
      model: payload.model,
      conversationHistory: normalizeConversationHistory(
        payload.conversationHistory,
      ),
    } satisfies UnifiedCrmAnswerPayload,
  };
};
