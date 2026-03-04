# Architecture — Gestionale Rosario Furnari

## Overview

Fork di Atomic CRM personalizzato per gestire l'attività professionale
di fotografo, videomaker e web developer. Single-user, interfaccia italiana.

Stato del documento:

- `canonical`
- descrive la fotografia implementativa ad alto livello
- le vecchie "sessioni" citate nel file sono indizi storici, non la fonte
  primaria della verita' operativa se entrano in conflitto con codice o
  migration attuali

## Continuita'

Per riprendere correttamente il progetto in una nuova chat o sessione, i file
di riferimento minimi non sono solo questa architettura generale.

Leggere sempre anche:

- `docs/README.md`
- `docs/historical-analytics-handoff.md`
- `docs/development-continuity-map.md`
- `docs/historical-analytics-backlog.md`
- `docs/contacts-client-project-architecture.md`

Regola pratica:

- se una modifica introduce una nuova regola configurabile o cambia un default
  condiviso, va aggiornata anche `Impostazioni`
- se una modifica e' solo strutturale/read-only, `Impostazioni` non va toccata
  ma la motivazione va lasciata nei docs di continuita'

## Update 2026-03-04 (j) — Copy Answer Button in AI Chat Header

Aggiunto bottone copia (icona Copy) nell'header della chat AI, a sinistra del
bottone "Nuova". Copia l'intero `answerMarkdown` negli appunti con feedback
visivo (icona Check per 2 secondi). Visibile solo quando c'è una risposta.

## Update 2026-03-04 (i) — Rotating Suggestion Cards in AI Chat

L'empty state della chat AI ora mostra 8 card suggerimento divise per categoria
con rotazione sfalsata. Ogni 4 secondi 2 card (di categorie diverse) cambiano
domanda con un fade-in animato.

File nuovi:

- `src/lib/ai/suggestedQuestionCategories.ts` — 8 categorie × 3 domande (pool)
- `src/hooks/useRotatingSuggestions.ts` — hook di rotazione con coda shuffled
- `src/components/atomic-crm/ai/SuggestionCards.tsx` — componente presentazionale

Categorie: Panoramica, Clienti e referenti, Preventivi, Progetti e servizi,
Pagamenti e fatture, Spese e trasferte, Promemoria, Automazioni.

`unifiedCrmSuggestedQuestions` in `unifiedCrmAssistant.ts` ora derivato dal
pool categorizzato per backward compatibility. `UnifiedCrmAnswerPanel.tsx`
ridotto da 527 a 472 righe estraendo le suggestion cards.

## Update 2026-03-04 (h) — PaymentDraftCard aria-label

Aggiunto `aria-label` ai `<select>` di tipo e stato in `PaymentDraftCard.tsx`
per accessibilita'. Nessun cambiamento funzionale.

## Update 2026-03-04 (g) — Split unifiedCrmAnswer.ts (3110 → 6 files)

`supabase/functions/_shared/unifiedCrmAnswer.ts` (3110 righe) splittato per
concern reale in 5 moduli + barrel re-export:

| File | Righe | Concern |
|---|---|---|
| `unifiedCrmAnswerTypes.ts` | 122 | Types + constant |
| `unifiedCrmAnswerUtils.ts` | 220 | Utility pure condivise |
| `unifiedCrmAnswerIntents.ts` | 731 | Intent detection, entity matching, inference |
| `unifiedCrmAnswerCreateFlows.ts` | 824 | Travel/episode/service/expense flows |
| `unifiedCrmAnswerSuggestions.ts` | 1373 | Suggestion engine + payment draft + validation |
| `unifiedCrmAnswer.ts` | 41 | Barrel re-export |

Dipendenze: `Types ← Utils ← Intents ← CreateFlows / Suggestions` (nessun ciclo).

Il barrel mantiene tutti gli import dei consumer (`unified_crm_answer/index.ts`
e `unifiedCrmAnswer.test.ts`) invariati. Nessun cambiamento funzionale.

## Update 2026-03-04 (f) — Type Safety Cleanup in unifiedCrmAnswer

Fix errori di tipo pre-esistenti in `unifiedCrmAnswer.ts`:
- `DraftPaymentType` alias + return type annotations per `inferPreferredPaymentType`,
  `inferQuoteDraftPaymentType`, `inferProjectDraftPaymentType`
- Estrazione `buildShowHref` in variabili locali nel branch `focusContacts`
  (stesso pattern applicato a `focusWorkflows` nel commit precedente)

Nessun cambiamento funzionale — solo type safety.

## Update 2026-03-04 (e) — AI Semantic Audit & Fiscal Deadline Awareness

### Correzioni

Audit completo della coerenza semantica AI dopo l'aggiunta di workflow automations
e fiscal deadline reminders. Gap trovati e corretti:

1. **Backend type union** (`unifiedCrmAnswer.ts`): aggiunto `"workflows"` alla
   resource union e `"workflow_create"`, `"workflow_show"` alla capabilityActionId
   union — prima il codice emetteva valori non dichiarati nel tipo
2. **Fiscal deadline AI awareness**: aggiunta regola `fiscalDeadlineReminders` alla
   semantic registry, `fiscalDeadlineReminders` al capability registry communications,
   intent detection per keywords fiscali (F24, INPS, scadenze, contributi, ecc.)
   nel rule engine, branch routing dedicato, istruzioni nel system prompt AI
3. **workflow_edit**: aggiunta action nel capability registry
4. **expenseTypes**: aggiunto dizionario mancante alla semantic registry
5. **client_tasks.due_date**: aggiunto campo date mancante alla semantic registry

### Invarianti

- Il tipo `UnifiedCrmSuggestedAction` in `unifiedCrmAnswer.ts` deve restare
  allineato con il corrispondente tipo in `unifiedCrmAssistant.ts` (frontend)
- Ogni nuovo intent nel rule engine deve avere un'esclusione nel `genericSummary`
- Ogni nuova feature backend automatica deve essere documentata sia nella semantic
  registry (regola) sia nel capability registry (communications)

## Update 2026-03-04 (d) — Fiscal Deadline Automated Reminders

### Architettura

Check giornaliero schedulato via `pg_cron` + `pg_net` che invoca la Edge Function
`fiscal_deadline_check`. La funzione:

1. Legge la fiscal config dalla tabella `configuration` (JSONB)
2. Legge i pagamenti ricevuti nell'anno per calcolare il fatturato YTD
3. Calcola le scadenze fiscali (stessa logica del client-side `fiscalDeadlines.ts`)
4. Crea `client_tasks` per le scadenze entro 30 giorni (con deduplicazione)
5. Manda notifica email + WhatsApp per le scadenze entro 7 giorni

### File coinvolti

- `supabase/functions/_shared/fiscalDeadlineCalculation.ts` — calcolo scadenze (port Deno)
- `supabase/functions/fiscal_deadline_check/index.ts` — Edge Function principale
- `supabase/migrations/20260304184909_fiscal_deadline_cron.sql` — pg_cron + pg_net + schedule
- `supabase/seed.sql` — Vault secrets per ambiente locale

### Dipendenze

