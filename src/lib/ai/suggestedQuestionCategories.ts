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
      "Come sta andando il business questo mese?",
      "Dove devo intervenire subito tra preventivi e pagamenti?",
      "Dammi un riepilogo operativo rapido del CRM.",
    ],
  },
  {
    key: "invoicing",
    title: "Fatturazione",
    questions: [
      "Devo fatturare, aiutami a scegliere da dove partire.",
      "Fattura per il preventivo più recente.",
      "Preparami la fattura dal progetto attivo.",
      "Genera una bozza fattura dal preventivo accettato.",
    ],
  },
  {
    key: "payments",
    title: "Incassi",
    questions: [
      "Chi mi deve dei soldi e quanto?",
      "Prepara un pagamento dal preventivo più rilevante.",
      "Registra un incasso dal progetto attivo.",
    ],
  },
  {
    key: "work_log",
    title: "Lavoro svolto",
    questions: [
      "Registra una puntata oggi per il progetto attivo.",
      "Registra un nuovo servizio sul progetto più recente.",
      "Quali progetti attivi hanno servizi non fatturati?",
    ],
  },
  {
    key: "expenses_travel",
    title: "Spese e km",
    questions: [
      "Calcola la tratta km Valguarnera–Catania andata e ritorno.",
      "Registra una spesa di noleggio per il progetto attivo.",
      "Che cosa emerge dalle spese recenti?",
    ],
  },
  {
    key: "quotes",
    title: "Preventivi",
    questions: [
      "Ci sono preventivi aperti che richiedono attenzione?",
      "Quale preventivo ha il residuo più alto da incassare?",
      "Riepilogami i preventivi in stato di trattativa.",
    ],
  },
  {
    key: "clients_contacts",
    title: "Clienti",
    questions: [
      "Cosa raccontano clienti e progetti più recenti?",
      "Quali referenti seguono i progetti attivi?",
      "Mostrami il profilo fiscale dei clienti attivi.",
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
