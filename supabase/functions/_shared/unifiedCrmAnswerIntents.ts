import type {
  ParsedUnifiedCrmExpenseCreateQuestion,
  ParsedUnifiedCrmProjectQuickEpisodeQuestion,
} from "./unifiedCrmAnswerTypes.ts";
import {
  formatDateInTimezone,
  getObjectArray,
  getString,
  includesAny,
  isObject,
  italianMonthNumbers,
  normalizeText,
  tokenizeClientName,
  tokenizeProjectName,
  type DraftPaymentType,
} from "./unifiedCrmAnswerUtils.ts";

// ---------------------------------------------------------------------------
// Intent detection
// ---------------------------------------------------------------------------

export const hasTravelIntent = (normalizedQuestion: string) =>
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

export const hasExpenseIntent = (normalizedQuestion: string) =>
  includesAny(normalizedQuestion, [
    "spes",
    "rimbor",
    "costo",
    "spostament",
    "uscit",
    "fornitor",
    "nolegg",
  ]);

export const hasExpenseCreationIntent = (normalizedQuestion: string) =>
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

export const hasTaskIntent = (normalizedQuestion: string) =>
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

export const hasTaskCreationIntent = (normalizedQuestion: string) =>
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

export const hasInvoiceDraftIntent = (normalizedQuestion: string) => {
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

export const hasTravelEstimationIntent = (normalizedQuestion: string) =>
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

export const hasProjectQuickEpisodeIntent = (normalizedQuestion: string) =>
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

// ---------------------------------------------------------------------------
// Travel route parsing
// ---------------------------------------------------------------------------

export const stripTrailingTravelContext = (value: string) =>
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

export const splitTravelRoute = (value: string) => {
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

export const getNamedTravelRouteSource = (question: string) => {
  const compactQuestion = question.replace(/\s+/g, " ").trim();
  return (
    compactQuestion.match(/\btratta\s+(.+)$/i)?.[1] ??
    compactQuestion.match(/\bpercor(?:so|sa)?\s+(.+)$/i)?.[1] ??
    null
  );
};

export const getTravelRouteSource = (question: string) => {
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

export const buildImplicitTravelRouteCandidates = (value: string) => {
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

// ---------------------------------------------------------------------------
// Entity matching
// ---------------------------------------------------------------------------

export const pickProjectFromQuestion = ({
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

export const scoreEntityNames = ({
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

export const pickClientFromQuestion = ({
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

// ---------------------------------------------------------------------------
// Inference helpers
// ---------------------------------------------------------------------------

export const inferDateFromQuestion = (
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

export const inferProjectQuickEpisodeServiceType = (
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

export const inferProjectQuickEpisodeNotes = (question: string) => {
  const compactQuestion = question.replace(/\s+/g, " ").trim();
  const interviewMatch = compactQuestion.match(
    /\b(?:abbiamo\s+)?intervistat[oaie]*\s+(.+?)(?=\s*(?:[-–—]|,|;|\.|:|\bcome\b|\btratta\b|\bspesa\b|\bservizio\b|$))/i,
  );

  if (interviewMatch?.[1]) {
    return `Intervista a ${interviewMatch[1].trim()}`;
  }

  return null;
};

export const inferProjectQuickEpisodeRequestedLabel = (
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

export const getProjectQuickEpisodeServiceTypeLabel = (
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

export const inferExpenseTypeFromQuestion = (
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

export const inferExpenseDescriptionFromQuestion = (
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

export const inferAmountFromQuestion = (question: string) => {
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

export const inferPreferredPaymentType = (
  normalizedQuestion: string,
): DraftPaymentType | null => {
  if (
    includesAny(normalizedQuestion, ["rimborso spese", "rimborso", "spes"])
  ) {
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

export const inferQuoteDraftPaymentType = (
  normalizedQuestion: string,
): DraftPaymentType => {
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

export const inferProjectDraftPaymentType = (
  normalizedQuestion: string,
): DraftPaymentType => {
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
