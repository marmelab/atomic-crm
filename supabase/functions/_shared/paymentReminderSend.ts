export type PaymentReminderSendPayload = {
  to?: string;
  subject?: string;
  html?: string;
  text?: string;
  paymentId?: string | number | null;
  clientName?: string;
  amount?: number;
  daysOverdue?: number;
};

export const validatePaymentReminderSendPayload = (
  payload: PaymentReminderSendPayload,
) => {
  if (!payload.to?.trim()) {
    return "Destinatario email mancante.";
  }

  if (!payload.subject?.trim()) {
    return "Oggetto email mancante.";
  }

  if (!payload.html?.trim()) {
    return "Contenuto HTML email mancante.";
  }

  if (!payload.text?.trim()) {
    return "Contenuto testuale email mancante.";
  }

  return null;
};
