export type QuoteStatusEmailSendPayload = {
  to?: string;
  subject?: string;
  html?: string;
  text?: string;
  templateId?: string;
  status?: string;
  quoteId?: string | number | null;
  automatic?: boolean;
  hasNonTaxableServices?: boolean | null;
  pdfBase64?: string | null;
  pdfFilename?: string | null;
};

export const validateQuoteStatusEmailSendPayload = (
  payload: QuoteStatusEmailSendPayload,
) => {
  if (!payload.to?.trim()) {
    return "Destinatario mail cliente mancante.";
  }

  if (!payload.subject?.trim()) {
    return "Oggetto mail cliente mancante.";
  }

  if (!payload.html?.trim()) {
    return "Contenuto HTML mail cliente mancante.";
  }

  if (!payload.text?.trim()) {
    return "Contenuto testuale mail cliente mancante.";
  }

  if (!payload.templateId?.trim()) {
    return "Template mail cliente mancante.";
  }

  if (!payload.status?.trim()) {
    return "Stato preventivo mancante per la mail cliente.";
  }

  if (payload.automatic && payload.hasNonTaxableServices) {
    return "Invio automatico vietato: il flusso include servizi con is_taxable = false.";
  }

  return null;
};
