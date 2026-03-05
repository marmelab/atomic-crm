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
  "acquisto_materiale",
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

export type InvoiceImportExtractPayload = {
  files: Array<{
    path: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
  }>;
  model: string;
  userInstructions?: string | null;
};

export const invoiceImportResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
    records: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          sourceFileNames: {
            type: "array",
            items: { type: "string" },
          },
          resource: {
            type: "string",
            enum: ["payments", "expenses", "services"],
          },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"],
          },
          documentType: {
            type: "string",
            enum: [
              "customer_invoice",
              "supplier_invoice",
              "receipt",
              "unknown",
            ],
          },
          rationale: { type: ["string", "null"] },
          counterpartyName: { type: ["string", "null"] },
          billingName: { type: ["string", "null"] },
          vatNumber: { type: ["string", "null"] },
          fiscalCode: { type: ["string", "null"] },
          billingAddressStreet: { type: ["string", "null"] },
          billingAddressNumber: { type: ["string", "null"] },
          billingPostalCode: { type: ["string", "null"] },
          billingCity: { type: ["string", "null"] },
          billingProvince: { type: ["string", "null"] },
          billingCountry: { type: ["string", "null"] },
          billingSdiCode: { type: ["string", "null"] },
          billingPec: { type: ["string", "null"] },
          invoiceRef: { type: ["string", "null"] },
          amount: { type: ["number", "null"] },
          currency: { type: ["string", "null"] },
          documentDate: { type: ["string", "null"] },
          dueDate: { type: ["string", "null"] },
          notes: { type: ["string", "null"] },
          clientId: { type: ["string", "null"] },
          projectId: { type: ["string", "null"] },
          paymentType: {
            type: ["string", "null"],
            enum: [
              "acconto",
              "saldo",
              "parziale",
              "rimborso_spese",
              "rimborso",
              null,
            ],
          },
          paymentMethod: {
            type: ["string", "null"],
            enum: ["bonifico", "contanti", "paypal", "altro", null],
          },
          paymentStatus: {
            type: ["string", "null"],
            enum: ["ricevuto", "in_attesa", "scaduto", null],
          },
          expenseType: {
            type: ["string", "null"],
            enum: [
              "spostamento_km",
              "acquisto_materiale",
              "noleggio",
              "credito_ricevuto",
              "altro",
              null,
            ],
          },
          description: { type: ["string", "null"] },
          serviceType: {
            type: ["string", "null"],
            enum: [
              "riprese",
              "montaggio",
              "riprese_montaggio",
              "fotografia",
              "sviluppo_web",
              "altro",
              null,
            ],
          },
          isTaxable: { type: ["boolean", "null"] },
          feeShooting: { type: ["number", "null"] },
          feeEditing: { type: ["number", "null"] },
          feeOther: { type: ["number", "null"] },
          serviceEnd: { type: ["string", "null"] },
          allDay: { type: ["boolean", "null"] },
          discount: { type: ["number", "null"] },
          kmDistance: { type: ["number", "null"] },
          kmRate: { type: ["number", "null"] },
          location: { type: ["string", "null"] },
        },
        required: ["sourceFileNames", "resource", "confidence", "documentType"],
      },
    },
  },
  required: ["summary", "warnings", "records"],
} as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const validateInvoiceImportExtractPayload = (payload: unknown) => {
  if (!isObject(payload)) {
    return { error: "Payload non valido", data: null };
  }

  if (typeof payload.model !== "string" || !payload.model.trim()) {
    return { error: "Il modello e' obbligatorio", data: null };
  }

  if (
    payload.userInstructions != null &&
    (typeof payload.userInstructions !== "string" ||
      payload.userInstructions.length > 1000)
  ) {
    return { error: "Le istruzioni utente non sono valide", data: null };
  }

  if (!Array.isArray(payload.files) || payload.files.length === 0) {
    return { error: "Carica almeno un file", data: null };
  }

  if (payload.files.length > 6) {
    return {
      error: "Puoi analizzare al massimo 6 file alla volta",
      data: null,
    };
  }

  for (const file of payload.files) {
    if (
      !isObject(file) ||
      typeof file.path !== "string" ||
      typeof file.name !== "string" ||
      typeof file.mimeType !== "string" ||
      typeof file.sizeBytes !== "number" ||
      !file.path ||
      !file.name ||
      !file.mimeType ||
      !Number.isFinite(file.sizeBytes) ||
      file.sizeBytes <= 0 ||
      file.sizeBytes > 20_000_000
    ) {
      return { error: "Uno dei file allegati non e' valido", data: null };
    }
  }

  return {
    error: null,
    data: payload as InvoiceImportExtractPayload,
  };
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

export const parseInvoiceImportModelResponse = ({
  responseText,
  model,
}: {
  responseText: string;
  model: string;
}) => {
  const parsed = JSON.parse(responseText);

  if (!isObject(parsed)) {
    throw new Error("Risposta Gemini non valida");
  }

  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.filter(
        (warning): warning is string => typeof warning === "string",
      )
    : [];
  const records = Array.isArray(parsed.records) ? parsed.records : [];

  return {
    model,
    generatedAt: new Date().toISOString(),
    summary:
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary
        : "Bozza fatture generata.",
    warnings,
    records: records.filter(isObject).map((record, index) => ({
      id:
        typeof record.id === "string" && record.id.trim()
          ? record.id
          : `invoice-draft-${index + 1}`,
      sourceFileNames: Array.isArray(record.sourceFileNames)
        ? record.sourceFileNames.filter(
            (fileName): fileName is string => typeof fileName === "string",
          )
        : [],
      resource: normalizeOptionalEnum(record.resource, resources) ?? "expenses",
      confidence:
        normalizeOptionalEnum(record.confidence, confidences) ?? "medium",
      documentType:
        normalizeOptionalEnum(record.documentType, documentTypes) ?? "unknown",
      rationale: typeof record.rationale === "string" ? record.rationale : null,
      counterpartyName:
        typeof record.counterpartyName === "string"
          ? record.counterpartyName
          : null,
      billingName:
        typeof record.billingName === "string" ? record.billingName : null,
      vatNumber: typeof record.vatNumber === "string" ? record.vatNumber : null,
      fiscalCode:
        typeof record.fiscalCode === "string" ? record.fiscalCode : null,
      billingAddressStreet:
        typeof record.billingAddressStreet === "string"
          ? record.billingAddressStreet
          : null,
      billingAddressNumber:
        typeof record.billingAddressNumber === "string"
          ? record.billingAddressNumber
          : null,
      billingPostalCode:
        typeof record.billingPostalCode === "string"
          ? record.billingPostalCode
          : null,
      billingCity:
        typeof record.billingCity === "string" ? record.billingCity : null,
      billingProvince:
        typeof record.billingProvince === "string"
          ? record.billingProvince
          : null,
      billingCountry:
        typeof record.billingCountry === "string"
          ? record.billingCountry
          : null,
      billingSdiCode:
        typeof record.billingSdiCode === "string"
          ? record.billingSdiCode
          : null,
      billingPec:
        typeof record.billingPec === "string" ? record.billingPec : null,
      invoiceRef:
        typeof record.invoiceRef === "string" ? record.invoiceRef : null,
      amount:
        typeof record.amount === "number" && Number.isFinite(record.amount)
          ? record.amount
          : null,
      currency: typeof record.currency === "string" ? record.currency : "EUR",
      documentDate:
        typeof record.documentDate === "string" ? record.documentDate : null,
      dueDate: typeof record.dueDate === "string" ? record.dueDate : null,
      notes: typeof record.notes === "string" ? record.notes : null,
      clientId: typeof record.clientId === "string" ? record.clientId : null,
      projectId: typeof record.projectId === "string" ? record.projectId : null,
      paymentType: normalizeOptionalEnum(record.paymentType, paymentTypes),
      paymentMethod: normalizeOptionalEnum(
        record.paymentMethod,
        paymentMethods,
      ),
      paymentStatus: normalizeOptionalEnum(
        record.paymentStatus,
        paymentStatuses,
      ),
      expenseType: normalizeOptionalEnum(record.expenseType, expenseTypes),
      description:
        typeof record.description === "string" ? record.description : null,
      serviceType: normalizeOptionalEnum(record.serviceType, serviceTypes),
      isTaxable:
        typeof record.isTaxable === "boolean" ? record.isTaxable : null,
      feeShooting:
        typeof record.feeShooting === "number" &&
        Number.isFinite(record.feeShooting)
          ? record.feeShooting
          : null,
      feeEditing:
        typeof record.feeEditing === "number" &&
        Number.isFinite(record.feeEditing)
          ? record.feeEditing
          : null,
      feeOther:
        typeof record.feeOther === "number" && Number.isFinite(record.feeOther)
          ? record.feeOther
          : null,
      serviceEnd:
        typeof record.serviceEnd === "string" ? record.serviceEnd : null,
      allDay: typeof record.allDay === "boolean" ? record.allDay : null,
      discount:
        typeof record.discount === "number" && Number.isFinite(record.discount)
          ? record.discount
          : null,
      kmDistance:
        typeof record.kmDistance === "number" &&
        Number.isFinite(record.kmDistance)
          ? record.kmDistance
          : null,
      kmRate:
        typeof record.kmRate === "number" && Number.isFinite(record.kmRate)
          ? record.kmRate
          : null,
      location: typeof record.location === "string" ? record.location : null,
    })),
  };
};
