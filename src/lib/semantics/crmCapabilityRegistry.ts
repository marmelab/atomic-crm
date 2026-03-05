import { quoteStatusEmailTemplateDefinitions } from "@/lib/communications/quoteStatusEmailTemplates";
import { getAiResourceModules } from "@/components/atomic-crm/root/moduleRegistry";

export type CrmCapabilityRegistry = {
  routing: {
    mode: "hash";
    routePrefix: "/#/";
    meaning: string;
  };
  resources: Array<{
    resource: string;
    label: string;
    description: string;
    routePatterns: string[];
    supportedViews: Array<"list" | "show" | "create" | "edit">;
  }>;
  pages: Array<{
    id: string;
    label: string;
    routePattern: string;
    description: string;
  }>;
  dialogs: Array<{
    id: string;
    label: string;
    description: string;
    sourceFile: string;
    entryPoints: string[];
    actsOn?: string[];
  }>;
  actions: Array<{
    id: string;
    label: string;
    description: string;
    sourceFile: string;
    actsOn: string[];
    requiredFields: string[];
    sideEffects?: string[];
  }>;
  communications: {
    quoteStatusEmails: {
      provider: "gmail_smtp";
      description: string;
      sharedBlocks: string[];
      safetyRules: string[];
      requiredEnvKeys: string[];
      templates: typeof quoteStatusEmailTemplateDefinitions;
    };
    internalPriorityNotifications: {
      provider: "callmebot";
      description: string;
      useCases: string[];
      requiredEnvKeys: string[];
      rules: string[];
    };
    fiscalDeadlineReminders: {
      provider: "pg_cron + Edge Function";
      description: string;
      schedule: string;
      taskTypes: string[];
      rules: string[];
    };
  };
  integrationChecklist: Array<{
    id: string;
    label: string;
    description: string;
  }>;
};

