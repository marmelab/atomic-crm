import { formatDateRange } from "@/components/atomic-crm/misc/formatDateRange";
import { quoteStatusLabels } from "@/components/atomic-crm/quotes/quotesTypes";
import type {
  BuildQuoteStatusEmailInput,
  EmailSection,
  QuoteStatusEmailTemplateDefinition,
} from "./quoteStatusEmailTypes";

// ── Helpers ───────────────────────────────────────────────────────────

const DEFAULT_BUSINESS_NAME = "Rosario Furnari";

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
    {
      label: "Importo",
      value: formatCurrency(input.quote.amount),
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

  if (input.amountPaid != null) {
    rows.push({
      label: "Gia' registrato",
      value: formatCurrency(input.amountPaid),
    });
  }

  if (input.amountDue != null) {
    rows.push({ label: "Residuo", value: formatCurrency(input.amountDue) });
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
  intro: string;
  sections: EmailSection[];
  ctaUrl?: string;
} => {
  const clientName = input.client?.name?.trim() || "cliente";
  const quoteTitle = input.quote.description?.trim() || "Preventivo";
  const businessName = input.businessName?.trim() || DEFAULT_BUSINESS_NAME;
  const amountPaid = formatCurrency(
    input.amountPaid ?? input.paymentAmount ?? input.quote.amount,
  );
  const amountDue = formatCurrency(input.amountDue);

  switch (definition.status) {
    case "preventivo_inviato":
      return {
        subject: `${quoteTitle} - preventivo inviato`,
        previewText: "Ti ho inviato il preventivo con i dettagli principali.",
        intro: `Ciao ${clientName}, ti invio il preventivo aggiornato. Qui sotto trovi il riepilogo essenziale e il prossimo passo.`,
        sections: [
          {
            title: "Cosa aspettarti adesso",
            body: "Puoi rivedere i dettagli, l'importo e le date previste. Se vuoi confermare o fare domande, puoi rispondere a questa mail.",
          },
        ],
        ctaUrl: input.publicQuoteUrl ?? undefined,
      };
    case "in_trattativa":
      return {
        subject: `${quoteTitle} - aggiornamento sulla trattativa`,
        previewText: "Il preventivo e' in revisione o confronto.",
        intro: `Ciao ${clientName}, sto aggiornando il preventivo e lo tengo in stato di trattativa per allineare bene dettagli, tempi o condizioni.`,
        sections: [
          {
            title: "Perche' ricevi questa mail",
            body:
              input.customMessage?.trim() ||
              "Sto lavorando sugli ultimi punti aperti prima della conferma finale. Se vuoi aggiungere una nota o un chiarimento, puoi rispondere direttamente.",
          },
        ],
        ctaUrl: input.publicQuoteUrl ?? undefined,
      };
    case "accettato":
      return {
        subject: `${quoteTitle} - conferma ricevuta`,
        previewText: "Il preventivo risulta confermato.",
        intro: `Ciao ${clientName}, ho registrato la conferma del preventivo. Da questo momento il lavoro entra nel flusso operativo.`,
        sections: [
          {
            title: "Prossimo passo",
            body:
              input.projectName?.trim()
                ? `Il lavoro e' ora collegato al progetto "${input.projectName}".`
                : "Ti aggiornero' man mano che il lavoro passa alle fasi operative.",
          },
        ],
      };
    case "acconto_ricevuto":
      return {
        subject: `${quoteTitle} - acconto registrato`,
        previewText: "Il primo pagamento risulta registrato correttamente.",
        intro: `Ciao ${clientName}, ho registrato l'acconto relativo al preventivo.`,
        sections: [
          {
            title: "Riepilogo pagamento",
            body:
              input.amountDue != null
                ? `Importo registrato: ${amountPaid}. Residuo ancora aperto: ${amountDue}.`
                : `Importo registrato: ${amountPaid}.`,
          },
        ],
      };
    case "in_lavorazione":
      return {
        subject: `${quoteTitle} - lavoro avviato`,
        previewText: "Il lavoro e' ufficialmente in lavorazione.",
        intro: `Ciao ${clientName}, il lavoro collegato al preventivo e' partito e risulta ora in lavorazione.`,
        sections: [
          {
            title: "Stato operativo",
            body:
              input.customMessage?.trim() ||
              "Se dovesse servire un aggiornamento puntuale su tempi o consegne, puoi rispondere a questa mail.",
          },
        ],
      };
    case "completato":
      return {
        subject: `${quoteTitle} - lavoro completato`,
        previewText: "Il lavoro risulta completato.",
        intro: `Ciao ${clientName}, ti confermo che il lavoro legato al preventivo risulta completato.`,
        sections: [
          {
            title: "Chiusura operativa",
            body:
              input.amountDue != null
                ? `Il lavoro e' chiuso dal punto di vista operativo. Residuo economico ancora aperto: ${amountDue}.`
                : "Il lavoro e' chiuso dal punto di vista operativo.",
          },
          ...(input.customMessage?.trim()
            ? [{ title: "Nota", body: input.customMessage.trim() }]
            : []),
        ],
      };
    case "saldato":
      return {
        subject: `${quoteTitle} - saldo completato`,
        previewText: "Il preventivo risulta completamente saldato.",
        intro: `Ciao ${clientName}, il preventivo risulta ora completamente saldato.`,
        sections: [
          {
            title: "Chiusura amministrativa",
            body: `Totale registrato: ${amountPaid}. Grazie per la collaborazione.`,
          },
        ],
      };
    case "rifiutato":
      return {
        subject: `${quoteTitle} - chiusura preventivo`,
        previewText: "Mail di chiusura da usare solo manualmente.",
        intro: `Ciao ${clientName}, chiudo il preventivo nel gestionale.`,
        sections: [
          {
            title: "Nota",
            body:
              input.customMessage?.trim() ||
              input.quote.rejection_reason?.trim() ||
              "Ti ringrazio per il confronto. Se in futuro vorrai riaprire il discorso, possiamo ripartire da qui.",
          },
        ],
      };
    default:
      return {
        subject: `${quoteTitle} - aggiornamento stato`,
        previewText: `Aggiornamento stato: ${definition.statusLabel}.`,
        intro: `Ciao ${clientName}, il preventivo e' stato aggiornato in stato "${definition.statusLabel}".`,
        sections: [
          {
            title: "Aggiornamento",
            body:
              input.customMessage?.trim() ||
              `Questo messaggio conferma l'aggiornamento dello stato nel CRM di ${businessName}.`,
          },
        ],
      };
  }
};
