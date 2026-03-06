import type { Identifier } from "ra-core";

import type {
  Client,
  Contact,
  Expense,
  Payment,
  Project,
  Service,
} from "@/components/atomic-crm/types";
import { getContactDisplayName } from "@/components/atomic-crm/contacts/contactRecord";

export type InvoiceImportWorkspaceClient = Pick<
  Client,
  | "id"
  | "name"
  | "email"
  | "billing_name"
  | "vat_number"
  | "fiscal_code"
  | "billing_city"
>;

export type InvoiceImportWorkspaceContact = Pick<
  Contact,
  "id" | "client_id" | "first_name" | "last_name"
>;

export type InvoiceImportFileHandle = {
  path: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
};

export type InvoiceImportWorkspace = {
  clients: InvoiceImportWorkspaceClient[];
  contacts: InvoiceImportWorkspaceContact[];
  projects: Array<Pick<Project, "id" | "name" | "client_id">>;
};

export type InvoiceImportBillingProfileDraft = {
  billingName?: string | null;
  vatNumber?: string | null;
  fiscalCode?: string | null;
  billingAddressStreet?: string | null;
  billingAddressNumber?: string | null;
  billingPostalCode?: string | null;
  billingCity?: string | null;
  billingProvince?: string | null;
  billingCountry?: string | null;
  billingSdiCode?: string | null;
  billingPec?: string | null;
};

export type InvoiceImportRecordDraft = {
  id: string;
  sourceFileNames: string[];
  resource: "payments" | "expenses" | "services";
  confidence: "high" | "medium" | "low";
  documentType: "customer_invoice" | "supplier_invoice" | "receipt" | "unknown";
  rationale?: string | null;
  counterpartyName?: string | null;
  invoiceRef?: string | null;
  amount: number | null;
  currency?: string | null;
  documentDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  clientId?: Identifier | null;
  projectId?: Identifier | null;
  paymentType?: Payment["payment_type"] | null;
  paymentMethod?: Payment["method"] | null;
  paymentStatus?: Payment["status"] | null;
  expenseType?: Expense["expense_type"] | null;
  description?: string | null;
  serviceType?: Service["service_type"] | null;
  isTaxable?: boolean | null;
  feeShooting?: number | null;
  feeEditing?: number | null;
  feeOther?: number | null;
  serviceEnd?: string | null;
  allDay?: boolean | null;
  discount?: number | null;
  kmDistance?: number | null;
  kmRate?: number | null;
  location?: string | null;
} & InvoiceImportBillingProfileDraft;

export type InvoiceImportDraft = {
  model: string;
  generatedAt: string;
  summary: string;
  warnings: string[];
  records: InvoiceImportRecordDraft[];
};

export type GenerateInvoiceImportDraftRequest = {
  files: InvoiceImportFileHandle[];
  model: string;
  userInstructions?: string | null;
};

export type InvoiceImportConfirmation = {
  created: Array<{
    resource: "payments" | "expenses" | "services";
    id: Identifier;
    invoiceRef?: string | null;
    amount?: number | null;
  }>;
  skipped?: Array<{
    resource: "payments" | "expenses" | "services";
    reason: string;
    description?: string | null;
    amount?: number | null;
  }>;
};

const normalizeNameComparable = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\s+/g, " ").toLocaleLowerCase("it-IT") : null;
};

const normalizeIdentifierComparable = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() : null;
};

const normalizeVatComparable = (value?: string | null) => {
  const compact = normalizeIdentifierComparable(value);

  if (!compact) {
    return null;
  }

  return compact.startsWith("IT") && /^\d{11}$/.test(compact.slice(2))
    ? compact.slice(2)
    : compact;
};

const defaultPaymentDraft: Pick<
  InvoiceImportRecordDraft,
  "paymentType" | "paymentMethod" | "paymentStatus"
> = {
  paymentType: "saldo",
  paymentMethod: "bonifico",
  paymentStatus: "in_attesa",
};

const defaultExpenseDraft: Pick<InvoiceImportRecordDraft, "expenseType"> = {
  expenseType: "acquisto_materiale",
};

const defaultServiceDraft: Pick<
  InvoiceImportRecordDraft,
  | "serviceType"
  | "isTaxable"
  | "feeShooting"
  | "feeEditing"
  | "feeOther"
  | "allDay"
  | "discount"
  | "kmDistance"
  | "kmRate"
> = {
  serviceType: "altro",
  isTaxable: true,
  feeShooting: 0,
  feeEditing: 0,
  feeOther: 0,
  allDay: true,
  discount: 0,
  kmDistance: 0,
  kmRate: 0,
};

