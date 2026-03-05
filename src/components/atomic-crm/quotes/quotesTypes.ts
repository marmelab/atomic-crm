export const quoteStatuses = [
  {
    value: "primo_contatto",
    label: "Primo contatto",
    description:
      "Richiesta iniziale non ancora trasformata in proposta inviata.",
  },
  {
    value: "preventivo_inviato",
    label: "Preventivo inviato",
    description: "Proposta inviata al cliente e in attesa di risposta.",
  },
  {
    value: "in_trattativa",
    label: "In trattativa",
    description: "Preventivo aperto con negoziazione o chiarimenti in corso.",
  },
  {
    value: "accettato",
    label: "Accettato",
    description: "Preventivo confermato dal cliente.",
  },
  {
    value: "acconto_ricevuto",
    label: "Acconto ricevuto",
    description: "Preventivo accettato con primo incasso già registrato.",
  },
  {
    value: "in_lavorazione",
    label: "In lavorazione",
    description: "Lavoro operativo partito ma non ancora concluso.",
  },
  {
    value: "completato",
    label: "Completato",
    description: "Lavoro terminato ma non ancora interamente saldato.",
  },
  {
    value: "saldato",
    label: "Saldato",
    description: "Lavoro chiuso e interamente incassato.",
  },
  {
    value: "rifiutato",
    label: "Rifiutato",
    description: "Preventivo rifiutato esplicitamente dal cliente.",
  },
  {
    value: "perso",
    label: "Perso",
    description: "Opportunità sfumata senza chiusura positiva.",
  },
];

export const quoteStatusLabels: Record<string, string> = Object.fromEntries(
  quoteStatuses.map((s) => [s.value, s.label]),
);

/**
 * Semantic color map for each quote status.
 * Used consistently across Kanban columns, cards, and mobile UI.
 */
export const quoteStatusStyles: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  primo_contatto: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-l-slate-400",
    dot: "bg-slate-400",
  },
  preventivo_inviato: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-l-blue-500",
    dot: "bg-blue-500",
  },
  in_trattativa: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-l-amber-500",
    dot: "bg-amber-500",
  },
  accettato: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-l-green-500",
    dot: "bg-green-500",
  },
  acconto_ricevuto: {
    bg: "bg-teal-50",
    text: "text-teal-700",
    border: "border-l-teal-500",
    dot: "bg-teal-500",
  },
  in_lavorazione: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-l-violet-500",
    dot: "bg-violet-500",
  },
  completato: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-l-sky-500",
    dot: "bg-sky-500",
  },
  saldato: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-l-emerald-500",
    dot: "bg-emerald-500",
  },
  rifiutato: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-l-red-400",
    dot: "bg-red-400",
  },
  perso: {
    bg: "bg-stone-100",
    text: "text-stone-500",
    border: "border-l-stone-400",
    dot: "bg-stone-400",
  },
};

export const defaultQuoteStatusStyle = quoteStatusStyles.primo_contatto;
