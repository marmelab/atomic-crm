const paymentTypes = new Set([
  "acconto",
  "saldo",
  "parziale",
  "rimborso_spese",
  "rimborso",
]);
const paymentMethods = new Set(["bonifico", "contanti", "paypal", "altro"]);
const paymentStatuses = new Set(["ricevuto", "in_attesa", "scaduto"]);
const expenseTypes = new Set([
  "spostamento_km",
  "pedaggio_autostradale",
  "vitto_alloggio",
  "acquisto_materiale",
  "abbonamento_software",
  "noleggio",
  "credito_ricevuto",
  "altro",
]);
const serviceTypes = new Set([
  "riprese",
  "montaggio",
  "riprese_montaggio",
  "fotografia",
  "sviluppo_web",
  "altro",
]);
const resources = new Set(["payments", "expenses", "services"]);
const confidences = new Set(["high", "medium", "low"]);
const documentTypes = new Set([
  "customer_invoice",
  "supplier_invoice",
  "receipt",
  "unknown",
]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeOptionalString = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeOptionalEnum = (
  value: unknown,
  options: Set<string>,
): string | null => {
  if (value == null || value === "") {
    return null;
  }

  return typeof value === "string" && options.has(value) ? value : null;
};

const normalizeOptionalNumber = (value: unknown) => {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
};

export type InvoiceImportConfirmRecord = {
  id: string;
  sourceFileNames: string[];
  resource: "payments" | "expenses" | "services";
  confidence: "high" | "medium" | "low";
  documentType: "customer_invoice" | "supplier_invoice" | "receipt" | "unknown";
  rationale?: string | null;
  counterpartyName?: string | null;
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
  invoiceRef?: string | null;
  amount: number | null;
  currency?: string | null;
  documentDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  paymentType?:
    | "acconto"
    | "saldo"
    | "parziale"
    | "rimborso_spese"
    | "rimborso"
    | null;
  paymentMethod?: "bonifico" | "contanti" | "paypal" | "altro" | null;
  paymentStatus?: "ricevuto" | "in_attesa" | "scaduto" | null;
  expenseType?:
    | "spostamento_km"
    | "pedaggio_autostradale"
    | "vitto_alloggio"
    | "acquisto_materiale"
    | "abbonamento_software"
    | "noleggio"
    | "credito_ricevuto"
    | "altro"
    | null;
  description?: string | null;
  serviceType?:
    | "riprese"
    | "montaggio"
    | "riprese_montaggio"
    | "fotografia"
    | "sviluppo_web"
    | "altro"
    | null;
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
};

export type InvoiceImportConfirmDraft = {
  model: string;
  generatedAt: string;
  summary: string;
  warnings: string[];
  records: InvoiceImportConfirmRecord[];
};

export type InvoiceImportConfirmPayload = {
  draft: InvoiceImportConfirmDraft;
};

export type InvoiceImportConfirmWorkspace = {
  clients: Array<{ id: string }>;
  projects: Array<{ id: string; client_id: string | null }>;
};

export const normalizeInvoiceImportConfirmRecord = (
  record: unknown,
  index: number,
): InvoiceImportConfirmRecord => {
  const normalizedRecord = isObject(record) ? record : {};

  return {
    id:
      normalizeOptionalString(normalizedRecord.id) ??
      `invoice-draft-${index + 1}`,
    sourceFileNames: Array.isArray(normalizedRecord.sourceFileNames)
      ? normalizedRecord.sourceFileNames.filter(
          (fileName): fileName is string => typeof fileName === "string",
        )
      : [],
    resource:
      (normalizeOptionalEnum(normalizedRecord.resource, resources) as
        | "payments"
        | "expenses"
        | "services"
        | null) ?? "expenses",
    confidence:
      (normalizeOptionalEnum(normalizedRecord.confidence, confidences) as
        | "high"
        | "medium"
        | "low"
        | null) ?? "medium",
    documentType:
      (normalizeOptionalEnum(normalizedRecord.documentType, documentTypes) as
        | "customer_invoice"
        | "supplier_invoice"
        | "receipt"
        | "unknown"
        | null) ?? "unknown",
    rationale: normalizeOptionalString(normalizedRecord.rationale),
    counterpartyName: normalizeOptionalString(
      normalizedRecord.counterpartyName,
    ),
    billingName: normalizeOptionalString(normalizedRecord.billingName),
    vatNumber: normalizeOptionalString(normalizedRecord.vatNumber),
    fiscalCode: normalizeOptionalString(normalizedRecord.fiscalCode),
    billingAddressStreet: normalizeOptionalString(
      normalizedRecord.billingAddressStreet,
    ),
    billingAddressNumber: normalizeOptionalString(
      normalizedRecord.billingAddressNumber,
    ),
    billingPostalCode: normalizeOptionalString(
      normalizedRecord.billingPostalCode,
    ),
    billingCity: normalizeOptionalString(normalizedRecord.billingCity),
    billingProvince: normalizeOptionalString(normalizedRecord.billingProvince),
    billingCountry: normalizeOptionalString(normalizedRecord.billingCountry),
    billingSdiCode: normalizeOptionalString(normalizedRecord.billingSdiCode),
    billingPec: normalizeOptionalString(normalizedRecord.billingPec),
    invoiceRef: normalizeOptionalString(normalizedRecord.invoiceRef),
    amount: normalizeOptionalNumber(normalizedRecord.amount),
    currency: normalizeOptionalString(normalizedRecord.currency),
    documentDate: normalizeOptionalString(normalizedRecord.documentDate),
    dueDate: normalizeOptionalString(normalizedRecord.dueDate),
    notes: normalizeOptionalString(normalizedRecord.notes),
    clientId: normalizeOptionalString(normalizedRecord.clientId),
    projectId: normalizeOptionalString(normalizedRecord.projectId),
    paymentType:
      (normalizeOptionalEnum(normalizedRecord.paymentType, paymentTypes) as
        | "acconto"
        | "saldo"
        | "parziale"
        | "rimborso_spese"
        | "rimborso"
        | null) ?? "saldo",
    paymentMethod:
      (normalizeOptionalEnum(normalizedRecord.paymentMethod, paymentMethods) as
        | "bonifico"
        | "contanti"
        | "paypal"
        | "altro"
        | null) ?? "bonifico",
    paymentStatus:
      (normalizeOptionalEnum(
        normalizedRecord.paymentStatus,
        paymentStatuses,
      ) as "ricevuto" | "in_attesa" | "scaduto" | null) ?? "in_attesa",
    expenseType:
      (normalizeOptionalEnum(normalizedRecord.expenseType, expenseTypes) as
        | "spostamento_km"
        | "pedaggio_autostradale"
        | "vitto_alloggio"
        | "acquisto_materiale"
        | "abbonamento_software"
        | "noleggio"
        | "credito_ricevuto"
        | "altro"
        | null) ?? "acquisto_materiale",
    description: normalizeOptionalString(normalizedRecord.description),
    serviceType:
      (normalizeOptionalEnum(normalizedRecord.serviceType, serviceTypes) as
        | "riprese"
        | "montaggio"
        | "riprese_montaggio"
        | "fotografia"
        | "sviluppo_web"
        | "altro"
        | null) ?? "altro",
    isTaxable:
      typeof normalizedRecord.isTaxable === "boolean"
        ? normalizedRecord.isTaxable
        : true,
    feeShooting: normalizeOptionalNumber(normalizedRecord.feeShooting) ?? 0,
    feeEditing: normalizeOptionalNumber(normalizedRecord.feeEditing) ?? 0,
    feeOther: normalizeOptionalNumber(normalizedRecord.feeOther) ?? 0,
    serviceEnd: normalizeOptionalString(normalizedRecord.serviceEnd),
    allDay:
      typeof normalizedRecord.allDay === "boolean"
        ? normalizedRecord.allDay
        : true,
    discount: normalizeOptionalNumber(normalizedRecord.discount) ?? 0,
    kmDistance: normalizeOptionalNumber(normalizedRecord.kmDistance) ?? 0,
    kmRate: normalizeOptionalNumber(normalizedRecord.kmRate) ?? 0,
    location: normalizeOptionalString(normalizedRecord.location),
  };
};

export const validateInvoiceImportConfirmPayload = (payload: unknown) => {
  if (!isObject(payload) || !isObject(payload.draft)) {
    return { error: "Payload non valido", data: null };
  }

  const rawDraft = payload.draft;
  const records = Array.isArray(rawDraft.records) ? rawDraft.records : [];

  if (records.length === 0) {
    return {
      error: "Non c'e' nessun record da confermare.",
      data: null,
    };
  }

  return {
    error: null,
    data: {
      draft: {
        model: normalizeOptionalString(rawDraft.model) ?? "unknown",
        generatedAt: normalizeOptionalString(rawDraft.generatedAt) ?? "",
        summary:
          normalizeOptionalString(rawDraft.summary) ??
          "Bozza fatture generata.",
        warnings: Array.isArray(rawDraft.warnings)
          ? rawDraft.warnings.filter(
              (warning): warning is string => typeof warning === "string",
            )
          : [],
        records: records.map((record, index) =>
          normalizeInvoiceImportConfirmRecord(record, index),
        ),
      },
    } satisfies InvoiceImportConfirmPayload,
  };
};

export const getInvoiceImportConfirmValidationErrors = (
  record: InvoiceImportConfirmRecord,
  workspace?: InvoiceImportConfirmWorkspace,
) => {
  const errors: string[] = [];

  if (record.amount == null || record.amount <= 0) {
    errors.push("importo valido");
  }

  if (!record.documentDate) {
    errors.push("data documento");
  }

  if (record.resource === "payments" && !record.clientId) {
    errors.push("cliente");
  }

  if (record.resource === "payments" && !record.paymentType) {
    errors.push("tipo pagamento");
  }

  if (record.resource === "payments" && !record.paymentStatus) {
    errors.push("stato pagamento");
  }

  if (record.resource === "expenses" && !record.expenseType) {
    errors.push("tipo spesa");
  }

  if (record.resource === "services") {
    if (!record.serviceType) {
      errors.push("tipo servizio");
    }
    const totalFee =
      (record.feeShooting ?? 0) +
      (record.feeEditing ?? 0) +
      (record.feeOther ?? 0);
    if (totalFee <= 0 && (record.amount == null || record.amount <= 0)) {
      errors.push("almeno un compenso");
    }
  }

  if (workspace && record.clientId) {
    const matchedClient = workspace.clients.find(
      (client) => client.id === record.clientId,
    );

    if (!matchedClient) {
      errors.push("cliente valido");
    }
  }

  if (workspace && record.projectId) {
    const matchedProject = workspace.projects.find(
      (project) => project.id === record.projectId,
    );

    if (!matchedProject) {
      errors.push("progetto valido");
    } else if (
      record.clientId &&
      matchedProject.client_id !== record.clientId
    ) {
      errors.push("cliente/progetto coerenti");
    }
  }

  return errors;
};

export const getInvoiceImportConfirmPaymentDate = (
  record: Pick<
    InvoiceImportConfirmRecord,
    "documentDate" | "dueDate" | "paymentStatus"
  >,
) => {
  const status = record.paymentStatus ?? "in_attesa";

  if (status === "ricevuto") {
    return record.documentDate ?? null;
  }

  return record.dueDate ?? record.documentDate ?? null;
};

export const buildInvoiceImportConfirmNotes = ({
  record,
  model,
}: {
  record: InvoiceImportConfirmRecord;
  model: string;
}) => {
  const billingAddress = [
    record.billingAddressStreet,
    record.billingAddressNumber,
    record.billingPostalCode,
    record.billingCity,
    record.billingProvince,
    record.billingCountry,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    record.notes,
    record.dueDate ? `Scadenza documento: ${record.dueDate}` : null,
    record.billingName ? `Denominazione fiscale: ${record.billingName}` : null,
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
    `Modello estrazione: ${model}`,
    "Importato dalla chat AI fatture",
  ]
    .filter(Boolean)
    .join("\n");
};
