import type { UnifiedCrmAnswerPayload } from "./unifiedCrmAnswerTypes.ts";

export const requiredScope = "crm_read_snapshot";

export const italianMonthNumbers: Record<string, number> = {
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

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const getString = (value: unknown) =>
  typeof value === "string" ? value : null;
export const getNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const formatNumber = (value: number) =>
  value.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const includesAny = (value: string, patterns: string[]) =>
  patterns.some((pattern) => value.includes(pattern));

export const getRoutePrefix = (context: Record<string, unknown>) => {
  const meta = isObject(context.meta) ? context.meta : null;
  return getString(meta?.routePrefix) ?? "/#/";
};

export const getBusinessTimezone = (context: Record<string, unknown>) => {
  const meta = isObject(context.meta) ? context.meta : null;
  return getString(meta?.businessTimezone) ?? "Europe/Rome";
};

export const getDefaultKmRate = (context: Record<string, unknown>) => {
  const registries = isObject(context.registries) ? context.registries : null;
  const semantic = isObject(registries?.semantic) ? registries.semantic : null;
  const rules = isObject(semantic?.rules) ? semantic.rules : null;
  const travelReimbursement = isObject(rules?.travelReimbursement)
    ? rules.travelReimbursement
    : null;
  return getNumber(travelReimbursement?.defaultKmRate);
};

export { formatDateInTimezone } from "./dateTimezone.ts";

export const getObjectArray = (
  value: unknown,
): Array<Record<string, unknown>> =>
  Array.isArray(value) ? value.filter(isObject) : [];

export const buildListHref = (routePrefix: string, resource: string) =>
  `${routePrefix}${resource}`;

export const buildCreateHref = (
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

export const buildShowHref = (
  routePrefix: string,
  resource: string,
  recordId: string | null,
) => (recordId ? `${routePrefix}${resource}/${recordId}/show` : null);

export const buildShowHrefWithSearch = (
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

export const normalizeConversationHistory = (
  value: unknown,
): UnifiedCrmAnswerPayload["conversationHistory"] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const maxAnswerLength = 3000;

  return value
    .filter(isObject)
    .map((item) => ({
      question: getString(item.question)?.trim().slice(0, 1200) ?? "",
      answerMarkdown:
        getString(item.answerMarkdown)?.trim().slice(0, maxAnswerLength) ?? "",
      generatedAt: getString(item.generatedAt)?.trim() ?? "",
      model: getString(item.model)?.trim() ?? "",
    }))
    .filter(
      (item) =>
        item.question && item.answerMarkdown && item.generatedAt && item.model,
    )
    .slice(-6);
};

export const formatIsoDateForHumans = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

export const quoteStatusesEligibleForPaymentCreation = new Set([
  "accettato",
  "acconto_ricevuto",
  "in_lavorazione",
  "completato",
]);

export const canCreatePaymentFromQuoteStatus = (status: string | null) =>
  Boolean(status && quoteStatusesEligibleForPaymentCreation.has(status));

export type DraftPaymentType =
  | "acconto"
  | "saldo"
  | "parziale"
  | "rimborso_spese"
  | "rimborso";

export const projectNameStopwords = new Set([
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

export const tokenizeProjectName = (value: string) =>
  normalizeText(value)
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 3 && !projectNameStopwords.has(token));

export const tokenizeClientName = tokenizeProjectName;