- Estensioni: `pg_cron`, `pg_net`, Vault (gia' disponibile in Supabase hosted)
- Secrets in Vault: `project_url`, `service_role_key` (per invocare la Edge Function)
- `internalNotifications.ts` riusato per email + WhatsApp best-effort

### Scadenze coperte (regime forfettario)

- **30 giugno**: Saldo + 1° Acconto (F24 + INPS) — high priority
- **30 novembre**: 2° Acconto (F24 + INPS) — high priority
- **31 maggio, 30 settembre, 30 novembre, 28 febbraio**: Bollo trimestrale — low priority
- **31 ottobre**: Dichiarazione dei redditi — low priority

## Update 2026-03-04 (c) — Realtime, Payment Reminders, Internal Notifications

### Supabase Realtime

Hook `useRealtimeInvalidation` sottoscrive `postgres_changes` su tabelle
specifiche e invalida la cache React Query corrispondente.

Integrato in:

- `DashboardAnnual`: payments, services, projects, quotes, expenses, clients, client_tasks
- `DashboardHistorical`: payments, services, projects, clients, analytics views + custom query key `historical-cash-inflow-context`

File: `src/hooks/useRealtimeInvalidation.ts`

### Payment Reminder Email (con review)

Flusso:

1. Dashboard deadline tracker mostra pulsante "Reminder" per pagamenti scaduti
2. Click apre `SendPaymentReminderDialog` con anteprima email
3. Utente rivede, aggiunge messaggio opzionale, conferma
4. Edge Function `payment_reminder_send` invia email al cliente via SMTP
5. Dopo invio, `notifyOwner()` invia conferma al proprietario via email + WhatsApp

File principali:

- `src/lib/communications/paymentReminderEmail.ts` — template builder
- `src/lib/communications/paymentReminderEmailTypes.ts` — tipi
- `src/components/atomic-crm/payments/SendPaymentReminderDialog.tsx` — dialog review
- `supabase/functions/payment_reminder_send/index.ts` — Edge Function
- `supabase/functions/_shared/paymentReminderSend.ts` — validazione payload

### Internal Notifications (Email + WhatsApp CallMeBot)

Modulo shared `supabase/functions/_shared/internalNotifications.ts`:

- `sendInternalEmail(subject, text)` — SMTP verso `SMTP_USER` (owner)
- `sendWhatsApp(message)` — GET a `api.callmebot.com/whatsapp.php`
- `notifyOwner(subject, message)` — chiama entrambi, best-effort

Env vars: `CALLMEBOT_PHONE`, `CALLMEBOT_APIKEY` (gia' in `.env`)

Usato da `payment_reminder_send`, riusabile per future automazioni.

## Update 2026-03-04 (b) — Kanban, Workflow

### Kanban Project View

La lista progetti ora supporta toggle lista/kanban (solo desktop).
Il Kanban mostra 4 colonne per stato: in_corso, in_pausa, completato,
cancellato. Drag-and-drop nativo HTML5 cambia lo stato del progetto.

File: `src/components/atomic-crm/projects/ProjectKanbanView.tsx`

### Workflow Automation

Nuovo modulo `workflows` registrato nel module registry.

DB:

- tabella `workflows` (trigger_resource, trigger_event, trigger_conditions JSONB, actions JSONB)
- tabella `workflow_executions` (log esecuzione per debug)
- 3 workflow pre-seeded (preventivo accettato, progetto avviato, pagamento ricevuto)

Engine client-side:

- `workflowEngine.ts`: intercetta afterCreate/afterUpdate via lifecycle callbacks
- anti-loop: flag `_executing` impedisce trigger ricorsivi
- azioni supportate: `create_task`, `create_project`, `update_field`, `send_email`, `send_notification`
- `send_email`: invia email a destinatario (client_email o custom) via Edge Function `workflow_notify`
- `send_notification`: notifica interna al proprietario (email + WhatsApp CallMeBot) via `workflow_notify`
- template con placeholder: `{nome_cliente}`, `{risorsa}`, `{stato}`, `{importo}`, `{data}` — risolti server-side
- logging automatico in `workflow_executions`

Edge Function: `supabase/functions/workflow_notify/index.ts`

- riceve `channel` (`email_external` | `notify_owner`), `trigger_resource`, `trigger_record_id`
- risolve placeholder dal record e dal client via `supabaseAdmin`
- dispatch a SMTP (email esterna) o `notifyOwner()` (dual-channel interno)
- shared: `workflowNotifyTypes.ts`, `workflowTemplatePlaceholders.ts`

UI: List, Create, Edit, Show con execution history.
List ha mobile card view (niente tabelle su telefono).
Show ha griglia responsive e pre-block con overflow.
Navigazione: menu "Altro" mobile, non nella header desktop.
WorkflowCreate supporta precompilazione via search params (name, trigger_resource, trigger_event, action_type, etc.).

Integrazione AI Chat:

- Le automazioni attive sono incluse nella snapshot `UnifiedCrmReadContext` come `activeWorkflows`
- Il modulo `workflows` e' registrato nel module registry con metadati AI
- Il capability registry dichiara `workflow_create` e `workflow_show` come azioni approvate
- Il semantic registry include la regola `workflowAutomations`
- Le istruzioni AI nell'Edge Function guidano l'LLM a verificare se un'automazione equivalente esiste gia prima di suggerirne una nuova
- Il rule engine aggiunge handoff strutturati quando l'intent riguarda automazioni

## Update 2026-03-04

### Module Registry come fonte unica dei moduli CRM

La registrazione dei moduli e' ora centralizzata in:

- `src/components/atomic-crm/root/moduleRegistry.ts`

Il registry governa:

- resource name, route, componenti CRUD/mobile
- visibilita' e ordine nav desktop/mobile
- visibilita' nel menu create mobile (`navigate` vs `sheet`)
- identita' AI della risorsa
- badge opzionali per la navigazione (es. pagamenti scaduti)
- moduli headless abilitabili/disabilitabili senza rimuovere codice

Desktop header, mobile bottom bar, menu "Altro", create menu e `CRM.tsx`
leggono ora la stessa definizione, senza liste hardcoded duplicate.

### Modulo headless invoicing

Il modulo cross-cutting `invoicing` e' registrato come headless con identita'
AI esplicita. Non espone Resource page, ma rende conoscibile al layer AI il
flusso "bozza fattura interna" da servizio/progetto/cliente/preventivo.

### Scadenzario operativo e read-context AI

La dashboard annuale include una card `DashboardDeadlineTracker` con:

- pagamenti scaduti
- pagamenti in scadenza (7 giorni)
- promemoria in scadenza (7 giorni)

Il read-context AI (`buildUnifiedCrmReadContext`) include ora anche:

- `overduePayments`
- `upcomingTasks`
- `overdueTasks`
- `pendingPayments[].isTaxable` derivato semanticamente

### Tassabilita' coerente

Aggiornamenti principali:

- migration `quotes.is_taxable` (`BOOLEAN NOT NULL DEFAULT true`)
- default automatico `is_taxable` su servizi e preventivi guidato da
  `fiscalConfig.taxabilityDefaults`
- tassabilita' pagamento derivata via config (`taxabilityDefaults`)
- modello fiscale basato su principio di CASSA (incassi ricevuti nell'anno),
  non su competenza (servizi erogati). La base imponibile forfettaria e' la
  somma dei pagamenti con `status='ricevuto'` e `payment_date` nell'anno,
  mappati a categorie ATECO tramite il progetto collegato. Supporta flat
  payments senza progetto (fallback al primo profilo ATECO configurato).
- metriche operative (margini, DSO, concentrazione clienti) restano basate
  sui servizi (competenza) per coerenza con la salute business
- KPI fiscali estesi:
  - `fatturatoTotaleYtd` (incassato totale)
  - `fatturatoNonTassabileYtd` (incassato non tassabile)

### Bozza fattura interna (no write DB)

Scopo operativo: rispondere alla domanda "quanto mi deve ancora questo
cliente/progetto/preventivo?" e generare un PDF di supporto da inviare alla
controparte come simulazione fattura. Non e' una fattura reale.

Modulo condiviso in `src/components/atomic-crm/invoicing/`:

- builders puri da service/project/client/quote
- dialog unico `InvoiceDraftDialog`
- generazione PDF con watermark "BOZZA - NON VALIDA AI FINI FISCALI"
- nessuna scrittura DB: output solo di supporto operativo per compilazione
  Aruba

Semantica di calcolo dei builders:

- ogni builder somma il valore netto dei servizi non ancora fatturati
  (esclusi quelli con `invoice_ref` valorizzato)
- i km reimbursement vengono aggregati come voce separata; il calcolo usa
  `calculateKmReimbursement()` che applica `defaultKmRate` dalla config quando
  il servizio ha `km_rate` NULL — ogni Show page e `ClientFinancialSummary`
  leggono `operationalConfig.defaultKmRate` da `useConfigurationContext()` e lo
  passano esplicitamente ai builder; **non usare** `km_distance * km_rate`
  inline (bug storico: NULL → 0)
- vengono sottratti **solo** i pagamenti con `status === "ricevuto"` — i
  pagamenti `in_attesa` o `scaduto` non riducono il dovuto
- i rimborsi (`payment_type === "rimborso"`) hanno segno invertito nella
  deduzione
- se il totale esigibile e' <= 0, il builder restituisce `lineItems: []`
  (nessun importo da richiedere)

Tipo condiviso: `DraftPayment = Pick<Payment, "amount" | "payment_type" |
"status">`

Helper unificato: `hasInvoiceDraftCollectableAmount(draft)` — usato da tutte
le pagine Show per decidere se mostrare il pulsante "Genera bozza fattura".
Un draft non-null con `lineItems: []` non mostra il pulsante.

Entry point UI:

- `ServiceShow` — draft singolo servizio (escluso se gia' fatturato)
- `ProjectShow` — aggrega servizi progetto non fatturati + km + deduce
  pagamenti ricevuti del progetto
- `ClientShow` — aggrega tutti i servizi non fatturati del cliente + km +
  deduce tutti i pagamenti ricevuti del cliente
- `QuoteShow` — usa le voci del preventivo (`quote_items`) + deduce
  pagamenti ricevuti collegati al preventivo

Ogni Show page carica i pagamenti collegati tramite `useGetList<Payment>` con
il filtro appropriato (`client_id@eq`, `project_id@eq`, `quote_id@eq`).

### Test strategy aggiornata

Guardrail test ampliati con:

- test unitari per i 4 builder invoice draft, inclusi:
  - filtro `status === "ricevuto"` (non deduce `in_attesa`/`scaduto`)
  - inversione segno rimborsi
  - copertura completa → `lineItems: []`
  - esclusione servizi gia' fatturati (`invoice_ref`)
- test unitari helper scadenzario (ordinamento/filtro pagamenti/task)
- estensioni a test di semantica, fiscal model, configuration merge e
  read-context AI per i nuovi invarianti di tassabilita'/scadenze

### Fix coerenza dashboard e AI (post module-registry)

Calcoli dashboard corretti:

- **DSO inclusivo flat services**: pagamenti senza `project_id` ora usano la
  data del servizio flat piu' vecchio del cliente come riferimento
  (`clientEarliestFlatService` in `fiscalModel.ts`)
- **Margini inclusivi spese generali**: spese senza `project_id` ora rientrano
  nella categoria `"__general"` (Spese generali) invece di essere ignorate
- **Revenue operativo inclusivo flat services**: servizi senza `project_id` ora
  rientrano nella categoria `"__flat"` (Servizi diretti) nel dashboard annuale
  e nel conteggio `topClientRevenue`
- **KPI labels chiariti**: "netto sconti, non incassi" → "tutto il lavoro
  svolto" nel dashboard operativo; label fiscali chiarite con "(solo tassabile)"

AI read-context esteso:

- `clientFinancials`: aggregato per cliente con totalFees, totalPaid,
  balanceDue, hasUninvoicedServices — permette alla chat di rispondere a
  "quanto mi deve Diego?" con importi reali
- tutti i limiti di slicing rimossi: clienti, contatti, preventivi, progetti,
  pagamenti, task, spese e servizi flat sono esposti senza cap numerico
- `clientLevelServices` senza limite (era slice 10)

AI intent parsing e handoff:

- `hasInvoiceDraftIntent` ammorbidito: "fattura per Diego" ora funziona senza
  verbo d'azione esplicito grazie a pattern direzionali (per/di/del/della...)
- handoff fattura context-aware: usa `pickClientFromQuestion` e
  `pickProjectFromQuestion` per trovare l'entita' menzionata dall'utente
- suggestedActions fattura multi-opzione: mostra tutte le superfici disponibili
  (preventivo, progetto, cliente) come scelte separate
- system prompt aggiornato: stile conciso (elenchi puntati, dritto al punto),
  istruzioni `clientFinancials`, formato Risposta/Dettaglio/Note

## Current Direction

Il dominio locale e' gestito con una migration snapshot statica:

- `supabase/migrations/20260302170000_domain_data_snapshot.sql`

Dal 2026-03-04 la snapshot contiene solo TRUNCATE + INSERT dei settings di
configurazione (6 record: km_rate, currency, fee defaults). Nessun dato di
dominio (clienti, progetti, servizi, ecc.) viene pre-caricato.

I dati storici (2023-2025) sono archiviati nella cartella `Fatture/` e non
servono piu' nel database locale. Il database locale serve ora come ambiente
pulito per verificare che i flussi e i calcoli funzionino correttamente
inserendo dati dall'interfaccia CRM.

Regole operative:

- `npx supabase db reset` + `npm run local:admin:bootstrap` ripristina
  un database vuoto con solo config e admin, pronto per inserimento dati
- quando servono dati di test strutturati, crearli dall'UI o con migration
  dedicate
- non reintrodurre script dinamici di rebuild come seconda fonte di verita'
- fixture hardcoded di dominio usate per smoke o E2E non sono una base
  architetturale accettabile

## Current Financial Semantics Warning

Il punto piu' fragile dell'architettura corrente e' la semantica finanziaria.

Oggi `payments` ed `expenses` coprono ancora, in modo parziale e sovrapposto:

- documento emesso/ricevuto
- stato da incassare/pagare
- movimento di cassa effettivo
- in alcuni casi anche allocazione progetto

La direzione architetturale da mantenere esplicita e' separare meglio:

- documenti fiscali
- posizione aperta da incassare/pagare
- movimenti di cassa
- riconciliazioni/allocazioni

Stato attuale della separazione:

- la foundation DB ora esiste in:
  - `financial_documents`
  - `financial_document_project_allocations`
  - `cash_movements`
  - `financial_document_cash_allocations`
  - `financial_documents_summary`
- la foundation DB (tabelle, vincoli, viste) e' pronta; i dati vanno inseriti
  dall'interfaccia CRM o con migration dedicate
- `financial_documents` ora distingue anche le note di credito:
  - `customer_credit_note`
  - `supplier_credit_note`
- `financial_documents` conserva anche i campi fiscali XML necessari alla
  riconciliazione:
  - `xml_document_code`
  - `taxable_amount`
  - `tax_amount`
  - `stamp_amount`
- nel 2025 reale esiste già un caso importante:
  - `FPA 1/25` fattura
  - `FPA 2/25` `TD04` collegata a `FPA 1/25`
  - `FPA 3/25` riemissione valida
- la foundation documentale ora distingue:
  - documento fiscale
  - tipo documento (`invoice` / `credit_note`)
  - importi fiscali lordi e imponibili
  - aperti da incassare/pagare sul documento
- semantica di progetto da mantenere:
  - lo stato incasso operativo resta quello di `payments.status`
  - `payment_type` resta parte del modello operativo dei pagamenti
- `payments` ed `expenses` restano però ancora il layer compatibilità letto da
  gran parte di UI, analytics, import e AI
- il primo consumer già riallineato è `project_financials`:
  - se il progetto ha documenti nella foundation, il pagato usa
    `financial_document_cash_allocations`
  - se il progetto ha documenti ma ancora nessuna cassa allocata, la base
    semantica è `financial_documents`
  - il fallback a `payments` legacy resta solo per progetti non ancora coperti
    dalla foundation
- il prossimo lavoro corretto è migrare progressivamente i consumer verso la
  foundation nuova senza perdere il comportamento attuale

Finche' questa separazione non viene introdotta, ogni modifica a import
documenti, pagamenti, spese, dashboard, analytics e AI va considerata ad alta
fragilita' semantica.

## Stato Infrastruttura (snapshot operativa aggiornata)

### Certezze — Audit superato

| Componente | Stato | Verificato |
|------------|-------|------------|
| Schema DB custom + referenti CRM + analytics views | Deployed e conforme | migration review |
| Migration Fase 2 (discount + tariffe) | Applicata al DB remoto | `npx supabase db push` |
| Migration quotes index | Applicata al DB remoto | sessione 9 |
| Migration client_tasks + client_notes + tags | Applicata al DB remoto | sessione 11 |
| Import dati Diego Caltabiano (84 + 40 km + 3 split) | Applicata al DB remoto | sessione 12 |
| Riallocazione pagamenti Diego (DELETE 10 + CREATE 11) | Applicata al DB remoto | sessione 13 |
| Fix view project_financials (Cartesian product) | Applicata al DB remoto | sessione 12 |
| Filtri progetto su Pagamenti/Spese | Implementati | sessione 12 |
| Ricerca progetto (ilike) | Fix `q` → `name@ilike` | sessione 13 |
| Bilanci verificati: tutti i progetti Diego a 0 o pending | Confermato | sessione 13 |
| Riepilogo finanziario su ClientShow/ProjectShow | Implementato | sessione 12 |
| Dashboard Fase 2 (Recharts) | Implementata (desktop + mobile KPI) | sessione 10 |
| Pulizia moduli Atomic CRM | Completata in modo selettivo: `companies` e `deals` rimossi, `contacts` riattivato come dominio referenti | 2026-03-01 |
| Referenti CRM (`contacts` + `project_contacts`) | Implementati e integrati con clienti, progetti e chat AI | 2026-03-01 |
| Tasks adattati (Promemoria) | Funzionanti con client_tasks | sessione 11 |
| Notes clienti | Funzionanti con client_notes | sessione 11 |
| Tags clienti | Funzionanti (BIGINT[] su clients) | sessione 11 |
| RLS policies | Attive su tutte le tabelle | audit manuale |
| Signup pubblico libero | Non supportato; le route tecniche di bootstrap/recovery restano nel router, ma nel runtime Supabase single-user corrente il flusso normale resta login-only | 2026-03-01 |
| Keep-alive workflow | Attivo, testato con successo (HTTP 200) | `gh workflow run` |
| Localizzazione IT | Completa su ~70+ file, 3 livelli | audit sessione 4 |
| DateTime Range Support (all_day pattern) | Implementato su 4 moduli | sessione 16 |
| Simulatore Fiscale + KPI Salute Aziendale | Implementato | sessione 17 |
| Mobile UX (card lists, Sheet filters, MobileBackButton) | Tutti i moduli CRUD | sessione 77 |
| Login/Signup branding (foto utente, maschera circolare) | Implementato | sessione 77 |
| Auth init bypass (single-user hardcoded) | Implementato | sessione 77 |
| Navigazione per anno Dashboard | Implementata | sessione 18 |
| Colori semantici Dashboard (success/warning badge + progress) | Implementati | sessione 18 |
| Typecheck | Guardrail operativo, da rieseguire sulle modifiche rilevanti | workflow locale |
| Build produzione (`npm run build`) | Verifica disponibile, da rieseguire prima di release significative | workflow locale |
| Test | Suite presente + test mirati per slice | vitest |
| Lint | Guardrail operativo via ESLint + pre-commit | workflow locale |
| Deploy Vercel | gestionale-rosario.vercel.app | sessione 5 |
| Supabase locale | Supportato su porte isolate `5532x`; il bootstrap da zero deve restare replayable con `npx supabase start` | 2026-03-01 |
| Financial semantics foundation | Tabelle `financial_documents`, `cash_movements` e allocazioni pronte (schema + viste). `project_financials` usa `financial_foundation` come base primaria. La snapshot locale e' stata svuotata il 2026-03-04 per debug dei flussi; i dati storici restano in `Fatture/`. | 2026-03-04 |
| Admin locale post-reset | Automatizzato via script bootstrap idempotente dopo `make start` / `npx supabase db reset` | 2026-03-01 |
| Smoke E2E locale | Supportato via Playwright sul runtime reale locale, ma deve restare subordinato al rebuild del dominio da fonti reali | 2026-03-02 |
| Auth email/password locale | Abilitato solo nel runtime locale per bootstrap admin e smoke browser; non riflette automaticamente il remoto | 2026-03-01 |
| Rebuild locale del dominio | **Snapshot vuota** dal 2026-03-04: `npx supabase db reset` + `npm run local:admin:bootstrap` ripristinano un DB con solo settings e admin. I dati di dominio vanno inseriti dall'UI per debug e verifica flussi. Dati storici archiviati in `Fatture/`. | 2026-03-04 |

### Cose ancora da verificare manualmente

- Signup disabilitato nel **Supabase Dashboard remoto** (non solo config.toml locale)
- npm audit: 4 vulnerabilità (1 moderate, 3 high) — da valutare
- Il ramo `postmark` non fa parte del runtime/config attivo: le comunicazioni
  supportate oggi restano `Gmail` outbound cliente e `CallMeBot` per alert
  interni prioritari
- 3 errori lint pre-esistenti (useGetOne condizionale in ExpenseShow/PaymentShow)

## Database Schema

### Tabelle custom (da specifica)

Nota di continuita':

- lo schema corrente e' ancora quello operativo
- non e' ancora il modello finale desiderato per la semantica finanziaria
- `payments` ed `expenses` vanno considerati contenitori ancora troppo
  sovraccarichi finche' non verra' introdotta una separazione piu esplicita tra
  documenti, aperti e cassa

| Tabella | Scopo | RLS | Colonne |
|---------|-------|-----|---------|
| clients | Anagrafica clienti + profilo fiscale/fatturazione | auth.uid() IS NOT NULL | nome operativo, `billing_name`, contatti base, `P.IVA` / `CF`, indirizzo fiscale, `SDI` / `PEC`, note, tags, timestamps |
| contacts | Referenti / persone collegate ai clienti | auth.uid() IS NOT NULL | nome/cognome, `contact_role` strutturato, `title` libero, `is_primary_for_client`, email/telefoni JSONB, background, tags, FK `client_id`, timestamps |
| project_contacts | Join referenti-progetti | auth.uid() IS NOT NULL | FK `project_id`, FK `contact_id`, `is_primary` con unicita' per progetto, timestamps |
| projects | Progetti/programmi | auth.uid() IS NOT NULL | cliente, categoria, `tv_show`, stato, range date, budget, note, timestamps |
| services | Registro lavori (cuore) | auth.uid() IS NOT NULL | FK progetto, date/range, tipo servizio, tassabilita', fee, km, `invoice_ref`, note, `updated_at` |
| quotes | Preventivi + pipeline Kanban | auth.uid() IS NOT NULL | cliente/progetto, tipo servizio, range evento, importo, stato, `quote_items`, note |
| workflows | Automazioni trigger-based | auth.uid() IS NOT NULL | nome, trigger (resource/event/conditions JSONB), actions JSONB, is_active, timestamps |
| workflow_executions | Log esecuzioni workflow | auth.uid() IS NOT NULL | FK workflow, trigger info, status, result JSONB, error, timestamp |
| payments | Tracking pagamenti | auth.uid() IS NOT NULL | cliente/progetto/preventivo, data, tipo, importo, metodo, `invoice_ref`, stato, note |
| expenses | Spese e km | auth.uid() IS NOT NULL | cliente/progetto, data, tipo spesa (`spostamento_km`, `acquisto_materiale`, `noleggio`, `altro`, `credito_ricevuto`), km/importo, markup, descrizione, `invoice_ref` |
| client_tasks | Promemoria (opzionalmente legati a un cliente) | auth.uid() IS NOT NULL | testo, tipo, data scadenza, `all_day`, completamento, FK cliente opzionale |
| client_notes | Note clienti (con allegati) | auth.uid() IS NOT NULL | FK cliente obbligatoria, testo, data, allegati, timestamps |
| settings | Configurazione | auth.uid() IS NOT NULL | record `config` persistito per branding, tipi, AI, fiscale, operativita' |
| sales | Profilo utente e supporto auth single-user | auth.uid() IS NOT NULL | identita' utente, avatar, admin/disabled, FK `auth.users` |
| tags | Catalogo etichette riusato dai clienti e disponibile anche nel modello dati dei referenti | auth.uid() IS NOT NULL | nome, colore |
| keep_alive | Heartbeat free tier | SELECT public | ping e timestamp |

### Quotes — 10 stati pipeline

```
primo_contatto → preventivo_inviato → in_trattativa → accettato →
acconto_ricevuto → in_lavorazione → completato → saldato → rifiutato / perso
```

### Settings (struttura attiva)
- `title`
- `lightModeLogo`
- `darkModeLogo`
- `taskTypes`
- `noteStatuses`
- `quoteServiceTypes`
- `serviceTypeChoices`
- `operationalConfig.defaultKmRate`
- `fiscalConfig.taxProfiles`
- `fiscalConfig.aliquotaINPS`
- `fiscalConfig.tettoFatturato`
- `fiscalConfig.annoInizioAttivita`
- `aiConfig.historicalAnalysisModel`: modello condiviso per Storico, Annuale e
  chat AI unificata read-only
- `aiConfig.invoiceExtractionModel`: modello dedicato all'import documenti
- `businessProfile.*`: dati emittente (nome, P.IVA, CF, indirizzo, email,
  telefono, tagline) usati nei PDF di preventivi e bozze fattura interna;
  editabili da Settings > Profilo Aziendale
- `googleWorkplaceDomain`: dominio Google Workspace per SSO (opzionale);
  editabile da Settings > Autenticazione; se non impostato, il login SSO
  non viene mostrato
- `disableEmailPasswordAuthentication`: disabilita login email/password
  (default false); utile quando si usa solo SSO aziendale

### Views

| View | Scopo |
|------|-------|
| project_financials | Riepilogo finanziario per progetto (fees - discount, km, paid, balance) con preferenza per foundation documenti/cassa e fallback legacy solo dove la copertura non e' ancora completa |
| monthly_revenue | Fatturato mensile per categoria (fees - discount) |
| analytics_* | Base storica/AI per Storico e consumer analytics (`analytics_business_clock`, `analytics_history_meta`, `analytics_yearly_competence_revenue`, `analytics_yearly_competence_revenue_by_category`, `analytics_client_lifetime_competence_revenue`, `analytics_yearly_cash_inflow`) |

PK esplicite nel dataProvider:
- `monthly_revenue` → PK composita `month + category`
- `project_financials` → PK `project_id`

### Struttura modulare del dataProvider Supabase

Il provider Supabase e' organizzato in moduli feature nel path
`src/components/atomic-crm/providers/supabase/`:

| File | Responsabilita' |
|------|-----------------|
| `dataProvider.ts` | Orchestratore: setup, env, auth/sales/config, assembly moduli, lifecycle callbacks |
| `dataProviderAnalytics.ts` | 9 metodi analytics (summary, answer, context getters) |
| `dataProviderAnalyticsContext.ts` | 3 context builder per storico, cash inflow, annuale |
| `dataProviderAi.ts` | CRM read context, semantic registry, domanda unificata |
| `dataProviderInvoiceImport.ts` | Workspace, upload file, genera/conferma draft import |
| `dataProviderCommunications.ts` | Email context preventivo, invio email |
| `dataProviderTravel.ts` | Stima tratta, suggerisci luoghi |
| `dataProviderTypes.ts` | Tipi condivisi: InvokeEdgeFunction, BaseProvider, LARGE_PAGE |
| `storageBucket.ts` | Upload attachments, logo config, file import fatture |
| `edgeFunctionError.ts` | Helper estrazione errore da Edge Function |

Ogni modulo feature esporta una factory `buildXxxProviderMethods(deps)` che
riceve le dipendenze condivise (baseDataProvider, invokeEdgeFunction, config
getters). L'orchestratore assembla tutto con object spread e il tipo
`CrmDataProvider` resta invariato per i consumer.

Semantica operativa attuale di `project_financials`:

- `payment_semantics_basis = financial_foundation`
  - il progetto ha documenti nella foundation e almeno una cassa allocata
- `payment_semantics_basis = financial_documents`
  - il progetto ha documenti foundation ma nessuna cassa allocata
- `payment_semantics_basis = legacy_payments`
  - il progetto non e' ancora coperto dai documenti foundation e il pagato
    arriva solo dal layer storico `payments`
- `payment_semantics_basis = none`
  - nessuna base di pagamento disponibile

### Migrations

| Migration | Scopo |
|-----------|-------|
| `20260225180000_gestionale_schema.sql` | Schema iniziale (8 tabelle, RLS, views, dati iniziali) |
| `20260225230028_fase2_discount_tariffe.sql` | Colonna discount, tariffe aggiornate, views fix |
| `20260226120000_add_quotes_index.sql` | Colonna index su quotes per ordinamento Kanban |
| `20260226200000_client_tasks_notes_tags.sql` | Tabelle client_tasks, client_notes, colonna tags su clients |
| `20260227100000_import_diego_caltabiano.sql` | Import dati reali: 1 client + 9 projects + 64 services + 7 payments + 3 expenses |
| `20260227110000_import_diego_km_expenses.sql` | 40 spese spostamento_km (una per servizio con km > 0) |
| `20260227120000_import_diego_pending_payment.sql` | Pagamento pendente iniziale €7,152.10 |
| `20260227130000_import_diego_split_payments.sql` | Split pagamento pendente per progetto + assign project_id |
| `20260227140000_fix_project_financials_view.sql` | Fix prodotto cartesiano nella view (subquery pre-aggregation) |
| `20260227150000_assign_invoice_refs.sql` | Assegna invoice_ref (FPR) ai pagamenti ricevuti |
| `20260227160000_import_diego_nisseno.sql` | Import 4 puntate Nisseno + km expenses + pagamento |
| `20260227170000_fix_nisseno_payment_date.sql` | Fix data pagamento Nisseno (29/12/2025) |
| `20260227180000_fix_nisseno_fee_breakdown.sql` | Fix breakdown compensi Nisseno (shooting+editing separati) |
| `20260227190000_fix_missing_invoice_refs.sql` | Fix 2 pagamenti senza invoice_ref → FPR 6/25 |
| `20260227200000_complete_btf_cantina_tre_santi.sql` | Completa 2 servizi BTF non fatturati (vendemmia + puntata finale) |
| `20260227210000_fix_payment_types.sql` | Fix payment_type acconto → saldo per 2 pagamenti che completano fattura |
| `20260227220000_btf_extra_expenses_and_payment.sql` | Aggiunge 2 expense km + 1 payment in_attesa per BTF non fatturato |
| `20260227205707_reallocate_diego_payments.sql` | Riallocazione completa: DELETE 10 errati + CREATE 11 corretti per progetto |
| `20260227230000_add_expenses_to_project_financials.sql` | Aggiunge total_expenses dalla tabella expenses alla view project_financials |
| `20260228000000_audit_constraints.sql` | Audit sessione 14: UNIQUE, CHECK >= 0, tipi credito_ricevuto + rimborso, iPhone migrato |
| `20260227220805_payment_date_not_null.sql` | payment_date NOT NULL (safety fill + ALTER COLUMN) |
| `20260227223414_quote_rejection_reason_required.sql` | CHECK rejection_reason required when status=rifiutato |
| `20260227224137_date_range_checks.sql` | CHECK end_date >= start_date (projects), response_date >= sent_date (quotes) |
| `20260227224448_add_updated_at_columns.sql` | updated_at + trigger set_updated_at() su services, payments, expenses |
| `20260227224515_unique_project_client_name.sql` | UNIQUE (client_id, name) su projects |
| `20260227230519_add_quotes_service_type_check.sql` | CHECK su quotes.service_type (poi droppato) |
| `20260227231714_drop_service_type_checks.sql` | DROP CHECK su quotes + services service_type (tipi ora dinamici) |
| `20260228120000_datetime_range_support.sql` | DateTime Range Support: DATE→TIMESTAMPTZ, event_date→event_start/end, all_day su 4 tabelle |
| `20260228133000_historical_analytics_views.sql` | Prime viste aggregate per storico analytics |
| `20260228150000_normalize_monthly_revenue_net_basis.sql` | Allinea `monthly_revenue` alla base netta coerente con i modelli analytics |
| `20260228170000_add_quotes_project_link.sql` | Aggiunge il collegamento `quotes.project_id` |
| `20260228190000_add_quote_items_json.sql` | Aggiunge `quote_items` ai preventivi |
| `20260228193000_add_historical_cash_inflow_view.sql` | Vista dedicata agli incassi storici |
| `20260228220000_add_service_taxability_and_operational_semantics.sql` | Aggiunge `is_taxable` e basi semantiche operative |
| `20260301100000_views_security_invoker.sql` | Hardening sicurezza sulle views |
| `20260301110000_rls_initplan_optimization.sql` | Ottimizzazione RLS/initplan |
| `20260301120000_index_foreign_keys.sql` | Indici su foreign key principali |
| `20260301153000_add_client_billing_profile.sql` | Profilo fiscale clienti: billing_name, indirizzo fatturazione, SDI, PEC |
| `20260301183000_normalize_client_fiscal_fields.sql` | Bonifica campi fiscali cliente e normalizzazione `billing_name`/`tax_id` |
| `20260301193000_correct_diego_client_to_gustare_assoc.sql` | Correzione anagrafica fiscale Diego -> Associazione Culturale Gustare Sicilia |
| `20260301213000_reactivate_contacts_for_clients_projects.sql` | Riattiva `contacts` per i referenti e aggiunge `project_contacts` |
| `20260301234500_harden_contacts_roles_and_primary.sql` | Ruoli strutturati referenti + referente principale cliente + primario progetto deterministico |
| `20260302010500_financial_documents_foundation.sql` | Introduce `financial_documents`, `cash_movements`, allocazioni esplicite e il primo riallineamento di `project_financials` verso la nuova foundation |
| `20260302104422_services_optional_client_id.sql` | Aggiunge `client_id` opzionale a `services` (come `expenses`): servizi senza progetto possono essere legati direttamente al cliente |
| `20260302143000_add_historical_billing_rounding_credits.sql` | Inserisce crediti di arrotondamento storico su 3 progetti Gustare (€7,32 Gustare Sicilia, €0,10 Borghi Marinari, €2,00 Carratois) come `credito_ricevuto` in `expenses` |
| `20260302160000_add_iphone_credit_payment.sql` | Inserisce il pagamento `rimborso_spese` di €250 in attesa (iPhone: accordo iniziale €500, rivalutato a €250, Diego deve €250 a Rosario) collegato a Borghi Marinari |
| `20260302170000_domain_data_snapshot.sql` | **Snapshot pulita (solo settings).** TRUNCATE di tutte le tabelle operative + INSERT dei 6 record di configurazione. Svuotata il 2026-03-04 per debug dei flussi di calcolo. |

## Moduli Frontend

### Moduli IMPLEMENTATI

| Modulo | Directory | Tipo | Stato |
|--------|-----------|------|-------|
| **Clienti** | `clients/` | CRUD + billing profile + tags/notes/tasks | Completo |
| **Referenti** | `contacts/` | CRUD + ruoli strutturati + relazioni cliente/progetto + primary flags | Completo |
| **Progetti** | `projects/` | CRUD + quick flows collegati | Completo |
| **Registro Lavori** | `services/` | CRUD (Table) | Completo |
| **Preventivi** | `quotes/` | Kanban + dialog + PDF + mail cliente | Completo |
| **Pagamenti** | `payments/` | CRUD + handoff commerciali | Completo |
| **Spese** | `expenses/` | CRUD + km/travel flows | Completo |
| **Promemoria** | `tasks/` | Lista con filtri temporali | Completo |
| **Tags** | `tags/` | Gestione embedded + modali attiva su clienti/impostazioni; supporto dati referenti parziale | Completo |
| **Travel / KM** | `travel/` | Dialog cross-cutting per suggerimenti luogo e calcolo tratta | Completo |
| **Dashboard** | `dashboard/` | Recharts + KPI + alert + fiscale + storico | Completo |
| **AI unificata** | `ai/` | Launcher, snapshot read-only CRM, import, handoff, chat read-only | Completo |

### Snapshot AI unificata

La snapshot letta dal launcher AI non e' testo libero ricostruito al volo.

Espone in modo strutturato almeno:

- clienti recenti con profilo fiscale essenziale e recapiti di fatturazione
  principali gia presenti nel CRM
- referenti recenti con recapiti, ruolo strutturato, flag `principale cliente`
  e relazioni strutturate verso clienti e progetti
- progetti attivi con referenti associati, inclusa l'informazione
  `primario progetto`

Questa snapshot resta read-only e serve a far ragionare la chat AI interna del
prodotto sul modello corretto del dominio, senza inferire tutto dalle note.

### Import documenti AI

Il workspace dell'import documenti non usa piu solo `clients + projects`.

Per ridurre i falsi match persona -> cliente, il resolver runtime legge anche i
`contacts` e puo risalire dal referente noto al cliente fiscale collegato.

Il dominio referenti e' ora piu robusto anche a monte:

- ogni contact puo avere un `contact_role` strutturato
- ogni cliente puo avere un solo `is_primary_for_client = true`
- ogni progetto puo avere un solo `project_contacts.is_primary = true`

L'ordine corretto resta:

1. progetto/cliente gia selezionati
2. identificativi fiscali forti
3. denominazione fiscale
4. referente noto collegato a un cliente
5. nome libero della controparte solo come ultimo fallback

### Struttura moduli CRUD

Pattern base valido per i moduli CRUD classici (`clients`, `contacts`,
`projects`, `services`, `payments`, `expenses`).

Eccezioni reali da ricordare:

- `quotes` usa una board/lista che ospita `create/show/edit` come dialog
  agganciati alle route, quindi non espone il classico export CRUD completo in
  `index.tsx`
- `tasks` usa una lista dedicata con dialog/sheet invece di un CRUD classico
- `travel` non e' una resource autonoma: e' un helper cross-cutting riusato da
  spese, servizi e quick flows progetto

```
src/components/atomic-crm/[modulo]/
├── index.tsx              # Export (list, show, edit, create, recordRepresentation)
├── [Modulo]List.tsx       # Lista con filtri, export CSV, sort
├── [Modulo]ListContent.tsx # Rendering tabella con Table component
├── [Modulo]ListFilter.tsx # Sidebar filtri con badge toggle
├── [Modulo]Create.tsx     # CreateBase + Form + Inputs + FormToolbar
├── [Modulo]Edit.tsx       # EditBase + Form + Inputs + FormToolbar
├── [Modulo]Show.tsx       # ShowBase + dettaglio record
├── [Modulo]Inputs.tsx     # Campi form condivisi Create/Edit
└── [modulo]Types.ts       # Choices e labels per select/badge
```

### Struttura Promemoria (Tasks)

```
src/components/atomic-crm/tasks/
├── TasksList.tsx          # Pagina lista desktop
├── MobileTasksList.tsx    # Pagina lista mobile
├── TasksListContent.tsx   # Composizione filtri temporali
├── Task.tsx               # Riga singola task con checkbox done
├── AddTask.tsx            # Dialog creazione (con selectClient opzionale)
├── TaskFormContent.tsx    # Form fields (testo, tipo, data, cliente)
├── TaskCreateSheet.tsx    # Sheet mobile creazione
├── TaskEdit.tsx           # Pagina edit
├── TaskEditSheet.tsx      # Sheet mobile edit
├── TasksIterator.tsx      # Lista task con ordinamento
└── taskFilters.ts         # Filtri: overdue, today, tomorrow, thisWeek, later
```

Risorsa: `client_tasks` (UUID PK, FK opzionale a clients)

### Struttura Note Clienti

Integrato nella scheda cliente (ClientShow):
- `clients/ClientNotesSection.tsx` — lista + inline create
- `clients/ClientNoteItem.tsx` — singola nota con edit/delete
- `clients/ClientTasksSection.tsx` — promemoria del cliente

Risorsa: `client_notes` (UUID PK, FK obbligatoria a clients)

### Struttura Tags

```
src/components/atomic-crm/tags/
├── ClientTagsList.tsx     # Display tags nel cliente
├── ClientTagsListEdit.tsx # Gestione tags su cliente
├── TagCreateModal.tsx     # Creazione tag
├── TagEditModal.tsx       # Modifica tag
├── TagDialog.tsx          # Dialog condiviso create/edit
├── TagChip.tsx            # Render badge/tag
├── RoundButton.tsx        # Selettore colore
└── colors.ts              # Palette colori
```

Non esiste una pagina dedicata `tags`: la gestione UI attiva avviene in scheda
cliente e in `Impostazioni`.

Il modello dati dei referenti conserva `tags`, ma la relativa UI non e' ancora
esposta come superficie operativa nei form/show dei `contacts`.

### Dashboard (Recharts + Fiscale)

```
src/components/atomic-crm/dashboard/
├── Dashboard.tsx                       # Desktop toggle Annuale / Storico
├── MobileDashboard.tsx                 # Mobile con Annuale compatta + accesso a Storico
├── useDashboardData.ts                 # useGetList multipli + expenses + fiscalConfig (year param)
├── useHistoricalDashboardData.ts       # Context builder per la vista Storico
├── dashboardModel.ts                   # Aggregazioni KPI/grafici/pipeline/alert + fiscal (year-aware)
├── dashboardModelTypes.ts              # Tipi dashboard estratti (DashboardModel, KPIs, drilldowns, alerts)
├── dashboardFormatters.ts              # Formatters (currency, date, category labels)
├── dashboardHistoryModel.ts            # Aggregazioni storiche e quality flags
├── fiscalModel.ts                      # Logica pura calcoli fiscali regime forfettario (principio di cassa)
├── fiscalModelTypes.ts                 # Tipi fiscali estratti (FiscalModel, FiscalKpis, deadlines, health)
├── fiscalDeadlines.ts                  # buildDeadlines (F24/INPS high-priority + bolli/dichiarazione low-priority)
├── useGenerateFiscalTasks.ts           # Hook: genera client_tasks dai deadline fiscali calcolati
├── DashboardAnnual.tsx                 # Vista Annuale con guida lettura, AI card e simulazione fiscale
├── DashboardHistorical.tsx             # Vista Storico con guida, KPI, cash inflow e AI card
├── DashboardAnnualAiSummaryCard.tsx    # AI guidata sul contesto annual_operations
├── DashboardHistoricalAiSummaryCard.tsx # AI guidata sul contesto storico
├── DashboardHistoricalCashInflowAiCard.tsx # AI dedicata agli incassi storici
├── DashboardHistoricalCashInflowCard.tsx # Vista non-AI degli incassi storici
├── DashboardKpiCards.tsx               # 4 KPI cards fatturato/pagamenti
├── DashboardFiscalKpis.tsx             # 4 KPI cards fiscali (netto, tasse, accantonamento, tetto)
├── DashboardAtecoChart.tsx             # Bar chart orizzontale fatturato vs reddito per ATECO
├── DashboardDeadlinesCard.tsx          # Scadenze fiscali: high-priority prominenti, low-priority collassate, bottone genera promemoria
├── DashboardBusinessHealthCard.tsx     # Salute aziendale (conversione, DSO, concentrazione, margini)
├── DashboardRevenueTrendChart.tsx      # Line chart (12 mesi)
├── DashboardCategoryChart.tsx          # Bar chart per categoria
├── DashboardPipelineCard.tsx           # Pipeline preventivi
├── DashboardTopClientsCard.tsx         # Top 5 clienti
├── DashboardAlertsCard.tsx             # Alert urgenti
├── DashboardHistoricalKpis.tsx         # KPI storici multi-year
├── DashboardHistoricalRevenueChart.tsx # Trend storico ricavi di competenza
├── DashboardHistoricalCategoryMixChart.tsx # Mix categorie storico
├── DashboardHistoricalTopClientsCard.tsx # Top clienti storico lifetime
├── DashboardLoading.tsx                # Skeleton loading
├── TasksListFilter.tsx                 # Helper filtro task per dashboard
└── TasksListEmpty.tsx                  # Helper stato vuoto task
```

## Navigazione

```
Bacheca | Clienti | Progetti | Registro Lavori | Preventivi | Pagamenti | Spese | Promemoria
```

Menu utente (dropdown): Profilo | Impostazioni

Mobile: Inizio | Clienti | [+] | Promemoria | Altro

Nel menu `Altro` mobile:

- Profilo
- Progetti
- Registro Lavori
- Preventivi
- Pagamenti
- Spese
- Impostazioni
- toggle tema `sistema / chiaro / scuro`
- logout

## Risorse registrate in CRM.tsx

```
clients, contacts, projects, services, quotes, payments, expenses
  ← CRUD/Kanban con pagine
client_tasks
  ← lista con pagina desktop + mobile
client_notes, project_contacts
  ← risorse headless consumate da sezioni embed
sales
  ← risorsa infrastrutturale consumata da auth e `/profile`
tags
  ← risorsa headless consumata da clienti, referenti e `Impostazioni`
```

### Utility condivise (misc/)

| File | Scopo |
|------|-------|
| `misc/formatDateRange.ts` | `formatDateRange(start, end, allDay)` e `formatDateLong(start, end, allDay)` — formattazione date coerente con supporto range e all_day |
| `misc/ErrorMessage.tsx` | Componente errore riutilizzabile con AlertCircle |
| `misc/CreateSheet.tsx` | Sheet mobile per creazione record |
| `misc/FormToolbar.tsx` | Toolbar form con Save/Delete |

## Tipi TypeScript (types.ts)

```
Client, Contact, Project, Service, Payment, ← CRUD
Expense, Quote, ProjectContact              ← CRUD/Kanban/relazioni
ClientTask, ClientNote                     ← Tasks/Notes adattati
Tag, Sale, SalesFormData, SignUpData        ← Infrastruttura
RAFile, AttachmentNote                     ← File/allegati
LabeledValue, NoteStatus                  ← Config
FiscalConfig, FiscalTaxProfile             ← Fiscale
```

## Authentication

- Method: Supabase Auth
- Access paths attivi:
  - email/password
  - Google Workplace SSO se `googleWorkplaceDomain` e' configurato
- User: rosariodavide.furnari@gmail.com (unico)
- Signup pubblico libero: non supportato
- Bootstrap primo utente:
  - resta come superficie tecnica nel router
  - nel runtime Supabase single-user corrente non e' il percorso normale, perche'
    `getIsInitialized()` e' forzato a `true`
  - se la route viene aperta mentre l'app risulta gia inizializzata, reindirizza
    al login normale
- API Keys: VITE_SB_PUBLISHABLE_KEY (formato sb_publishable_...)

## Supabase Config

- Progetto remoto: `qvdmzhyzpyaveniirsmo.supabase.co`
- Keep-alive: GitHub Actions, lunedì e giovedì 08:00 UTC
- Edge Function secrets: SB_SECRET_KEY configurato su remoto

## Deployment

- **Hosting**: Vercel (gestionale-rosario.vercel.app)
- **Auto-deploy**: Vercel collegato al repo GitHub, deploya su ogni push a main

## Pages Map

```
/login               → Entry auth principale; nel runtime Supabase corrente resta il percorso normale di accesso
/sign-up             → Superficie tecnica di bootstrap primo utente; nel runtime corrente rimbalza sul login se l'app risulta gia inizializzata
/sign-up/confirm     → Schermata tecnica di conferma bootstrap iniziale
/forgot-password     → Recupero password
/set-password        → Impostazione/reset password
/oauth/consent       → Consenso OAuth
/                    → Dashboard finanziaria (Recharts: KPI, grafici, pipeline, alert, navigazione anno)
/clients             → Lista clienti
/clients/create      → Crea cliente
/clients/:id         → Modifica cliente
/clients/:id/show    → Scheda cliente (dettagli, fatturazione, tags, riepilogo finanziario, referenti, note, promemoria)
/contacts            → Lista referenti
/contacts/create     → Crea referente
/contacts/:id        → Modifica referente
/contacts/:id/show   → Scheda referente
/projects            → Lista progetti
/projects/create     → Crea progetto
/projects/:id        → Modifica progetto
/projects/:id/show   → Dettaglio progetto (dati base, referenti, quick flows, riepilogo finanziario)
/services            → Registro lavori
/services/create     → Crea lavoro
/services/:id        → Modifica lavoro
/services/:id/show   → Dettaglio servizio
/quotes              → Pipeline preventivi (Kanban 10 stati)
/quotes/create       → Crea preventivo in dialog
/quotes/:id          → Modifica preventivo in dialog
/quotes/:id/show     → Dettaglio preventivo in dialog
/payments            → Lista pagamenti
/payments/create     → Crea pagamento
/payments/:id        → Modifica pagamento
/payments/:id/show   → Dettaglio pagamento
/expenses            → Spese e km
/expenses/create     → Crea spesa
/expenses/:id        → Modifica spesa
/expenses/:id/show   → Dettaglio spesa
/client_tasks        → Lista promemoria (filtri: scaduti, oggi, domani, settimana, più avanti)
/settings            → Impostazioni (Marchio, Etichette, Tipi preventivo, Tipi servizio, Operatività, Note, Attività, AI, Fiscale)
/profile             → Profilo utente
```
