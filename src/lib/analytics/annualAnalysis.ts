import { defaultHistoricalAnalysisModel } from "./historicalAnalysis";

export const defaultAnnualAnalysisModel = defaultHistoricalAnalysisModel;

export type SuggestedQuestion = {
  label: string;
  question: string;
  color: "emerald" | "amber" | "sky" | "red";
  priority: 1 | 2;
};

export const getAnnualOperationsSuggestedQuestions = ({
  year,
  isCurrentYear,
}: {
  year: number;
  isCurrentYear: boolean;
}): SuggestedQuestion[] =>
  isCurrentYear
    ? [
        // ── Priority 1 — big chips, key questions ──
        {
          label: "Sto crescendo?",
          question: `Sono sulla buona strada rispetto all'anno scorso? Confronta i numeri chiave del ${year} finora con lo stesso periodo del ${year - 1}.`,
          color: "sky",
          priority: 1,
        },
        {
          label: "Quanto mi resta?",
          question: `Quanto mi resta davvero nel ${year} dopo tasse, INPS e spese? Dammi il netto reale.`,
          color: "emerald",
          priority: 1,
        },
        // ── Priority 2 — smaller chips, deeper analysis ──
        {
          label: "Chi devo coltivare?",
          question: `Quale cliente dovrei coltivare di più nel ${year}? Analizza concentrazione, valore e potenziale.`,
          color: "amber",
          priority: 2,
        },
        {
          label: "Dove perdo margine?",
          question: `Dove sto perdendo margine nel ${year}? Analizza spese vs ricavi per categoria e segnala inefficienze.`,
          color: "red",
          priority: 2,
        },
        {
          label: "Preventivi aperti",
          question: `Quali preventivi aperti del ${year} hanno più probabilità di chiudersi? Analizza valore, anzianità e stato.`,
          color: "amber",
          priority: 2,
        },
        {
          label: "Mesi migliori",
          question: `Quali sono stati i mesi migliori e peggiori del ${year} finora? Analizza ricavi, lavori e stagionalità.`,
          color: "sky",
          priority: 2,
        },
        {
          label: "Soldi da incassare",
          question: `Quanti soldi devo ancora incassare nel ${year}? Elenca i pagamenti in attesa per cliente e scadenza.`,
          color: "emerald",
          priority: 2,
        },
        {
          label: "Dipendo troppo da qualcuno?",
          question: `Il mio fatturato del ${year} dipende troppo da pochi clienti? Analizza la concentrazione e il rischio.`,
          color: "red",
          priority: 2,
        },
      ]
    : [
        // ── Priority 1 — big chips, key questions ──
        {
          label: "Com'è andato?",
          question: `Com'è andato il ${year} rispetto al ${year - 1}? Confronta ricavi, clienti, margini.`,
          color: "sky",
          priority: 1,
        },
        {
          label: "Quanto ho guadagnato?",
          question: `Quanto ho guadagnato davvero nel ${year}? Netto reale dopo tasse, INPS e spese.`,
          color: "emerald",
          priority: 1,
        },
        // ── Priority 2 — smaller chips, deeper analysis ──
        {
          label: "Chi ha portato valore?",
          question: `Quale cliente mi ha portato più valore nel ${year}? Analizza concentrazione e dipendenza.`,
          color: "amber",
          priority: 2,
        },
        {
          label: "Dove ho speso troppo?",
          question: `Dove ho speso troppo nel ${year}? Analizza le spese per categoria e segnala quelle anomale.`,
          color: "red",
          priority: 2,
        },
        {
          label: "Mese migliore",
          question: `Qual è stato il mese migliore e peggiore del ${year}? Analizza ricavi, lavori completati e stagionalità.`,
          color: "sky",
          priority: 2,
        },
        {
          label: "Preventivi vinti e persi",
          question: `Quanti preventivi ho vinto e quanti ho perso nel ${year}? Analizza il tasso di conversione e il valore perso.`,
          color: "amber",
          priority: 2,
        },
        {
          label: "Categorie più redditizie",
          question: `Quali categorie di lavoro sono state più redditizie nel ${year}? Confronta ricavi e margini per tipo di servizio.`,
          color: "emerald",
          priority: 2,
        },
        {
          label: "Lezione principale",
          question: `Guardando tutti i dati del ${year}, qual è la lezione principale che dovrei portarmi per l'anno dopo?`,
          color: "sky",
          priority: 2,
        },
      ];

export type AnnualOperationsAnalyticsSummary = {
  model: string;
  generatedAt: string;
  summaryMarkdown: string;
};

export type AnnualOperationsAnalyticsAnswer = {
  question: string;
  model: string;
  generatedAt: string;
  answerMarkdown: string;
};

// ── Visual mode (AI block rendering) ──

export type AiBlockColor =
  | "emerald"
  | "red"
  | "amber"
  | "sky"
  | "gray"
  | "blue"
  | "violet"
  | "rose";

export type AiBlock =
  | { type: "text"; content: string }
  | {
      type: "callout";
      tone: "info" | "warning" | "success";
      content: string;
    }
  | { type: "action"; content: string }
  | {
      type: "metrics";
      items: { label: string; value: string; color?: AiBlockColor }[];
    }
  | { type: "list"; title?: string; items: string[] }
  | {
      type: "bar-chart";
      title?: string;
      items: { label: string; value: number; color?: AiBlockColor }[];
    }
  | {
      type: "progress";
      label: string;
      current: number;
      total: number;
      color?: AiBlockColor;
    }
  | {
      type: "trend";
      label?: string;
      points: { label: string; value: number }[];
      unit?: string;
    }
  | {
      type: "comparison";
      left: { label: string; value: string };
      right: { label: string; value: string };
      delta?: string;
      deltaDirection?: "up" | "down" | "flat";
    }
  | {
      type: "breakdown";
      title?: string;
      items: { label: string; value: number; color?: AiBlockColor }[];
    };

export type AnnualOperationsVisualSummary = {
  model: string;
  generatedAt: string;
  blocks: AiBlock[];
};

export type AnnualOperationsVisualAnswer = {
  question: string;
  model: string;
  generatedAt: string;
  blocks: AiBlock[];
};
