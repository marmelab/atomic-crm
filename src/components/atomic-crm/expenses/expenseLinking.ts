import type { Identifier } from "ra-core";

import type { Expense } from "../types";

type ExpenseCreateDefaults = Partial<
  Pick<
    Expense,
    | "project_id"
    | "client_id"
    | "supplier_id"
    | "expense_type"
    | "expense_date"
    | "km_distance"
    | "km_rate"
    | "description"
    | "invoice_ref"
    | "amount"
    | "markup_percent"
  >
>;

type UnifiedAiExpenseHandoffAction =
  | "expense_create"
  | "expense_create_km"
  | "follow_unified_crm_handoff";

type UnifiedAiExpenseHandoffSource = "unified_ai_launcher";

export type UnifiedAiExpenseHandoffContext = {
  source: UnifiedAiExpenseHandoffSource;
  action: UnifiedAiExpenseHandoffAction | null;
};

const toOptionalIdentifier = (value?: string | null) =>
  value == null || value === "" ? null : value;

const getOptionalNumber = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : null;
};

const expenseTypes = new Set<Expense["expense_type"]>([
  "spostamento_km",
  "pedaggio_autostradale",
  "vitto_alloggio",
  "acquisto_materiale",
  "abbonamento_software",
  "noleggio",
  "credito_ricevuto",
  "altro",
]);

const getOptionalExpenseType = (value?: string | null) =>
  value && expenseTypes.has(value as Expense["expense_type"])
    ? (value as Expense["expense_type"])
    : null;

const unifiedAiExpenseHandoffActions = new Set<UnifiedAiExpenseHandoffAction>([
  "expense_create",
  "expense_create_km",
  "follow_unified_crm_handoff",
]);

export const getExpenseCreateDefaultsFromSearch = (
  search: string,
): ExpenseCreateDefaults => {
  const searchParams = new URLSearchParams(search);
  const defaults: ExpenseCreateDefaults = {};

  const clientId = toOptionalIdentifier(searchParams.get("client_id"));
  if (clientId) {
    defaults.client_id = clientId;
  }

  const projectId = toOptionalIdentifier(searchParams.get("project_id"));
  if (projectId) {
    defaults.project_id = projectId;
  }

  const supplierId = toOptionalIdentifier(searchParams.get("supplier_id"));
  if (supplierId) {
    defaults.supplier_id = supplierId;
  }

  const expenseType = getOptionalExpenseType(searchParams.get("expense_type"));
  if (expenseType) {
    defaults.expense_type = expenseType;
  }

  const expenseDate = searchParams.get("expense_date");
  if (expenseDate) {
    defaults.expense_date = expenseDate;
  }

  const kmDistance = getOptionalNumber(searchParams.get("km_distance"));
  if (kmDistance != null) {
    defaults.km_distance = kmDistance;
  }

  const kmRate = getOptionalNumber(searchParams.get("km_rate"));
  if (kmRate != null) {
    defaults.km_rate = kmRate;
  }

  const description = searchParams.get("description");
  if (description) {
    defaults.description = description;
  }

  const invoiceRef = searchParams.get("invoice_ref");
  if (invoiceRef) {
    defaults.invoice_ref = invoiceRef;
  }

  const amount = getOptionalNumber(searchParams.get("amount"));
  if (amount != null) {
    defaults.amount = amount;
  }

  const markupPercent = getOptionalNumber(searchParams.get("markup_percent"));
  if (markupPercent != null) {
    defaults.markup_percent = markupPercent;
  }

  return defaults;
};

export const getUnifiedAiExpenseHandoffContextFromSearch = (
  search: string,
): UnifiedAiExpenseHandoffContext | null => {
  const searchParams = new URLSearchParams(search);
  const source = searchParams.get("launcher_source");

  if (source !== "unified_ai_launcher") {
    return null;
  }

  const action = searchParams.get("launcher_action");

  return {
    source,
    action:
      action &&
      unifiedAiExpenseHandoffActions.has(
        action as UnifiedAiExpenseHandoffAction,
      )
        ? (action as UnifiedAiExpenseHandoffAction)
        : null,
  };
};

export const getUnifiedAiExpenseBannerCopy = (search: string) => {
  const handoff = getUnifiedAiExpenseHandoffContextFromSearch(search);

  if (!handoff) {
    return null;
  }

  if (handoff.action === "expense_create_km") {
    return "Aperto dalla chat AI unificata con una trasferta km gia calcolata. Controlla data, chilometri, tariffa e collegamenti prima di salvare; se il punto reale di partenza o arrivo era diverso, correggi qui i km.";
  }

  if (handoff.action === "expense_create") {
    return "Aperto dalla chat AI unificata con una spesa gia collegata a cliente o progetto. Controlla tipo, importo, data e collegamenti prima di salvare.";
  }

  return "Aperto dalla chat AI unificata: il form e' stato indirizzato qui come superficie spese gia approvata. Verifica i dati prima di salvare.";
};

export const buildExpenseCreatePathFromTravel = ({
  client_id,
  project_id,
  expense_date,
  km_distance,
  km_rate,
  description,
}: {
  client_id?: Identifier | null;
  project_id?: Identifier | null;
  expense_date?: string | null;
  km_distance: number;
  km_rate?: number | null;
  description?: string | null;
}) => {
  const searchParams = new URLSearchParams();

  searchParams.set("expense_type", "spostamento_km");
  searchParams.set("km_distance", String(km_distance));
  searchParams.set("launcher_source", "unified_ai_launcher");
  searchParams.set("launcher_action", "expense_create_km");

  if (client_id != null && client_id !== "") {
    searchParams.set("client_id", String(client_id));
  }

  if (project_id != null && project_id !== "") {
    searchParams.set("project_id", String(project_id));
  }

  if (expense_date) {
    searchParams.set("expense_date", expense_date);
  }

  if (km_rate != null && Number.isFinite(km_rate)) {
    searchParams.set("km_rate", String(km_rate));
  }

  if (description) {
    searchParams.set("description", description);
  }

  return `/expenses/create?${searchParams.toString()}`;
};