export const normalizeInvoiceImportRecord = (
  record: InvoiceImportRecordDraft,
): InvoiceImportRecordDraft => {
  const normalizedAmount =
    record.amount == null || Number.isNaN(Number(record.amount))
      ? null
      : Number(record.amount);
  const normalizeOptionalString = (value?: string | null) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };

  return {
    ...defaultPaymentDraft,
    ...defaultExpenseDraft,
    ...defaultServiceDraft,
    ...record,
    sourceFileNames: record.sourceFileNames ?? [],
    confidence: record.confidence ?? "medium",
    documentType: record.documentType ?? "unknown",
    amount: normalizedAmount,
    billingName: normalizeOptionalString(record.billingName),
    vatNumber: normalizeOptionalString(record.vatNumber),
    fiscalCode: normalizeOptionalString(record.fiscalCode),
    billingAddressStreet: normalizeOptionalString(record.billingAddressStreet),
    billingAddressNumber: normalizeOptionalString(record.billingAddressNumber),
    billingPostalCode: normalizeOptionalString(record.billingPostalCode),
    billingCity: normalizeOptionalString(record.billingCity),
    billingProvince: normalizeOptionalString(record.billingProvince),
    billingCountry: normalizeOptionalString(record.billingCountry),
    billingSdiCode: normalizeOptionalString(record.billingSdiCode),
    billingPec: normalizeOptionalString(record.billingPec),
  };
};

export const normalizeInvoiceImportDraft = (
  draft: InvoiceImportDraft,
): InvoiceImportDraft => ({
  ...draft,
  warnings: draft.warnings ?? [],
  records: (draft.records ?? []).map(normalizeInvoiceImportRecord),
});

export const getInvoiceImportRecordValidationErrors = (
  record: InvoiceImportRecordDraft,
  workspace?: InvoiceImportWorkspace,
) => {
  const normalized = normalizeInvoiceImportRecord(record);
  const errors: string[] = [];

  if (normalized.amount == null || normalized.amount <= 0) {
    errors.push("importo valido");
  }

  if (!normalized.documentDate) {
    errors.push("data documento");
  }

  if (normalized.resource === "payments") {
    if (!normalized.clientId) {
      errors.push("cliente");
    }
    if (!normalized.paymentType) {
      errors.push("tipo pagamento");
    }
    if (!normalized.paymentStatus) {
      errors.push("stato pagamento");
    }
  }

  if (normalized.resource === "expenses" && !normalized.expenseType) {
    errors.push("tipo spesa");
  }

  if (normalized.resource === "services") {
    if (!normalized.serviceType) {
      errors.push("tipo servizio");
    }
    const totalFee =
      (normalized.feeShooting ?? 0) +
      (normalized.feeEditing ?? 0) +
      (normalized.feeOther ?? 0);
    if (totalFee <= 0 && (normalized.amount == null || normalized.amount <= 0)) {
      errors.push("almeno un compenso");
    }
  }

  if (workspace) {
    const matchedClient = normalized.clientId
      ? workspace.clients.find((client) => client.id === normalized.clientId)
      : null;

    if (normalized.clientId && !matchedClient) {
      errors.push("cliente valido");
    }
  }

  if (workspace && normalized.projectId) {
    const matchedClient = normalized.clientId
      ? workspace.clients.find((client) => client.id === normalized.clientId)
      : null;
    const matchedProject = workspace.projects.find(
      (project) => project.id === normalized.projectId,
    );

    if (!matchedProject) {
      errors.push("progetto valido");
    } else if (
      matchedClient &&
      matchedProject.client_id !== normalized.clientId
    ) {
      errors.push("cliente/progetto coerenti");
    }
  }

  return errors;
};

