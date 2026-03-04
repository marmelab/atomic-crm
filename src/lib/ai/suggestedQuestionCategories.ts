export type SuggestionCategory = {
  key: string;
  title: string;
  questions: string[];
};

export const suggestionCategories: SuggestionCategory[] = [
  {
    key: "overview",
    title: "Panoramica",
    questions: [
      "Dammi un riepilogo operativo rapido del CRM.",
      "Dove vedi attenzione immediata tra preventivi e pagamenti?",
      "Come sta andando il business questo mese?",
    ],
  },
  {
    key: "clients_contacts",
    title: "Clienti e referenti",
    questions: [
      "Cosa raccontano clienti e progetti più recenti?",
      "Quali referenti seguono clienti e progetti più recenti?",
      "Mostrami il profilo fiscale dei clienti attivi.",
    ],
  },
  {
    key: "quotes_commercial",
    title: "Preventivi",
    questions: [
      "Ci sono preventivi aperti che richiedono attenzione?",
      "Quale preventivo ha il residuo più alto da incassare?",
      "Riepilogami i preventivi in stato di trattativa.",
    ],
  },
  {
    key: "projects_services",
    title: "Progetti e servizi",
    questions: [
      "Quali progetti attivi hanno servizi non fatturati?",
      "Registra un nuovo servizio sul progetto più recente.",
      "Registra una puntata oggi per il progetto attivo.",
    ],
  },
  {
    key: "payments_invoices",
    title: "Pagamenti e fatture",
    questions: [
      "Chi mi deve dei soldi e quanto?",
      "Prepara un pagamento dal preventivo più rilevante.",
      "Genera la bozza fattura per il cliente con servizi non fatturati.",
    ],
  },
  {
    key: "expenses_travel",
    title: "Spese e trasferte",
    questions: [
      "Che cosa emerge dalle spese recenti?",
      "Calcola la tratta km Valguarnera–Catania andata e ritorno.",
      "Registra una spesa di noleggio per il progetto attivo.",
    ],
  },
  {
    key: "tasks_reminders",
    title: "Promemoria",
    questions: [
      "Ci sono promemoria scaduti o in scadenza?",
      "Quando sono le prossime scadenze fiscali?",
      "Crea un follow-up per il cliente più recente.",
    ],
  },
  {
    key: "workflows",
    title: "Automazioni",
    questions: [
      "Quali automazioni sono attive nel CRM?",
      "Crea un'automazione quando un preventivo viene accettato.",
      "C'è già un workflow che notifica pagamenti scaduti?",
    ],
  },
];
