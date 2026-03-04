import { renderHtml, renderText } from "./quoteStatusEmailRenderers";
import type { PaymentReminderEmailInput } from "./paymentReminderEmailTypes";

const formatCurrency = (value: number) =>
  value.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const paymentTypeLabels: Record<string, string> = {
  acconto: "Acconto",
  saldo: "Saldo",
  parziale: "Parziale",
  rimborso_spese: "Rimborso spese",
};

export const buildPaymentReminderEmail = (input: PaymentReminderEmailInput) => {
  const businessName = input.businessName ?? "Rosario Furnari";
  const typeLabel =
    paymentTypeLabels[input.paymentType] ?? input.paymentType ?? "Pagamento";

  const subject = `Promemoria pagamento — ${typeLabel} ${formatCurrency(input.amount)}`;

  const previewText = `Gentile ${input.clientName}, un cortese promemoria per il pagamento di ${formatCurrency(input.amount)} previsto per il ${formatDate(input.paymentDate)}.`;

  const intro = `Gentile ${input.clientName},\n\nle scrivo per un cortese promemoria relativo a un pagamento che risulta in attesa da ${input.daysOverdue} ${input.daysOverdue === 1 ? "giorno" : "giorni"}.`;

  const summaryRows: Array<{ label: string; value: string }> = [
    { label: "Tipo", value: typeLabel },
    { label: "Importo", value: formatCurrency(input.amount) },
    { label: "Scadenza prevista", value: formatDate(input.paymentDate) },
    {
      label: "Giorni di ritardo",
      value: `${input.daysOverdue}`,
    },
  ];

  if (input.invoiceRef) {
    summaryRows.push({ label: "Rif. fattura", value: input.invoiceRef });
  }
  if (input.projectName) {
    summaryRows.push({ label: "Progetto", value: input.projectName });
  }

  const sections = [];

  if (input.customMessage) {
    sections.push({
      title: "Nota",
      body: input.customMessage,
    });
  }

  sections.push({
    title: "Come procedere",
    body: "Se il pagamento è già stato effettuato la prego di ignorare questo promemoria. In caso contrario, le sarei grato se potesse provvedere al saldo a breve.\n\nPer qualsiasi chiarimento non esiti a contattarmi.",
  });

  const html = renderHtml({
    businessName,
    previewText,
    subject,
    intro,
    summaryRows,
    sections,
    supportEmail: input.supportEmail,
  });

  const text = renderText({
    businessName,
    subject,
    intro,
    summaryRows,
    sections,
    supportEmail: input.supportEmail,
  });

  return { subject, previewText, html, text };
};
