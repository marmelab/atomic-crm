import { formatDateRange } from "@/components/atomic-crm/misc/formatDateRange";
import { quoteStatusLabels } from "@/components/atomic-crm/quotes/quotesTypes";
import type {
  BuildQuoteStatusEmailInput,
  BuiltQuoteStatusEmailTemplate,
  QuoteStatusEmailTemplateDefinition,
} from "./quoteStatusEmailTypes";
import { buildStatusCopy, buildSummaryRows } from "./quoteStatusEmailCopy";
import { renderHtml, renderText } from "./quoteStatusEmailRenderers";

// Re-export types for backward compatibility
export type {
  QuoteStatusEmailSendPolicy,
  QuoteStatusEmailTemplateDefinition,
  BuildQuoteStatusEmailInput,
  BuiltQuoteStatusEmailTemplate,
  QuoteStatusEmailSendRequest,
  QuoteStatusEmailSendResponse,
} from "./quoteStatusEmailTypes";

// ── Template definitions ──────────────────────────────────────────────

const quoteStatusEmailDefinitions: Record<
  string,
  QuoteStatusEmailTemplateDefinition
> = {
  primo_contatto: {
    templateId: "quote-status.primo-contatto",
    status: "primo_contatto",
    statusLabel: quoteStatusLabels.primo_contatto ?? "Primo contatto",
    sendPolicy: "never",
    purpose:
      "Stato interno iniziale: non va trasformato in mail cliente automatica.",
    requiredDynamicFields: [],
    optionalDynamicFields: [],
  },
  preventivo_inviato: {
    templateId: "quote-status.preventivo-inviato",
    status: "preventivo_inviato",
    statusLabel:
      quoteStatusLabels.preventivo_inviato ?? "Preventivo inviato",
    sendPolicy: "recommended",
    purpose: "Inviare il preventivo e spiegare i prossimi passi al cliente.",
    ctaLabel: "Apri il preventivo",
    requiredDynamicFields: [
      "client_name",
      "client_email",
      "quote_description",
    ],
    optionalDynamicFields: [
      "public_quote_url",
      "service_label",
      "event_range",
      "support_email",
    ],
  },
  in_trattativa: {
    templateId: "quote-status.in-trattativa",
    status: "in_trattativa",
    statusLabel: quoteStatusLabels.in_trattativa ?? "In trattativa",
    sendPolicy: "manual",
    purpose:
      "Aggiornare il cliente quando il preventivo e' in confronto o revisione.",
    ctaLabel: "Rivedi il preventivo",
    requiredDynamicFields: [
      "client_name",
      "client_email",
      "quote_description",
    ],
    optionalDynamicFields: [
      "public_quote_url",
      "custom_message",
      "support_email",
    ],
  },
  accettato: {
    templateId: "quote-status.accettato",
    status: "accettato",
    statusLabel: quoteStatusLabels.accettato ?? "Accettato",
    sendPolicy: "recommended",
    purpose:
      "Confermare al cliente che il preventivo e' stato preso in carico.",
    requiredDynamicFields: ["client_name", "client_email"],
    optionalDynamicFields: ["project_name", "event_range", "support_email"],
  },
  acconto_ricevuto: {
    templateId: "quote-status.acconto-ricevuto",
    status: "acconto_ricevuto",
    statusLabel: quoteStatusLabels.acconto_ricevuto ?? "Acconto ricevuto",
    sendPolicy: "recommended",
    purpose:
      "Confermare al cliente che il primo pagamento e' stato registrato.",
    requiredDynamicFields: ["client_name", "client_email"],
    optionalDynamicFields: [
      "payment_amount",
      "amount_paid",
      "amount_due",
      "support_email",
    ],
  },
  in_lavorazione: {
    templateId: "quote-status.in-lavorazione",
    status: "in_lavorazione",
    statusLabel: quoteStatusLabels.in_lavorazione ?? "In lavorazione",
    sendPolicy: "manual",
    purpose: "Segnalare al cliente che il lavoro e' partito davvero.",
    requiredDynamicFields: ["client_name", "client_email"],
    optionalDynamicFields: [
      "project_name",
      "event_range",
      "support_email",
    ],
  },
  completato: {
    templateId: "quote-status.completato",
    status: "completato",
    statusLabel: quoteStatusLabels.completato ?? "Completato",
    sendPolicy: "recommended",
    purpose: "Avvisare il cliente che il lavoro e' completato.",
    requiredDynamicFields: ["client_name", "client_email"],
    optionalDynamicFields: [
      "amount_due",
      "support_email",
      "custom_message",
    ],
  },
  saldato: {
    templateId: "quote-status.saldato",
    status: "saldato",
    statusLabel: quoteStatusLabels.saldato ?? "Saldato",
    sendPolicy: "recommended",
    purpose:
      "Chiudere il lavoro comunicando che il preventivo e' completamente saldato.",
    requiredDynamicFields: ["client_name", "client_email"],
    optionalDynamicFields: ["amount_paid", "support_email"],
  },
  rifiutato: {
    templateId: "quote-status.rifiutato",
    status: "rifiutato",
    statusLabel: quoteStatusLabels.rifiutato ?? "Rifiutato",
    sendPolicy: "manual",
    purpose:
      "Usare solo se vuoi mandare un messaggio di chiusura o cortesia.",
    requiredDynamicFields: ["client_name", "client_email"],
    optionalDynamicFields: [
      "rejection_reason",
      "support_email",
      "custom_message",
    ],
  },
  perso: {
    templateId: "quote-status.perso",
    status: "perso",
    statusLabel: quoteStatusLabels.perso ?? "Perso",
    sendPolicy: "never",
    purpose:
      "Stato interno di pipeline: non va inviato automaticamente al cliente.",
    requiredDynamicFields: [],
    optionalDynamicFields: [],
  },
};