export const buildInvoiceImportRecordNotes = (
  record: InvoiceImportRecordDraft,
) => {
  const billingAddress = [
    record.billingAddressStreet?.trim(),
    record.billingAddressNumber?.trim(),
    record.billingPostalCode?.trim(),
    record.billingCity?.trim(),
    record.billingProvince?.trim(),
    record.billingCountry?.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  return [
    record.notes?.trim(),
    record.dueDate ? `Scadenza documento: ${record.dueDate}` : null,
    record.billingName
      ? `Denominazione fiscale: ${record.billingName}`
      : null,
    record.vatNumber ? `P.IVA: ${record.vatNumber}` : null,
    record.fiscalCode ? `CF: ${record.fiscalCode}` : null,
    billingAddress ? `Indirizzo fatturazione: ${billingAddress}` : null,
    record.billingSdiCode
      ? `Codice destinatario: ${record.billingSdiCode}`
      : null,
    record.billingPec ? `PEC: ${record.billingPec}` : null,
    record.sourceFileNames.length > 0
      ? `File sorgente: ${record.sourceFileNames.join(", ")}`
      : null,
    `Tipo documento: ${record.documentType}`,
    `Confidenza AI: ${record.confidence}`,
    "Importato dalla chat AI fatture",
  ]
    .filter(Boolean)
    .join("\n");
};

export const getInvoiceImportPaymentDate = (
  record: Pick<
    InvoiceImportRecordDraft,
    "documentDate" | "dueDate" | "paymentStatus"
  >,
) => {
  const status = record.paymentStatus ?? "in_attesa";

  if (status === "ricevuto") {
    return record.documentDate ?? null;
  }

  return record.dueDate ?? record.documentDate ?? null;
};

const resolveClientIdFromIdentifiers = (
  record: InvoiceImportRecordDraft,
  workspace: InvoiceImportWorkspace,
) => {
  const comparableFiscalCode = normalizeIdentifierComparable(record.fiscalCode);
  if (comparableFiscalCode) {
    const matches = workspace.clients.filter(
      (client) =>
        normalizeIdentifierComparable(client.fiscal_code) ===
        comparableFiscalCode,
    );

    if (matches.length === 1) {
      return matches[0]?.id ?? null;
    }
  }

  const comparableVatNumber = normalizeVatComparable(record.vatNumber);
  if (comparableVatNumber) {
    const matches = workspace.clients.filter(
      (client) =>
        normalizeVatComparable(client.vat_number) === comparableVatNumber,
    );

    if (matches.length === 1) {
      return matches[0]?.id ?? null;
    }
  }

  return null;
};

const resolveClientIdFromBillingName = (
  record: InvoiceImportRecordDraft,
  workspace: InvoiceImportWorkspace,
) => {
  const comparableCandidate = normalizeNameComparable(record.billingName);
  if (!comparableCandidate) {
    return null;
  }

  const matches = workspace.clients.filter((client) => {
    const comparableName = normalizeNameComparable(client.name);
    const comparableBillingName = normalizeNameComparable(client.billing_name);

    return (
      comparableName === comparableCandidate ||
      comparableBillingName === comparableCandidate
    );
  });

  if (matches.length === 1) {
    return matches[0]?.id ?? null;
  }

  return null;
};

const resolveClientIdFromLinkedContact = (
  record: InvoiceImportRecordDraft,
  workspace: InvoiceImportWorkspace,
) => {
  const comparableCounterparty = normalizeNameComparable(record.counterpartyName);
  if (!comparableCounterparty) {
    return null;
  }

  const linkedClientIds = [
    ...new Map(
      workspace.contacts
        .filter((contact) => contact.client_id != null)
        .filter(
          (contact) =>
            normalizeNameComparable(getContactDisplayName(contact)) ===
            comparableCounterparty,
        )
        .map((contact) => [String(contact.client_id), contact.client_id]),
    ).values(),
  ].filter((clientId) =>
    workspace.clients.some((client) => String(client.id) === String(clientId)),
  );

  if (linkedClientIds.length === 1) {
    return linkedClientIds[0] ?? null;
  }

  return null;
};

const resolveClientIdFromCounterpartyName = (
  record: InvoiceImportRecordDraft,
  workspace: InvoiceImportWorkspace,
) => {
  const comparableCandidate = normalizeNameComparable(record.counterpartyName);
  if (!comparableCandidate) {
    return null;
  }

  const matches = workspace.clients.filter((client) => {
    const comparableName = normalizeNameComparable(client.name);
    const comparableBillingName = normalizeNameComparable(client.billing_name);

    return (
      comparableName === comparableCandidate ||
      comparableBillingName === comparableCandidate
    );
  });

  if (matches.length === 1) {
    return matches[0]?.id ?? null;
  }

  return null;
};

export const applyInvoiceImportWorkspaceHints = (
  draft: InvoiceImportDraft,
  workspace?: InvoiceImportWorkspace,
) => {
  if (!workspace) {
    return draft;
  }

  let hasChanges = false;
  const nextRecords = draft.records.map((record) => {
    const hasValidClient =
      record.clientId != null &&
      workspace.clients.some((client) => String(client.id) === String(record.clientId));
    const matchedProject =
      record.projectId != null
        ? workspace.projects.find(
            (project) => String(project.id) === String(record.projectId),
          ) ?? null
        : null;

    const nextClientId =
      (hasValidClient ? record.clientId : null) ??
      (matchedProject && !hasValidClient ? matchedProject.client_id : null) ??
      resolveClientIdFromIdentifiers(record, workspace) ??
      resolveClientIdFromBillingName(record, workspace) ??
      resolveClientIdFromLinkedContact(record, workspace) ??
      resolveClientIdFromCounterpartyName(record, workspace) ??
      (hasValidClient ? record.clientId : null);

    if (String(nextClientId ?? "") === String(record.clientId ?? "")) {
      return record;
    }

    hasChanges = true;

    return {
      ...record,
      clientId: nextClientId,
    };
  });

  if (!hasChanges) {
    return draft;
  }

  return {
    ...draft,
    records: nextRecords,
  };
};

export const getClientLabel = (
  workspace: InvoiceImportWorkspace,
  clientId?: Identifier | null,
) =>
  workspace.clients.find((client) => client.id === clientId)?.name ??
  "Cliente non selezionato";

export const getProjectLabel = (
  workspace: InvoiceImportWorkspace,
  projectId?: Identifier | null,
) =>
  workspace.projects.find((project) => project.id === projectId)?.name ??
  "Nessun progetto";
