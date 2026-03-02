# Development Continuity Map

**Stato del documento:** `canonical`
**Scopo:** fonte primaria per reading order, checklist di integrazione e sweep
obbligatoria delle superfici collegate.
**Quando usarlo:** ogni volta che una modifica tocca comportamento reale del
prodotto.

Last updated: 2026-03-02

## Goal

Questo documento esiste per evitare due errori ricorrenti:

- dimenticare superfici o file correlati quando cambia il dominio
- aggiornare `Settings` a caso oppure dimenticarle quando una regola diventa
  configurabile

La regola operativa e' semplice:

- una feature non e' davvero integrata finche' non sono allineati
  dominio, provider, UI, AI, test e docs di continuita'
- nessuna modifica va considerata chiusa senza controllo di coerenza anche su
  pagine, modali/sheet/dialog, helper, linking, provider ed eventuali Edge
  Functions connesse

## Current Execution Order

Per questa fase del progetto la continuita' non va piu' letta in ottica
"facciamo passare i test e poi vediamo".

L'ordine corretto e' questo:

1. importare o ricostruire il dominio dai file fonte di verita'
2. correggere sistema, schema e semantica sui dati reali
3. riallineare UI, AI, import e analytics
4. solo dopo aggiornare o scrivere i test

Regola pratica:

- i test sono uno strumento di verifica del sistema
- non devono diventare il motore che decide il modello di dominio
- se esiste gia' una fonte reale, non introdurre fixture dominio hardcoded come
  scorciatoia permanente

## Automation

La continuita' non e' affidata solo alla memoria.

Il repository ora usa anche un guardrail automatico in pre-commit:

- `scripts/check-continuity.mjs`

Il controllo legge i file staged e blocca il commit se:

- cambia codice prodotto senza alcun aggiornamento nei docs di continuita'
- cambia schema/provider/resource senza aggiornare almeno architettura o
  continuity map
- cambia il dominio `clienti/referenti/progetti` senza toccare la doc
  canonica relativa
- cambia il flusso import documenti senza aggiornare caso reale o handoff
- cambia AI/analytics senza aggiornare handoff, backlog o architettura
- cambia configurazione condivisa senza toccare `Settings` o senza lasciare
  traccia del motivo nei docs

Per i file di orchestrazione agentica la regola e':

- `AGENTS.md` e' la fonte condivisa canonica
- `CLAUDE.md` deve restare solo complementare e collegato a `AGENTS.md`
- non mantenere due versioni complete e concorrenti delle stesse regole

Questo non sostituisce il giudizio tecnico, ma riduce il rischio di chiudere un
commit lasciando il progetto semanticamente spezzato.

## Local Runtime Rule

Per lo sviluppo locale supportato:

- il repo usa Supabase reale locale, non la demo FakeRest
- questo progetto usa porte locali `5532x` per convivere con altri stack
  Docker gia' attivi sulla macchina
- `make start` e `npx supabase db reset` devono lasciare il repo con un admin
  locale autenticabile gia' pronto, senza setup manuale post-reset
- se tocchi `supabase/config.toml`, migration storiche o `.env` di sviluppo,
  devi verificare che `npx supabase start` resti replayable da zero senza
  dipendere da UUID catturati dal remoto o da stato preesistente
