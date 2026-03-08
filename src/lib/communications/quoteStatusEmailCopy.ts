import { formatDateRange } from "@/components/atomic-crm/misc/formatDateRange";
import { quoteStatusLabels } from "@/components/atomic-crm/quotes/quotesTypes";
import type {
  BuildQuoteStatusEmailInput,
  EmailSection,
  QuoteStatusEmailTemplateDefinition,
} from "./quoteStatusEmailTypes";

// ── Helpers ───────────────────────────────────────────────────────────

export const formatCurrency = (value?: number | null) =>
  Number(value ?? 0).toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

// ── Summary rows builder ──────────────────────────────────────────────

export const buildSummaryRows = (input: BuildQuoteStatusEmailInput) => {
  const rows = [
    {
      label: "Preventivo",
      value: input.quote.description?.trim() || "Preventivo",
    },
    {
      label: "Stato",
      value: quoteStatusLabels[input.quote.status] ?? input.quote.status,
    },
  ];

  if (input.serviceLabel) {
    rows.push({ label: "Tipo", value: input.serviceLabel });
  }

  const eventRange = formatDateRange(
    input.quote.event_start,
    input.quote.event_end,
    input.quote.all_day,
  );
  if (eventRange) {
    rows.push({ label: "Quando", value: eventRange });
  }

  if (input.projectName) {
    rows.push({ label: "Progetto", value: input.projectName });
  }

  return rows;
};

// ── Status copy builder ───────────────────────────────────────────────

export const buildStatusCopy = (
  definition: QuoteStatusEmailTemplateDefinition,
  input: BuildQuoteStatusEmailInput,
): {
  subject: string;
  previewText: string;
  headline: string;
  intro: string;
  sections: EmailSection[];
  ctaLabel?: string;
  ctaUrl?: string;
} => {
  const clientName = input.client?.name?.trim() || "cliente";
  const quoteTitle = input.quote.description?.trim() || "Preventivo";
  const amountPaid = formatCurrency(
    input.amountPaid ?? input.paymentAmount ?? input.quote.amount,
  );
  const amountDue = formatCurrency(input.amountDue);

  switch (definition.status) {
    case "preventivo_inviato":
      return {
        subject: `${quoteTitle} - preventivo inviato`,
        previewText: "Ecco la tua proposta con tutti i dettagli.",
        headline: "Ecco la tua proposta",
        intro: `Ciao ${clientName}, ti invio il preventivo con tutti i dettagli. Trovi il documento completo in allegato.`,
        sections: [
          {
            title: "Prossimo passo",
            body: "Puoi rivedere i dettagli e l'importo nel PDF allegato. Se vuoi confermare o fare domande, rispondi a questa mail.",
          },
        ],
        ctaLabel: definition.ctaLabel,
        ctaUrl: input.publicQuoteUrl ?? undefined,
      };
    case "in_trattativa":
      return {
        subject: `${quoteTitle} - aggiornamento`,
        previewText: "Aggiornamento sulla tua proposta.",
        headline: "Aggiornamento sulla tua proposta",
        intro: `Ciao ${clientName}, sto lavorando sugli ultimi dettagli del preventivo.`,
        sections: [
          {
            title: "Nota",
            body:
              input.customMessage?.trim() ||
              "Sto definendo gli ultimi punti prima della conferma finale. Se vuoi aggiungere qualcosa, rispondi direttamente.",
          },
        ],
        ctaLabel: definition.ctaLabel,
        ctaUrl: input.publicQuoteUrl ?? undefined,
      };
    case "accettato":
      return {
        subject: `${quoteTitle} - confermato`,
        previewText: "Il tuo progetto e' confermato!",
        headline: "Il tuo progetto e' confermato!",
        intro: `Ciao ${clientName}, ho registrato la conferma. Da questo momento il lavoro entra nel vivo.`,
        sections: [
          {
            title: "Prossimo passo",
            body:
              input.projectName?.trim()
                ? `Il lavoro e' ora collegato al progetto "${input.projectName}". Ti aggiorno sui prossimi passi.`
                : "Ti aggiorno man mano che il lavoro procede.",
          },
        ],
      };
    case "acconto_ricevuto":
      return {
        subject: `${quoteTitle} - acconto registrato`,
        previewText: "Il tuo acconto e' stato registrato.",
        headline: "Acconto registrato, ci siamo!",
        intro: `Ciao ${clientName}, ho registrato il pagamento. Grazie!`,
        sections: [
          {
            title: "Riepilogo",
            body:
              input.amountDue != null
                ? `Importo registrato: ${amountPaid}. Residuo: ${amountDue}.`
                : `Importo registrato: ${amountPaid}.`,
          },
        ],
      };
    case "in_lavorazione":
      return {
        subject: `${quoteTitle} - lavoro avviato`,
        previewText: "Il lavoro e' partito!",
        headline: "Il lavoro e' partito!",
        intro: `Ciao ${clientName}, il lavoro e' ufficialmente iniziato.`,
        sections: [
          {
            title: "Stato",
            body:
              input.customMessage?.trim() ||
              "Se hai bisogno di un aggiornamento su tempi o consegne, rispondi a questa mail.",
          },
        ],
      };
    case "completato":
      return {
        subject: `${quoteTitle} - lavoro completato`,
        previewText: "Il lavoro e' completato!",
        headline: "Lavoro completato!",
        intro: `Ciao ${clientName}, il lavoro e' finito.`,
        sections: [
          {
            title: "Chiusura",
            body:
              input.amountDue != null && Number(input.amountDue) > 0
                ? `Il lavoro e' chiuso. Residuo ancora aperto: ${amountDue}.`
                : "Il lavoro e' chiuso dal punto di vista operativo.",
          },
          ...(input.customMessage?.trim()
            ? [{ title: "Nota", body: input.customMessage.trim() }]
            : []),
        ],
      };
    case "saldato":
      return {
        subject: `${quoteTitle} - tutto in ordine`,
        previewText: "Il preventivo e' completamente saldato.",
        headline: "Tutto in ordine, grazie!",
        intro: `Ciao ${clientName}, il preventivo e' completamente saldato.`,
        sections: [
          {
            title: "Chiusura",
            body: `Totale registrato: ${amountPaid}. Grazie per la collaborazione!`,
          },
        ],
      };
    case "rifiutato":
      return {
        subject: `${quoteTitle} - chiusura preventivo`,
        previewText: "Chiusura del preventivo.",
        headline: "Grazie per aver valutato la proposta",
        intro: `Ciao ${clientName}, chiudo il preventivo nel gestionale.`,
        sections: [
          {
            title: "Nota",
            body:
              input.customMessage?.trim() ||
              input.quote.rejection_reason?.trim() ||
              "Ti ringrazio per il confronto. Se in futuro vorrai riaprire il discorso, ripartiamo da qui.",
          },
        ],
      };
    default:
      return {
        subject: `${quoteTitle} - aggiornamento stato`,
        previewText: `Aggiornamento: ${definition.statusLabel}.`,
        headline: `Aggiornamento: ${definition.statusLabel}`,
        intro: `Ciao ${clientName}, il preventivo e' stato aggiornato.`,
        sections: [
          {
            title: "Aggiornamento",
            body:
              input.customMessage?.trim() ||
              "Questo messaggio conferma l'aggiornamento dello stato.",
          },
        ],
      };
  }
};