export const quoteStatusEmailTemplateDefinitions = Object.values(
  quoteStatusEmailDefinitions,
);

export const getQuoteStatusEmailTemplateDefinition = (
  status: string,
): QuoteStatusEmailTemplateDefinition =>
  quoteStatusEmailDefinitions[status] ?? {
    templateId: `quote-status.${status}`,
    status,
    statusLabel: quoteStatusLabels[status] ?? status,
    sendPolicy: "manual",
    purpose: "Stato non ancora classificato per l'invio mail cliente.",
    requiredDynamicFields: ["client_name", "client_email"],
    optionalDynamicFields: ["custom_message"],
  };

// ── Missing fields resolver ───────────────────────────────────────────

const resolveMissingFields = (
  definition: QuoteStatusEmailTemplateDefinition,
  input: BuildQuoteStatusEmailInput,
) => {
  const eventRange = formatDateRange(
    input.quote.event_start,
    input.quote.event_end,
    input.quote.all_day,
  );

  const fieldMap: Record<string, boolean> = {
    client_name: !!input.client?.name?.trim(),
    client_email: !!input.client?.email?.trim(),
    quote_description: !!input.quote.description?.trim(),
    public_quote_url: !!input.publicQuoteUrl?.trim(),
    service_label: !!input.serviceLabel?.trim(),
    event_range: !!eventRange,
    project_name: !!input.projectName?.trim(),
    payment_amount: input.paymentAmount != null,
    amount_paid: input.amountPaid != null,
    amount_due: input.amountDue != null,
    support_email: !!input.supportEmail?.trim(),
    rejection_reason: !!input.quote.rejection_reason?.trim(),
    custom_message: !!input.customMessage?.trim(),
  };

  return definition.requiredDynamicFields.filter((field) => !fieldMap[field]);
};

const getAutomaticSendBlockReason = (input: BuildQuoteStatusEmailInput) => {
  if (input.hasNonTaxableServices) {
    return "Invio automatico vietato: il flusso include servizi con is_taxable = false.";
  }
  return undefined;
};

// ── Main builder ──────────────────────────────────────────────────────

export const buildQuoteStatusEmailTemplate = (
  input: BuildQuoteStatusEmailInput,
): BuiltQuoteStatusEmailTemplate => {
  const definition = getQuoteStatusEmailTemplateDefinition(input.quote.status);
  const missingFields = resolveMissingFields(definition, input);
  const automaticSendBlockReason = getAutomaticSendBlockReason(input);
  const businessName = input.businessName?.trim() || "Rosario Furnari";
  const summaryRows = buildSummaryRows(input);
  const statusCopy = buildStatusCopy(definition, input);
  const canSend =
    definition.sendPolicy !== "never" && missingFields.length === 0;
  const automaticSendAllowed =
    definition.sendPolicy === "recommended" &&
    missingFields.length === 0 &&
    !automaticSendBlockReason;

  return {
    ...definition,
    canSend,
    automaticSendAllowed,
    automaticSendBlockReason,
    missingFields,
    subject: statusCopy.subject,
    previewText: statusCopy.previewText,
    html: renderHtml({
      businessName,
      previewText: statusCopy.previewText,
      subject: statusCopy.subject,
      intro: statusCopy.intro,
      summaryRows,
      sections: statusCopy.sections,
      ctaLabel: definition.ctaLabel,
      ctaUrl: statusCopy.ctaUrl,
      supportEmail: input.supportEmail,
    }),
    text: renderText({
      businessName,
      subject: statusCopy.subject,
      intro: statusCopy.intro,
      summaryRows,
      sections: statusCopy.sections,
      ctaLabel: definition.ctaLabel,
      ctaUrl: statusCopy.ctaUrl,
      supportEmail: input.supportEmail,
    }),
  };
};