- il bootstrap locale di dominio usa un rebuild reale basato su:
  - `Fatture/` (XML fatture emesse e ricevute)
  - `Fatture/contabilità interna - diego caltabiano/` (CSV contabilita' Diego)
  - portale Aruba Fatturazione Elettronica (date di incasso esatte 2023-2025,
    codificate in `ARUBA_PORTAL_TRUTH` dentro `scripts/local-truth-data.mjs`)
- se tocchi parser, script di rebuild o migration che alimentano quel dataset,
  devi verificare almeno:
  - `npx supabase db reset`
  - bootstrap admin locale
  - rebuild del dominio
  - smoke/test che leggono il caso Diego/Gustare
- non reintrodurre script E2E o seed con dati dominio hardcoded come seconda
  fonte di verita'

## Reading Order For A New Chat

1. `docs/README.md`
2. `docs/development-continuity-map.md`
3. `docs/local-truth-rebuild.md`
4. `docs/historical-analytics-handoff.md`
5. `docs/historical-analytics-backlog.md`
6. `docs/contacts-client-project-architecture.md`
7. `docs/data-import-analysis.md`
8. `Gestionale_Rosario_Furnari_Specifica.md`

## Source Of Truth By Area

- Prodotto/funzionale:
  - `Gestionale_Rosario_Furnari_Specifica.md`
- Architettura generale:
  - `docs/architecture.md`
- Handoff AI e roadmap continua:
  - `docs/historical-analytics-handoff.md`
  - `docs/historical-analytics-backlog.md`
- Dominio referenti/clienti/progetti:
  - `docs/contacts-client-project-architecture.md`
- Rebuild locale dominio, fonti dati e stato incasso:
  - `docs/local-truth-rebuild.md`
  - la cartella repo-root `Fatture/`
  - portale Aruba Fatturazione Elettronica per stato incasso autoritativo
- Caso reale Diego/Gustare (servizi, tariffe, acconti):
  - `docs/data-import-analysis.md`
  - per il caso Diego/Gustare, la sotto-cartella
    `Fatture/contabilità interna - diego caltabiano/` e' la fonte piu
    autorevole per verificare che:
    - `ASSOCIAZIONE CULTURALE GUSTARE SICILIA` e' il cliente fiscale
    - `Diego Caltabiano` e' il referente operativo collegato

## Current Priority Debt

Il prossimo debito strutturale da trattare prima di nuove espansioni di
dominio e' la semantica finanziaria.

Oggi i flussi `payments` / `expenses` portano ancora troppi significati insieme.

La direzione canonica da mantenere esplicita e':

- separare documento emesso/ricevuto
- separare stato da incassare/pagare
- separare movimento di cassa effettivo

Finche' questo passaggio non e' completato:

- ogni modifica su import documenti, pagamenti, spese, dashboard, analytics e
  chat AI va trattata come semanticamente fragile
- i test non bastano da soli a considerare "sano" il sistema se il modello
  sottostante resta ambiguo

## Full Surface Sweep Rule

Da ora in poi, quando una modifica tocca un modulo reale del prodotto, il
controllo minimo obbligatorio non e' "il file che ho aperto funziona".

Il controllo obbligatorio e':

1. list/index del modulo
2. create
3. edit
4. show/dettaglio
5. filtri desktop/mobile
6. dialog/sheet/modal collegati
7. helper di linking, draft o persistence
8. provider e query/mutation correlate
9. Edge Functions o layer server correlati
10. semantic/capability registry se la feature e' letta o usata dall'AI
11. docs di continuita'
12. settings, ma solo se la modifica e' config-driven

## Mandatory Product Sweep

Questi moduli non possono piu essere trattati come isolati. Se uno di loro
cambia, va fatta sempre una sweep sulle superfici annesse.

### Progetti

Controllare sempre:

- `src/components/atomic-crm/projects/**`
- `ProjectList`, `ProjectCreate`, `ProjectEdit`, `ProjectShow`
- `ProjectListFilter`
- `QuickEpisodeDialog`
- `QuickEpisodeForm`
- `QuickPaymentDialog`
- `projectQuickEpisodeLinking.ts`
- `quickEpisodePersistence.ts`
- sezioni collegate nello show:
  - referenti
  - finanziari
  - handoff verso servizi/pagamenti/chat AI

### Registro lavori

Controllare sempre:

- `src/components/atomic-crm/services/**`
- `ServiceList`, `ServiceCreate`, `ServiceEdit`, `ServiceShow`
- `ServiceListFilter`
- `ServiceTotals`
- `serviceLinking.ts`
- `src/components/atomic-crm/travel/TravelRouteCalculatorDialog.tsx` se cambia
  la logica km/trasferta o i prefills lato servizio

### Preventivi

Controllare sempre:

- `src/components/atomic-crm/quotes/**`
- lista/kanban, create, edit, show
- `CreateProjectFromQuoteDialog`
- `SendQuoteStatusEmailDialog`
- `QuotePaymentsSection`
- `QuotePDF`
- `quoteItems.ts`
- `quotePaymentsSummary.ts`
- `quoteProjectLinking.ts`
- layer comunicazioni collegato:
  - `src/lib/communications/**`
  - `supabase/functions/quote_status_email_send/**` se il flusso mail cambia

### Pagamenti

Controllare sempre:

- `src/components/atomic-crm/payments/**`
- create, edit, show, list, filter
- `paymentLinking.ts`
- handoff da:
  - preventivi
  - progetti quick payment
  - chat AI unificata

### Spese

Controllare sempre:

- `src/components/atomic-crm/expenses/**`
- create, edit, show, list, filter
- `expenseLinking.ts`
- `src/components/atomic-crm/travel/TravelRouteCalculatorDialog.tsx`
- server/tooling collegato:
  - `travel_route_estimate`
  - `travel_location_suggest`
  - semantiche km/rimborso

### Promemoria

Controllare sempre:

- `src/components/atomic-crm/tasks/**`
- `TasksList`, `MobileTasksList`
- `AddTask`
- `TaskCreateSheet`
- `TaskEdit`
- `TaskEditSheet`
- `TaskFormContent`
- `taskFilters.ts`
- superfici embed che leggono i promemoria, se toccate dal dominio:
  - cliente
  - dashboard

### Import documenti

Controllare sempre:

- `src/components/atomic-crm/ai/AiInvoiceImportView.tsx`
- `src/components/atomic-crm/ai/InvoiceImportDraftEditor.tsx`
- `src/lib/ai/invoiceImport.ts`
- `src/lib/ai/invoiceImportProvider.ts`
- `supabase/functions/invoice_import_extract/**`
- `supabase/functions/invoice_import_confirm/**`
- workspace clienti/progetti usato dall'import
- mapping semantico verso `payments` / `expenses`
- docs:
  - `docs/data-import-analysis.md`

### Bacheca annuale e storica

Controllare sempre:

- `src/components/atomic-crm/dashboard/DashboardAnnual.tsx`
- `src/components/atomic-crm/dashboard/DashboardHistorical.tsx`
- card AI e non-AI collegate
- modelli e hook dati:
  - `dashboardModel.ts`
  - `dashboardHistoryModel.ts`
  - `useDashboardData.ts`
  - `useHistoricalDashboardData.ts`
- contesti analytics:
  - `src/lib/analytics/**`
- Edge Functions collegate:
  - `annual_operations_summary`
  - `historical_analytics_summary`
  - `historical_analytics_answer`
  - `historical_cash_inflow_summary`
  - `historical_cash_inflow_answer`
- `AISettingsSection` se cambia il modello o la promessa utente sulle analisi

### Chat AI unificata

Controllare sempre:

- `src/components/atomic-crm/ai/**`
- `src/lib/ai/unifiedCrmAssistant.ts`
- `src/lib/ai/unifiedCrmReadContext.ts`
- `src/lib/semantics/crmSemanticRegistry.ts`
- `src/lib/semantics/crmCapabilityRegistry.ts`
- `supabase/functions/_shared/unifiedCrmAnswer.ts`
- `supabase/functions/unified_crm_answer/index.ts`
- handoff verso moduli reali:
  - progetti
  - servizi
  - preventivi
  - pagamenti
  - spese
  - import documenti

### 1. Se cambia il dominio o una relazione DB

Aggiornare sempre:

- `supabase/migrations/**`
- `src/components/atomic-crm/types.ts`
- `src/components/atomic-crm/providers/supabase/dataProvider.ts`
- `src/components/atomic-crm/providers/fakerest/dataProvider.ts`
- `src/components/atomic-crm/providers/fakerest/dataGenerator/index.ts`
- `src/components/atomic-crm/providers/fakerest/dataGenerator/types.ts`
- `src/components/atomic-crm/root/CRM.tsx` se nasce/muore una resource
- `src/components/atomic-crm/root/i18nProvider.tsx`
- la UI della resource coinvolta
- le show page delle resource collegate
- test e docs di continuita'

### 2. Se cambia il modello cliente/referente/progetto

Aggiornare sempre:

- `src/components/atomic-crm/clients/**`
- `src/components/atomic-crm/contacts/**`
- `src/components/atomic-crm/projects/**`
- `src/lib/ai/unifiedCrmReadContext.ts`
- `src/components/atomic-crm/ai/UnifiedCrmReadSnapshot.tsx`
- `supabase/functions/_shared/unifiedCrmAnswer.ts`
- `supabase/functions/unified_crm_answer/index.ts`
- `docs/contacts-client-project-architecture.md`

Motivo:

- la chat AI non deve inferire referenti dalle note
- deve leggere relazioni strutturate cliente -> referente -> progetto
- se introduci `contact_role`, `is_primary_for_client` o `project_contacts.is_primary`,
  devi rifletterli in schema, helper dominio, create/edit/show/list, sezioni
  cliente/progetto e snapshot AI

### 3. Se cambia una regola configurabile o un default modificabile da utente

Aggiornare sempre:

- `src/components/atomic-crm/root/defaultConfiguration.ts`
- `src/components/atomic-crm/root/ConfigurationContext.tsx`
- `src/components/atomic-crm/root/ConfigurationContext.test.ts`
- `src/components/atomic-crm/settings/SettingsPage.tsx`
- la section corretta in `src/components/atomic-crm/settings/**`
- tutti i consumer reali della config:
  - dashboard
  - modelli fiscali
  - semantica CRM
  - provider
  - Edge Functions se usano quella config
- docs che spiegano la semantica della regola

Esempi tipici:

- modelli AI
- default km
- regole fiscali
- label/tipi servizio se diventano parte della config

### 4. Quando `Settings` NON va aggiornata

`Settings` non va toccata se la modifica e':

- solo strutturale
- non configurabile dall'utente
- parte del modello dati interno e non una preferenza/regola editabile

Esempio attuale:

- aggiungere `contacts` e `project_contacts` al read-context AI non richiede una
  nuova impostazione utente
- in questo caso va aggiornata la documentazione di continuita' per spiegare
  esplicitamente perche' `Settings` e' rimasta invariata

### 5. Se cambia la chat AI unificata

Aggiornare sempre:

- `src/lib/ai/unifiedCrmAssistant.ts`
- `src/lib/ai/unifiedCrmReadContext.ts`
- `src/components/atomic-crm/ai/UnifiedCrmReadSnapshot.tsx`
- `src/components/atomic-crm/ai/UnifiedAiLauncher.tsx`
- `src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx`
- `src/lib/semantics/crmSemanticRegistry.ts`
- `src/lib/semantics/crmCapabilityRegistry.ts`
- `supabase/functions/_shared/unifiedCrmAnswer.ts`
- `supabase/functions/_shared/unifiedCrmAnswer.test.ts`
- `supabase/functions/unified_crm_answer/index.ts`

Aggiornare anche `Settings -> AI` solo se cambia:

- il modello selezionabile
- il comportamento configurabile
- la promessa utente esposta nella UI delle impostazioni

### 6. Se cambia l'import fatture/ricevute

Aggiornare sempre:

- `src/lib/ai/invoiceImport.ts`
- `src/lib/ai/invoiceImportProvider.ts`
- `supabase/functions/invoice_import_extract/**`
- `supabase/functions/invoice_import_confirm/**`
- `src/lib/semantics/crmSemanticRegistry.ts`
- `docs/data-import-analysis.md`

Se cambia Edge Runtime:

- fare anche deploy dedicato delle function Supabase

## Minimal Closure Note For Every Shipped Change

Ogni modifica importante deve lasciare in docs almeno queste 5 risposte:

1. cosa e' cambiato
2. perche' e' cambiato
3. quali file/moduli vanno considerati correlati in futuro
4. cosa e' stato volutamente NON cambiato
5. stato deploy:
   - frontend pushato o no
   - migration remota applicata o no
   - Edge Functions deployate o no

In piu', per i moduli del `Mandatory Product Sweep`, annotare sempre anche:

6. quali pagine/modali/sheet/dialog sono stati verificati o toccati
7. quali helper/provider/function sono stati verificati o toccati

## Deploy Continuity

- modifiche frontend:
  - `git push origin main`
- modifiche DB:
  - `npx supabase db push`
- modifiche Edge Functions:
  - `npx supabase functions deploy <nome>`

Non trattare mai il solo `git push` come deploy completo se hai toccato
`supabase/functions/**`.