export const buildCrmCapabilityRegistry = (): CrmCapabilityRegistry => ({
  routing: {
    mode: "hash",
    routePrefix: "/#/",
    meaning:
      "Nel runtime locale e nelle route principali del CRM si usa hash routing; gli smoke e i deep link devono rispettarlo.",
  },
  resources: getAiResourceModules().map((module) => ({
    resource: module.resource,
    label: module.ai.label,
    description: module.ai.description,
    routePatterns: module.ai.routePatterns,
    supportedViews: module.ai.supportedViews,
  })),
  pages: [
    {
      id: "dashboard",
      label: "Dashboard",
      routePattern: "/#/",
      description:
        "Dashboard con vista Annuale e Storico; lo Storico e' AI-ready, Annuale ha AI solo sul contesto annual_operations.",
    },
    {
      id: "settings",
      label: "Impostazioni",
      routePattern: "/#/settings",
      description:
        "Config centrale per marchio, tipi, regole fiscali, AI analitica/read-only CRM, modello Gemini fatture e operativita'.",
    },
    {
      id: "profile",
      label: "Profilo",
      routePattern: "/#/profile",
      description: "Pagina profilo utente corrente.",
    },
  ],
  dialogs: [
    {
      id: "unified_ai_launcher_sheet",
      label: "Chat AI unificata",
      description:
        "Launcher globale flottante che apre la shell unica della chat AI sopra il CRM senza cambiare route e ora include anche una snapshot coerente del CRM core.",
      sourceFile: "src/components/atomic-crm/ai/UnifiedAiLauncher.tsx",
      entryPoints: ["global_floating_button"],
    },
    {
      id: "unified_ai_composer_dialog",
      label: "Editor esteso chat AI",
      description:
        "Dialog full-screen per continuare a scrivere domande lunghe nel launcher: l'icona compare dalla terza riga del composer compatto, mentre la scrollbar locale compare dalla settima.",
      sourceFile: "src/components/atomic-crm/ai/UnifiedCrmAnswerPanel.tsx",
      entryPoints: ["unified_ai_launcher_sheet"],
    },
    {
      id: "quote_create_dialog",
      label: "Nuovo preventivo",
      description: "Creazione preventivo in dialog sopra la board preventivi.",
      sourceFile: "src/components/atomic-crm/quotes/QuoteCreate.tsx",
      entryPoints: ["/#/quotes/create"],
      actsOn: ["quotes"],
    },
    {
      id: "quote_show_dialog",
      label: "Dettaglio preventivo",
      description: "Vista dettaglio preventivo con PDF, link pagamenti e progetto.",
      sourceFile: "src/components/atomic-crm/quotes/QuoteShow.tsx",
      entryPoints: ["/#/quotes/:id/show"],
      actsOn: ["quotes", "projects", "payments"],
    },
    {
      id: "quote_edit_dialog",
      label: "Modifica preventivo",
      description: "Modifica campi preventivo in dialog dedicato.",
      sourceFile: "src/components/atomic-crm/quotes/QuoteEdit.tsx",
      entryPoints: ["/#/quotes/:id"],
      actsOn: ["quotes"],
    },
    {
      id: "create_project_from_quote_dialog",
      label: "Crea progetto dal preventivo",
      description: "Crea e collega un progetto partendo da un preventivo operativo.",
      sourceFile: "src/components/atomic-crm/quotes/CreateProjectFromQuoteDialog.tsx",
      entryPoints: ["quote_show_dialog"],
      actsOn: ["quotes", "projects"],
    },
    {
      id: "create_service_from_quote_dialog",
      label: "Registra servizio dal preventivo",
      description: "Converte un preventivo accettato in servizio con mapping tipo e fee, opzionalmente creando anche il progetto.",
      sourceFile: "src/components/atomic-crm/quotes/CreateServiceFromQuoteDialog.tsx",
      entryPoints: ["quote_show_dialog"],
      actsOn: ["quotes", "services", "projects"],
    },
    {
      id: "quick_client_create_dialog",
      label: "Creazione rapida cliente",
      description: "Dialog standalone per creare un cliente con campi essenziali, riusabile da qualsiasi punto del CRM.",
      sourceFile: "src/components/atomic-crm/clients/QuickClientCreateDialog.tsx",
      entryPoints: ["quote_show_dialog"],
      actsOn: ["clients", "quotes"],
    },
    {
      id: "quick_episode_dialog",
      label: "Registra puntata",
      description:
        "Inserimento rapido di servizio+spostamento per progetti TV, con calcolatore tratta km riusabile per compilare chilometri, tariffa e costo trasferta.",
      sourceFile: "src/components/atomic-crm/projects/QuickEpisodeDialog.tsx",
      entryPoints: ["/#/projects/:id/show"],
      actsOn: ["projects", "services", "expenses"],
    },
    {
      id: "travel_route_calculator_dialog",
      label: "Calcolatore tratta km",
      description:
        "Dialog riusabile che chiede partenza, arrivo, tipo tratta e tariffa km, offre suggerimenti luogo mentre scrivi, usa openrouteservice lato server e applica il risultato ai campi km/costo nelle UI che gestiscono spostamenti.",
      sourceFile: "src/components/atomic-crm/travel/TravelRouteCalculatorDialog.tsx",
      entryPoints: ["expenses", "services", "quick_episode_dialog"],
      actsOn: ["services", "expenses", "projects"],
    },
    {
      id: "quick_payment_dialog",
      label: "Registra pagamento rapido",
      description: "Registra un pagamento dal progetto usando i financials del progetto.",
      sourceFile: "src/components/atomic-crm/projects/QuickPaymentDialog.tsx",
      entryPoints: ["/#/projects/:id/show"],
      actsOn: ["projects", "payments"],
    },
    {
      id: "add_task_dialog",
      label: "Nuova attivita'",
      description: "Creazione rapida promemoria o follow-up cliente.",
      sourceFile: "src/components/atomic-crm/tasks/AddTask.tsx",
      entryPoints: ["/#/client_tasks"],
      actsOn: ["client_tasks"],
    },
    {
      id: "task_edit_dialog",
      label: "Modifica attivita'",
      description: "Aggiorna testo, data o stato di un promemoria.",
      sourceFile: "src/components/atomic-crm/tasks/TaskEdit.tsx",
      entryPoints: ["/#/client_tasks"],
      actsOn: ["client_tasks"],
    },
    {
      id: "tag_dialog",
      label: "Gestione tag",
      description: "Crea o modifica etichette cliente.",
      sourceFile: "src/components/atomic-crm/tags/TagDialog.tsx",
      entryPoints: ["/#/clients", "/#/settings"],
      actsOn: ["tags"],
    },
  ],
  actions: [
    {
      id: "open_unified_ai_launcher",
      label: "Apri chat AI unificata",
      description:
        "Apre la shell AI globale dal bottone flottante disponibile ovunque nel CRM; la conversazione chat piu recente resta visibile anche se il drawer viene chiuso e riaperto, mentre i workflow documentali restano separati e si resettano alla chiusura.",
      sourceFile: "src/components/atomic-crm/ai/UnifiedAiLauncher.tsx",
      actsOn: [],
      requiredFields: [],
    },
    {
      id: "read_unified_crm_context",
      label: "Leggi snapshot CRM unificata",
      description:
        "Carica nel launcher unificato un contesto read-only dei moduli core del CRM, includendo per i clienti recenti il profilo fiscale essenziale e i recapiti di fatturazione principali, per i referenti recenti recapiti e relazioni strutturate con clienti e progetti, e per i progetti attivi i referenti associati, sempre riusando registri semantici e capability senza cambiare pagina.",
      sourceFile: "src/components/atomic-crm/ai/UnifiedAiLauncher.tsx",
      actsOn: [
        "clients",
        "contacts",
        "project_contacts",
        "quotes",
        "projects",
        "payments",
        "expenses",
      ],
      requiredFields: [],
    },
    {
      id: "ask_unified_crm_question",
      label: "Chiedi al CRM nella chat unificata",
      description:
        "Invia una domanda sul CRM core usando la stessa snapshot mostrata nel launcher e restituisce una risposta grounded con possibili handoff verso route o azioni gia approvate e, in casi stretti, una bozza pagamento modificabile oppure corridoi deterministici verso `projects/:id/show` per puntate TV, `services/create` per servizi generici e `expenses/create` per spese collegate o trasferta km, senza scrivere direttamente nel CRM. Quando nel contesto esistono referenti e relazioni cliente/progetto, la risposta deve usarli come struttura primaria e non dedurli dalle note.",
      sourceFile: "src/components/atomic-crm/ai/UnifiedAiLauncher.tsx",
      actsOn: [
        "clients",
        "contacts",
        "project_contacts",
        "quotes",
        "projects",
        "payments",
        "expenses",
      ],
      requiredFields: [
        "question",
        "context.meta.generatedAt",
        "aiConfig.historicalAnalysisModel",
      ],
      sideEffects: ["invoke modello testuale read-only"],
    },
    {
      id: "prepare_payment_write_draft",
      label: "Prepara bozza pagamento nel launcher",
      description:
        "Propone nel launcher una bozza pagamento stretta, modificabile dall'utente e trasportabile solo verso superfici gia approvate senza scrivere direttamente nel CRM: `payments/create` per il caso quote-driven e `project quick payment` per il caso project-driven. Sul form pagamenti la superficie di arrivo deve preservare gli edit espliciti gia fatti nel launcher finche l'utente non sceglie un valore diverso e finche resta sullo stesso preventivo della bozza, segnalando esplicitamente quando quel contesto non vale piu. Sul quick payment di progetto la bozza puo portare importo, tipo e stato gia derivati dai financials del progetto attivo. Dopo il primo edit manuale dell'importo sul form pagamenti, il ricalcolo automatico non deve piu riprendersi il campo.",
      sourceFile: "src/components/atomic-crm/ai/UnifiedCrmAnswerPanel.tsx",
      actsOn: ["quotes", "projects", "payments"],
      requiredFields: [
        "answer.paymentDraft.originActionId",
        "answer.paymentDraft.clientId",
        "answer.paymentDraft.projectId",
        "answer.paymentDraft.paymentType",
        "answer.paymentDraft.amount",
        "answer.paymentDraft.status",
        "answer.paymentDraft.draftKind",
      ],
    },
    {
      id: "follow_unified_crm_handoff",
      label: "Segui handoff del launcher unificato",
      description:
        "Apre dal launcher una route o una superficie commerciale gia approvata del CRM suggerita dalla risposta AI, con una raccomandazione primaria deterministica quando il contesto lo permette e con i migliori prefills/search params gia supportati dalla superficie di arrivo, senza eseguire direttamente azioni di scrittura.",
      sourceFile: "src/components/atomic-crm/ai/UnifiedCrmAnswerPanel.tsx",
      actsOn: [
        "clients",
        "contacts",
        "quotes",
        "projects",
        "payments",
        "expenses",
      ],
      requiredFields: [
        "answer.suggestedActions[].href",
        "answer.suggestedActions[].capabilityActionId",
        "answer.suggestedActions[].recommended",
        "answer.suggestedActions[].recommendationReason",
      ],
    },
    {
      id: "expense_create_km",
      label: "Registra spesa km dalla chat unificata",
      description:
        "Dalla chat AI unificata apre `expenses/create` gia precompilato con tipo `spostamento_km`, data, chilometri, tariffa km e descrizione tratta derivati da un calcolo routing deterministico, lasciando comunque la correzione finale all'utente prima del salvataggio.",
      sourceFile: "src/components/atomic-crm/expenses/ExpenseCreate.tsx",
      actsOn: ["expenses"],
      requiredFields: [
        "expense_type",
        "expense_date",
        "km_distance",
        "km_rate",
        "description",
      ],
      sideEffects: ["precompila il form spese via search params supportati"],
    },
    {
      id: "expense_create",
      label: "Registra spesa generica dalla chat unificata",
      description:
        "Dalla chat AI unificata apre `expenses/create` gia precompilato con cliente, progetto se presente, data, tipo, importo e descrizione della spesa non km, lasciando comunque la conferma finale all'utente.",
      sourceFile: "src/components/atomic-crm/expenses/ExpenseCreate.tsx",
      actsOn: ["expenses", "clients", "projects"],
      requiredFields: ["client_id", "expense_date", "expense_type"],
      sideEffects: ["precompila il form spese via search params supportati"],
    },
    {
      id: "task_create",
      label: "Registra promemoria dalla chat unificata",
      description:
        "Dalla chat AI unificata apre il modulo Promemoria con handoff guidato per creare follow-up e scadenze operative sul cliente corretto.",
      sourceFile: "src/components/atomic-crm/tasks/TasksList.tsx",
      actsOn: ["client_tasks", "clients"],
      requiredFields: ["text", "due_date"],
      sideEffects: ["apre TaskCreateSheet dal modulo promemoria"],
    },
    {
      id: "service_create",
      label: "Registra servizio generico dalla chat unificata",
      description:
        "Dalla chat AI unificata apre `services/create` gia precompilato sul progetto corretto con descrizione (titolo breve del servizio), data, tipo servizio, chilometri, localita' e note emerse dalla richiesta, senza creare un workflow separato.",
      sourceFile: "src/components/atomic-crm/services/ServiceCreate.tsx",
      actsOn: ["services", "projects"],
      requiredFields: ["project_id", "service_date"],
      sideEffects: ["precompila il form servizi via search params supportati"],
    },
    {
      id: "generate_invoice_draft",
      label: "Genera bozza fattura interna",
      description:
        "Apre una superficie operativa gia approvata (servizio, progetto, cliente o preventivo) dove il bottone dedicato genera la bozza fattura PDF come riferimento interno per compilare Aruba, senza scritture DB.",
      sourceFile: "src/components/atomic-crm/invoicing/InvoiceDraftDialog.tsx",
      actsOn: ["services", "projects", "clients", "quotes"],
      requiredFields: ["client_id", "line_items"],
    },
    {
      id: "suggest_travel_locations",
      label: "Suggerisci luoghi nel calcolatore km",
      description:
        "Mentre l'utente scrive partenza o arrivo nel calcolatore tratta km, cerca lato server luoghi compatibili tramite openrouteservice e lascia la selezione finale all'utente prima del calcolo.",
      sourceFile: "src/components/atomic-crm/travel/TravelRouteCalculatorDialog.tsx",
      actsOn: ["services", "expenses", "projects"],
      requiredFields: ["query"],
      sideEffects: ["invoke openrouteservice geocoding via Edge Function"],
    },
    {
      id: "estimate_travel_route",
      label: "Calcola tratta km nelle UI operative",
      description:
        "Stima lato server una tratta km da partenza, arrivo e tipo percorso, riusando openrouteservice e la tariffa km corrente o predefinita, poi rimanda il risultato alle UI di spese, servizi e puntate rapide senza salvare nulla automaticamente.",
      sourceFile: "src/components/atomic-crm/travel/TravelRouteCalculatorDialog.tsx",
      actsOn: ["services", "expenses", "projects"],
      requiredFields: ["origin", "destination", "tripMode", "kmRate"],
      sideEffects: ["invoke openrouteservice via Edge Function"],
    },
    {
      id: "invoice_import_extract",
      label: "Analizza fatture nella chat AI",
      description:
        "Carica PDF, scansioni o foto nella chat AI unificata e genera una proposta strutturata orientata a payments o expenses, includendo quando leggibile anche l'anagrafica fiscale della controparte.",
      sourceFile: "src/components/atomic-crm/ai/UnifiedAiLauncher.tsx",
      actsOn: ["payments", "expenses", "clients", "projects"],
      requiredFields: ["files", "aiConfig.invoiceExtractionModel"],
      sideEffects: ["upload temporaneo file", "invoke Gemini", "pulizia upload temporanei"],
    },
    {
      id: "invoice_import_open_client_create",
      label: "Apri nuovo cliente da import fatture",
      description:
        "Dalla bozza import fatture apre il form clienti gia precompilato con denominazione, identificativi fiscali e indirizzo fatturazione letti dal documento, senza creare nulla automaticamente.",
      sourceFile: "src/components/atomic-crm/ai/InvoiceImportDraftEditor.tsx",
      actsOn: ["clients"],
      requiredFields: [
        "record.counterpartyName",
        "record.billingName",
        "record.vatNumber",
        "record.fiscalCode",
      ],
    },
    {
      id: "invoice_import_confirm",
      label: "Conferma import fatture nel CRM",
      description:
        "Conferma la proposta corretta in chat e crea record reali su payments o expenses solo dopo validazioni server-side, controllo duplicati stretti e salvataggio atomico del batch.",
      sourceFile: "src/components/atomic-crm/ai/UnifiedAiLauncher.tsx",
      actsOn: ["payments", "expenses", "clients", "projects"],
      requiredFields: ["draft.records", "conferma utente"],
      sideEffects: ["valida batch lato server", "crea record CRM", "rollback completo se un record fallisce"],
    },
    {
      id: "workflow_create",
      label: "Crea nuova automazione dalla chat AI",
      description:
        "Dalla chat AI unificata apre `workflows/create` precompilando trigger, evento, condizioni e azione in base al contesto della conversazione. L'AI deve prima verificare che non esista gia un'automazione equivalente tra le activeWorkflows della snapshot e deve precompilare i campi coerentemente con lo scopo che l'utente vuole ottenere.",
      sourceFile: "src/components/atomic-crm/workflows/WorkflowCreate.tsx",
      actsOn: ["workflows"],
      requiredFields: ["trigger_resource", "trigger_event", "action_type"],
      sideEffects: ["precompila il form automazione via search params"],
    },
    {
      id: "workflow_show",
      label: "Mostra dettaglio automazione esistente",
      description:
        "Dalla chat AI naviga alla pagina dettaglio di un'automazione gia esistente quando il contesto la richiede, ad esempio se l'utente chiede di un'automazione attiva sullo stesso trigger.",
      sourceFile: "src/components/atomic-crm/workflows/WorkflowShow.tsx",
      actsOn: ["workflows"],
      requiredFields: ["workflow_id"],
    },
    {
      id: "workflow_edit",
      label: "Modifica automazione esistente",
      description:
        "Dalla chat AI naviga alla pagina di modifica di un'automazione gia esistente per aggiornare trigger, condizioni o azioni.",
      sourceFile: "src/components/atomic-crm/workflows/WorkflowEdit.tsx",
      actsOn: ["workflows"],
      requiredFields: ["workflow_id"],
    },
    {
      id: "quote_drag_change_status",
      label: "Sposta preventivo tra stati",
      description:
        "Sposta un preventivo nella board e aggiorna stato+indice; non permette drag diretto verso rifiutato.",
      sourceFile: "src/components/atomic-crm/quotes/QuoteListContent.tsx",
      actsOn: ["quotes"],
      requiredFields: ["id", "status", "index"],
      sideEffects: ["riordino indici nella colonna sorgente/destinazione"],
    },
    {
      id: "quote_download_pdf",
      label: "Scarica PDF preventivo",
      description: "Genera il PDF del preventivo con branding e dati cliente.",
      sourceFile: "src/components/atomic-crm/quotes/QuoteShow.tsx",
      actsOn: ["quotes"],
      requiredFields: ["description", "amount", "client_id"],
    },
    {
      id: "quote_create_service",
      label: "Registra servizio dal preventivo",
      description:
        "Converte un preventivo accettato in servizio operativo con mapping tipo, date e fee pre-compilati.",
      sourceFile: "src/components/atomic-crm/quotes/CreateServiceFromQuoteDialog.tsx",
      actsOn: ["quotes", "services", "projects"],
      requiredFields: ["client_id", "status", "amount"],
      sideEffects: ["crea servizio", "opzionalmente crea progetto e collega quote.project_id"],
    },
    {
      id: "quote_pdf_preview",
      label: "Anteprima PDF preventivo realtime",
      description:
        "Mostra un'anteprima PDF live nel form Create/Edit che si aggiorna mentre l'utente compila i campi.",
      sourceFile: "src/components/atomic-crm/quotes/QuotePDFPreview.tsx",
      actsOn: ["quotes"],
      requiredFields: [],
    },
    {
      id: "quote_create_project",
      label: "Crea progetto dal preventivo",
      description:
        "Trasforma un preventivo in progetto quando il lavoro richiede struttura operativa.",
      sourceFile: "src/components/atomic-crm/quotes/CreateProjectFromQuoteDialog.tsx",
      actsOn: ["quotes", "projects"],
      requiredFields: ["client_id", "status"],
      sideEffects: ["collega quote.project_id"],
    },
    {
      id: "quote_create_payment",
      label: "Registra pagamento dal preventivo",
      description:
        "Apre il form pagamenti gia' precompilato dal preventivo e puo suggerire l'importo residuo ancora non collegato.",
      sourceFile: "src/components/atomic-crm/quotes/QuoteShow.tsx",
      actsOn: ["quotes", "payments"],
      requiredFields: ["client_id", "amount", "status"],
      sideEffects: ["precompila client_id, quote_id e project_id se presente"],
    },
    {
      id: "quote_send_status_email",
      label: "Invia mail cliente stato preventivo",
      description:
        "Apre una preview manuale e invia via Gmail SMTP la mail cliente coerente con lo stato corrente del preventivo.",
      sourceFile: "src/components/atomic-crm/quotes/SendQuoteStatusEmailDialog.tsx",
      actsOn: ["quotes", "clients", "payments", "services"],
      requiredFields: ["id", "status", "client_id"],
      sideEffects: ["invia mail cliente via Gmail SMTP"],
    },
    {
      id: "client_create_payment",
      label: "Registra pagamento dal cliente",
      description: "Percorso leggero per i casi senza progetto o preventivo strutturato.",
      sourceFile: "src/components/atomic-crm/clients/ClientShow.tsx",
      actsOn: ["clients", "payments"],
      requiredFields: ["client_id"],
      sideEffects: ["precompila client_id nel form pagamenti"],
    },
    {
      id: "project_quick_episode",
      label: "Registra puntata TV",
      description:
        "Crea un servizio e, se necessario, una spesa km o altre spese operative dal progetto TV con valori predefiniti.",
      sourceFile: "src/components/atomic-crm/projects/QuickEpisodeDialog.tsx",
      actsOn: ["projects", "services", "expenses"],
      requiredFields: ["project_id", "client_id", "service_date"],
      sideEffects: [
        "crea servizio",
        "crea spesa km se km_distance > 0",
        "crea spese extra se aggiunte nel dialog",
      ],
    },
    {
      id: "project_quick_payment",
      label: "Registra pagamento rapido dal progetto",
      description:
        "Crea un pagamento leggendo il saldo operativo dal progetto e puo aprirsi da handoff guidato con tipo pagamento gia selezionato o con una bozza stretta che porta anche importo e stato derivati dai financials del progetto.",
      sourceFile: "src/components/atomic-crm/projects/QuickPaymentDialog.tsx",
      actsOn: ["projects", "payments"],
      requiredFields: ["project_id", "client_id", "amount", "payment_type"],
    },
  ],
  communications: {
    quoteStatusEmails: {
      provider: "gmail_smtp",
      description:
        "Template mail cliente per cambi stato preventivo con layout condiviso e policy di invio per stato.",
      sharedBlocks: [
        "header brand",
        "summary card",
        "body sections",
        "optional CTA",
        "footer support",
      ],
      safetyRules: [
        "Se il flusso coinvolge servizi con is_taxable = false, l'invio automatico email deve restare sempre bloccato.",
      ],
      requiredEnvKeys: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"],
      templates: quoteStatusEmailTemplateDefinitions,
    },
    internalPriorityNotifications: {
      provider: "callmebot",
      description:
        "Canale notifiche interne ad alta priorita' per scadenze, blocchi o eventi che richiedono attenzione rapida.",
      useCases: [
        "scadenze urgenti",
        "anomalie operative critiche",
        "blocchi amministrativi o di incasso",
      ],
      requiredEnvKeys: ["CALLMEBOT_PHONE", "CALLMEBOT_APIKEY"],
      rules: [
        "Usare CallMeBot solo per notifiche interne, non per messaggi cliente.",
        "Usare il canale solo per eventi ad alta priorita' che richiedono attenzione rapida.",
      ],
    },
    fiscalDeadlineReminders: {
      provider: "pg_cron + Edge Function",
      description:
        "Sistema automatico di promemoria scadenze fiscali regime forfettario: calcola deadlines da pagamenti ricevuti e config fiscale, crea task e invia notifiche.",
      schedule: "ogni giorno alle 07:00 UTC",
      taskTypes: ["f24", "inps", "bollo", "dichiarazione"],
      rules: [
        "I task fiscali sono deduplicati per tipo+data — non vengono ricreati se gia esistenti.",
        "Le notifiche (email + WhatsApp) partono solo per scadenze entro 7 giorni.",
        "I task vengono creati per scadenze entro 30 giorni.",
        "Il primo anno di attivita non genera scadenze (nessun saldo/acconto precedente).",
      ],
    },
  },
  integrationChecklist: [
    {
      id: "resource-registration",
      label: "Registrare la nuova risorsa o pagina nei punti di ingresso",
      description:
        "Aggiorna CRM root, route, index del modulo e route hash usate negli smoke se la feature espone una nuova superficie.",
    },
    {
      id: "copy-and-i18n",
      label: "Aggiornare label, copy e i18n",
      description:
        "Ogni nuovo campo o azione deve avere un nome leggibile per utente e AI, non solo il nome tecnico del DB.",
    },
    {
      id: "semantic-registry",
      label: "Aggiornare il registry semantico",
      description:
        "Nuovi tipi, stati, categorie, date o formule vanno aggiunti a crmSemanticRegistry.",
    },
    {
      id: "capability-registry",
      label: "Aggiornare il registry delle capacita'",
      description:
        "Nuove pagine, modali, tool o azioni vanno dichiarati in crmCapabilityRegistry per restare conoscibili dall'AI.",
    },
    {
      id: "communications",
      label: "Aggiornare template mail o notifiche cliente quando la feature tocca stati cliente-facing",
      description:
        "Se la feature cambia stati o passaggi che il cliente deve conoscere, va aggiornato anche il layer comunicazioni.",
    },
    {
      id: "tests-and-smoke",
      label: "Aggiungere test e smoke realistici",
      description:
        "Ogni feature va chiusa con typecheck, test mirati e smoke reale se tocca percorsi business-critical.",
    },
    {
      id: "continuity-docs",
      label: "Aggiornare i docs di continuita' corretti",
      description:
        "I cambi strutturali devono sopravvivere ai reset di chat: aggiornare i documenti canonici/working pertinenti e usare progress/learnings solo come archivio storico quando serve davvero.",
    },
  ],
});
