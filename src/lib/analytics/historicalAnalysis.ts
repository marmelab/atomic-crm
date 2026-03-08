import type { LabeledValue } from "@/components/atomic-crm/types";
import type { AiBlock } from "./annualAnalysis";

export const defaultHistoricalAnalysisModel = "gpt-5.2";

export const historicalAnalysisModelChoices: LabeledValue[] = [
  { value: "gpt-5.2", label: "GPT-5.2" },
  { value: "gpt-5-mini", label: "GPT-5 mini" },
  { value: "gpt-5-nano", label: "GPT-5 nano" },
];

// ── Markdown response types ──

export type HistoricalAnalyticsSummary = {
  model: string;
  generatedAt: string;
  summaryMarkdown: string;
};

export type HistoricalAnalyticsAnswer = {
  question: string;
  model: string;
  generatedAt: string;
  answerMarkdown: string;
};

// ── Visual block response types ──

export type HistoricalVisualSummary = {
  model: string;
  generatedAt: string;
  blocks: AiBlock[];
};

export type HistoricalVisualAnswer = {
  question: string;
  model: string;
  generatedAt: string;
  blocks: AiBlock[];
};

// ── Suggested questions with colors and priorities ──

export type HistoricalSuggestedQuestion = {
  label: string;
  question: string;
  color: "emerald" | "sky" | "amber" | "red";
  priority: 1 | 2;
  scope: "storico" | "incassi";
};

export const getHistoricalSuggestedQuestions =
  (): HistoricalSuggestedQuestion[] => [
    // Storico — priority 1 (big grid)
    {
      label: "Segnale importante",
      question: "Qual è il segnale più importante nei dati storici?",
      color: "sky",
      priority: 1,
      scope: "storico",
    },
    {
      label: "Crescita reale",
      question:
        "La crescita anno su anno è reale o dipende da pochi clienti?",
      color: "emerald",
      priority: 1,
      scope: "storico",
    },
    {
      label: "Rischi",
      question:
        "Ci sono rischi di concentrazione su pochi clienti o categorie?",
      color: "red",
      priority: 1,
      scope: "storico",
    },
    {
      label: "Cosa controllare",
      question: "Cosa devo controllare subito guardando questi numeri?",
      color: "amber",
      priority: 1,
      scope: "storico",
    },
    // Storico — priority 2 (small flex-wrap)
    {
      label: "Categoria trainante",
      question: "Quale tipo di lavoro è cresciuto di più negli anni?",
      color: "sky",
      priority: 2,
      scope: "storico",
    },
    {
      label: "Anno migliore",
      question: "Perché l'anno migliore è stato quello? Cosa è successo?",
      color: "emerald",
      priority: 2,
      scope: "storico",
    },
    {
      label: "Dipendenza clienti",
      question: "Quanto dipendo dai primi 3 clienti?",
      color: "amber",
      priority: 2,
      scope: "storico",
    },
    // Incassi — priority 1
    {
      label: "Miglior anno incassi",
      question: "Qual è stato l'anno con più incassi ricevuti?",
      color: "emerald",
      priority: 1,
      scope: "incassi",
    },
    {
      label: "Anno corrente",
      question:
        "L'anno in corso finora è avanti o indietro rispetto all'anno scorso?",
      color: "sky",
      priority: 1,
      scope: "incassi",
    },
    {
      label: "Concentrazione",
      question:
        "Gli incassi sono distribuiti su più progetti o concentrati su pochi?",
      color: "amber",
      priority: 1,
      scope: "incassi",
    },
    {
      label: "Attenzione",
      question: "Che cosa devo leggere con cautela in questi incassi?",
      color: "red",
      priority: 1,
      scope: "incassi",
    },
    // Incassi — priority 2
    {
      label: "Lavoro vs incassi",
      question:
        "Gli incassi seguono il valore del lavoro o ci sono ritardi?",
      color: "sky",
      priority: 2,
      scope: "incassi",
    },
    {
      label: "Stagionalità",
      question: "C'è una stagionalità negli incassi ricevuti?",
      color: "amber",
      priority: 2,
      scope: "incassi",
    },
  ];

// Legacy export for backward compatibility
export const historicalAnalyticsSuggestedQuestions = [
  "Perché il 2025 è andato meglio del 2024?",
  "Qual è il segnale più importante?",
  "Cosa devo controllare subito?",
  "Da dove arrivano davvero i risultati?",
] as const;
