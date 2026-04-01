# AGENTS.md

## AGENT ENTRYPOINTS

- `AGENTS.md` e' la fonte canonica condivisa per istruzioni di progetto,
  continuita' e workflow agentico.
- `CLAUDE.md` deve essere solo complementare:
  - importa `AGENTS.md`
  - aggiunge solo delta specifici di Claude Code
  - non deve diventare una seconda fonte completa di regole progetto
- se cambia una regola condivisa, aggiornare prima `AGENTS.md`
- se `AGENTS.md` e `CLAUDE.md` entrano in conflitto, vince `AGENTS.md`
- `.claude/rules/learning.md` raccoglie lezioni operative tra sessioni ed e'
  auto-loaded in ogni sessione; ogni agente deve aggiornarla se scopre un
  pattern nuovo o un errore significativo
- i trigger in `learning.md` usano ID per categoria (`UI-N`, `DB-N`, `BE-N`,
  `DOM-N`, `CFG-N`, `WF-N`) e formato `Quando` / `Fare` / `Perché`

## COMMUNICATION CONVENTION

- comunicare con l'utente in ITALIANO
- scrivere codice, commenti, nomi variabili e commit in ENGLISH
- non spiegare concetti base quando non servono

## AGENT AUTONOMY

- NON chiedere "cosa facciamo ora?" o "da dove vuoi partire?"
- usare la propria conoscenza del codebase per decidere le priorita'
- seguire il piano o l'attivita' corrente dedotta dal contesto
- chiedere SOLO per ambiguita' rischiose, impatto distruttivo o tradeoff
  architetturali non deducibili dal repo

## BOUNDARY WITH PRODUCT AI

- questo file governa gli agenti che sviluppano il repo, non la chat AI interna
  del CRM
- l'AI utente del prodotto vive in:
  - `src/components/atomic-crm/ai/`
  - `src/lib/semantics/`
  - `supabase/functions/`
  - `docs/architecture.md`
  - `docs/historical-analytics-handoff.md`
  - `docs/historical-analytics-backlog.md`
- se cambia l'orchestrazione agentica:
  - aggiornare `AGENTS.md` e, se serve, `CLAUDE.md`
- se cambia l'AI del prodotto:
  - aggiornare codice prodotto, registry/semantica, test e docs di continuita'

## SYSTEM-FIRST RULE

- non ottimizzare i test prima del sistema
- se il modello di dominio e' debole o ambiguo:
  - prima correggere fonte dati, schema, semantica e flussi reali
  - poi aggiornare test, smoke ed E2E
- i test servono a verificare il sistema corretto, non a definire da soli il
  comportamento giusto
- se esiste una fonte reale nel repo, non creare una seconda verita' con
  fixture hardcoded di dominio

Regola attuale per il locale:

- il rebuild del dominio locale parte da `supabase/seed_domain_data.sql`,
  un dump dei dati reali del DB remoto di produzione
- `make supabase-reset-database` esegue: reset schema, load domain seed,
  bootstrap admin
- per aggiornare il seed: `npx supabase db dump --data-only` dal remoto,
  estrarre le tabelle public e rigenerare `seed_domain_data.sql`
- `Fatture/` e' la fonte storica XML delle fatture emesse/ricevute;
  NON viene piu' usata per il rebuild locale
- per Diego/Gustare, i dettagli storici non presenti nelle fatture vanno letti da
  `Fatture/contabilità interna - diego caltabiano/`
- non reintrodurre bootstrap fixture di dominio come seconda fonte di verita'

Regola attuale per migration e bootstrap:

- ogni migration deve essere replayable da zero
- non dipendere da UUID catturati dal remoto, stato manuale o record creati a
  mano
- il bootstrap locale tecnico puo' creare l'admin o dati strettamente tecnici,
  ma non deve inventare dominio parallelo se la fonte reale esiste

## DEPLOYMENT RULES - NON DIMENTICARE

- `git push` su `main` aggiorna automaticamente il frontend su `Vercel`
- quindi, se il lavoro tocca solo UI/frontend, **NON** serve parlare di un
  deploy frontend manuale separato
- `git push` **NON** deploya le Supabase Edge Functions remote
- quindi, se il lavoro tocca `supabase/functions/**`, serve valutare e spesso
  fare anche `npx supabase functions deploy ...` sul progetto remoto
- regola pratica:
  - modifiche frontend -> commit/push e Vercel fa auto-deploy
  - modifiche Edge Functions -> commit/push + deploy Supabase separato
  - modifiche miste -> entrambe le cose

## CRITICAL TRIGGERS

Errori ad alto costo gia' pagati. L'archivio completo (35 trigger) e' in
`.claude/rules/learning.md`.

- **Fiscale = CASSA**: la base imponibile forfettaria usa `payments`
  (status=ricevuto, payment_date), MAI `services` (service_date)
- **Forfettario != ordinario**: le spese NON si deducono individualmente;
  no IVA, no deduzioni singole — verificare prima di proporre feature fiscali
- **Nuova Edge Function -> config.toml**: aggiungere
  `[functions.nome] verify_jwt = false` — senza, Kong blocca → 401 sistematico
- **Edge Function modificata -> deploy manuale**: `git push` NON deploya le
  EF remote; serve `npx supabase functions deploy`
- **Desktop props -> verificare mobile**: cercare TUTTI i consumer e passare
  i nuovi props anche da `MobileDashboard` — dati finanziari errati = critico
- **Business date -> dateTimezone helper**: MAI `toISOString().slice(0,10)` o
  `new Date("YYYY-MM-DD")` — usare `todayISODate()` / `toISODate()` da
  `dateTimezone` (data sbagliata tra 00:00 e 02:00 CEST)
- **Enum/Choice -> aggiorna TUTTE le superfici**: CHECK DB, types.ts, UI
  choices, views CASE, AI registry, Edge Functions, test — un disallineamento
  blocca INSERT o mostra tipi senza label
- **Commit codice -> docs nello STESSO commit**: MAI committare codice e poi
  docs in un commit separato

## Dashboard & KPI Card Design — "Approccio Bambino"

Le card informative (KPI, cash flow, riepilogo) devono essere leggibili da un
bambino. Un utente deve capire il messaggio in 2 secondi senza leggere badge,
tooltip o collapsible.

Principi:

1. **Layout spaziale, non testuale**: dividere lo spazio in colonne per
   contrapporre concetti (entrate vs uscite, count vs valore). Usare
   `Separator orientation="vertical"` per dividere visivamente.
2. **Un numero grande per concetto**: ogni colonna ha un importo/count in
   `text-2xl font-bold` con colore semantico (emerald = soldi che hai,
   red = soldi che escono, amber = soldi che aspetti).
3. **Barra risultato**: sotto le colonne, una riga colorata con sfondo pieno
   (emerald o red) che dice il risultato in linguaggio naturale
   ("Ti restano X" / "Mancano X" / "Restano X").
4. **Niente dettagli nascosti**: se un dato va nascosto in un `<details>`,
   probabilmente non serve nella card. La card mostra solo l'essenziale;
   i drill-down vivono nelle pagine di dettaglio.
5. **Niente badge esplicativi**: i badge tipo "Incassi attesi · non lavoro
   svolto" sono footnote che un bambino non legge. Se il titolo e il layout
   non bastano a spiegare, il design e' sbagliato.
6. **Delta inline, non badge**: le variazioni % (mese precedente, YoY) vanno
   come freccia colorata accanto al numero, non come badge separato.
7. **Progress bar per rapporti**: quando c'e' un rapporto parte/tutto
   (incassato vs totale), usare una barra di progresso, non due numeri
   separati.
8. **Etichette corte e dirette**: "Entrano" / "Escono" / "Da incassare" /
   "Lavoro del mese", non "Valore del lavoro svolto nel mese corrente".

Pattern di riferimento nel codebase:

- `DashboardCashFlowCard` — 2 colonne (Entrano | Escono) + barra risultato
- `DashboardNetAvailabilityCard` — 3 colonne (Incassato | Spese | Tasse) +
  barra risultato
- `DashboardKpiCards` — card singole con delta inline e progress bar

### REGOLA CRITICA — Parita' Desktop / Mobile per dati finanziari

Ogni componente condiviso che riceve props con dati finanziari (fiscalKpis,
taxesPaid, cashFlow, ecc.) DEVE ricevere gli stessi props da TUTTI i consumer:
`DashboardAnnual` (desktop) E `MobileDashboard` (mobile).

Quando si aggiunge un nuovo prop finanziario a un componente condiviso:

1. Cercare TUTTI i consumer con `grep -r "ComponentName" src/ --include="*.tsx"`
2. Verificare che il prop sia passato in OGNI chiamata
3. Se il mobile non lo passa, il dato finanziario sara' SBAGLIATO su cellulare

Dati finanziari errati = rischio critico. MAI ignorabile.

### Pattern — Compact collapsible per mobile

Quando un componente ha contenuti secondari che su desktop vanno bene visibili
ma su mobile occupano troppo spazio, usare il pattern `compact`:

1. Aggiungere prop `compact?: boolean` al componente
2. Su mobile passare `compact` (da `MobileDashboard`)
3. In `compact` mode, wrappare i contenuti secondari in un toggle collassabile:
   - di default chiuso (`useState(!compact)`)
   - label breve + `ChevronDown`/`ChevronUp`
   - i contenuti primari (CTA principale, input libero) restano sempre visibili

Riferimento: `DashboardAnnualAiSummaryCard` — "Spiegami l'anno" + input libero
sempre visibili, suggerimenti dietro toggle "Suggerimenti".

Replicare questo pattern ogni volta che un componente condiviso desktop/mobile
ha sezioni che su cellulare distraggono dall'azione principale.

## AI Visual Blocks Pattern — "Vista smart"

Le risposte AI del CRM possono essere renderizzate come blocchi visivi
strutturati invece di markdown. Il pattern e' opt-in per l'utente e replicabile
su qualsiasi superficie AI del prodotto.

Documentazione completa: `docs/ai-visual-blocks-pattern.md` (canonical)

### Principio

L'AI risponde con un array JSON di blocchi tipizzati (`AiBlock[]`). Il frontend
li renderizza con `<AiBlockRenderer>`, garantendo coerenza visiva col design
system. L'utente attiva la modalita' con un toggle "Vista smart" (localStorage).
Quando il toggle e' spento, il flusso markdown resta immutato.

### Checklist per replicare su una nuova superficie

1. **Provider**: aggiungere `options?: { visualMode?: boolean }` al metodo,
   passare `visualMode` nel body della Edge Function
2. **Edge Function**: importare `visualModeInstructions` da
   `_shared/visualModePrompt.ts`, estrarre `visualMode` dal body, switchare
   instructions, parsare JSON se `isVisual`, alzare `max_output_tokens` a 2500
3. **Componente**: aggiungere toggle con stesso pattern (localStorage key
   diversa), type guard con `"blocks" in d`, rendering condizionale
   `<AiBlockRenderer>` vs `<Markdown>`
4. **Tipi**: usare `AiBlock[]` per i blocchi, creare tipo response specifico
5. **Test**: aggiornare mock per includere `{ visualMode: true }`
6. **PDF export**: aggiungere bottone con pattern `printResult` (clone DOM →
   portal `[data-print-portal]` → `window.print()` → cleanup). Il CSS
   `@media print` in `index.css` e' gia' pronto, zero dipendenze.

### File condivisi — NON duplicare

- `src/components/atomic-crm/dashboard/AiBlockRenderer.tsx` — renderer
- `supabase/functions/_shared/visualModePrompt.ts` — prompt AI
- `src/lib/analytics/annualAnalysis.ts` — `AiBlock` union type, `AiBlockColor`
- `src/index.css` — regole `@media print` per export PDF

### Implementazione attuale

Attivo su:

- dashboard annuale (`DashboardAnnualAiSummaryCard`)
- dashboard storica (`DashboardHistoricalAiCard`) — card unificata con scope
  selector storico/incassi, Vista smart, PDF export, compact mobile

Default: Vista smart attiva, card AI in cima alla dashboard (prima delle KPI)

## Frontend Import Rules

- Form inputs (`TextInput`, `SelectInput`, `BooleanInput`, etc.) da `@/components/admin/`, MAI da shadcn/ui
- Pure UI (`Card`, `Button`, `Badge`, `Separator`, etc.) da `@/components/ui/`
- Config SEMPRE da `useConfigurationContext()`, mai hardcoded
- Mobile: usare `useIsMobile()` per branching, `CreateSheet`/`EditSheet` per sub-resources
- Data fetching standard: ra-core hooks (`useListContext`, `useGetList`, `useGetOne`, `useShowContext`)
- Data fetching custom: metodo nel dataProvider, chiamato via `useQuery`/`useMutation` + `useDataProvider<CrmDataProvider>()`

## Backend Implementation Rules

### Smallest Correct Layer

frontend/provider only -> database migration/view -> Edge Function
Non salire di layer se non necessario.

### New Table/View Checklist

1. Migration in `supabase/migrations/`
2. Chiavi, vincoli, indici
3. RLS abilitata
4. Policy esplicite (`auth.uid() IS NOT NULL` per business tables)
5. `created_at` e `updated_at` dove serve
6. Aggiornare provider Supabase + `types.ts` + docs

### Provider-First Rule

Non creare client Supabase custom se il dataProvider esistente basta.
Preferire metodi espliciti nel provider.

### Enum/Choice Consistency Rule — CRITICA

Quando si aggiunge un nuovo valore a un enum o a una lista di scelte (es.
`expense_type`, `service_type`, `payment_type`, `status`), aggiornare SEMPRE
tutte queste superfici:

1. **CHECK constraint** nel DB (migration)
2. **TypeScript type** in `types.ts`
3. **Choices/labels** nel modulo UI (es. `expenseTypes.ts`)
4. **Views** che contengono CASE/switch su quel campo
5. **AI registry** se il campo e' esposto alla semantica
6. **Edge Functions** se usano validazione o switch su quel campo
7. **Test** con fixture che usano quel campo

Se anche UNA sola superficie resta disallineata, il DB rifiuta l'insert oppure
la UI mostra un tipo senza label. Verificare PRIMA di committare.

## Mandatory Surface Sweep

Quando si modifica un modulo con sweep obbligatorio (`projects`, `services`, `quotes`, `payments`, `expenses`, `suppliers`, `tasks`, dashboard, AI), verificare TUTTE queste aree:

1. list/index
2. create
3. edit
4. show/detail
5. filters (desktop + mobile)
6. dialogs/sheets/modals collegati
7. linking helpers e persistenza
8. provider e queries/mutations
9. Edge Functions o server layer
10. semantic registry + capability registry (se AI-read)
11. continuity docs
12. Settings (solo se config-driven)
13. **MobileDashboard** (se dashboard): stessi props finanziari del desktop

## Pre-commit Continuity Rules

Il pre-commit hook esegue `npm run continuity:check` che BLOCCA i commit se:

- Codice prodotto (`src/`, `supabase/`) cambia senza almeno 1 doc in `docs/`
- Schema/type/provider/CRM.tsx cambia senza `architecture.md` + `development-continuity-map.md`
- AI/dashboard/semantics cambia senza `historical-analytics-handoff.md` + `historical-analytics-backlog.md` + `architecture.md`
- Clienti/contatti/progetti cambia senza `contacts-client-project-architecture.md` + `architecture.md`
- `defaultConfiguration` o `ConfigurationContext` cambia senza Settings UI o doc explanation

Test files (`*.test.ts`, `*.spec.tsx`) sono esenti.

## Test Naming Convention

- Unit test: `foo.test.ts` nella stessa directory del file testato
- E2E smoke: `tests/e2e/feature-name.smoke.spec.ts`
- Fixture inline, mai fixture condivise di dominio (SYSTEM-FIRST RULE)
- Ogni builder/funzione pura -> test unitario
- Ogni flusso business-critical -> E2E smoke

## Project Overview

Gestionale Rosario Furnari is a heavily customized fork of Atomic CRM built with
React, shadcn-admin-kit, and Supabase.

The active product surface includes:

- clients and billing profiles
- contacts as referents linked to clients and projects
- projects
- services / work log
- quotes
- payments
- expenses
- suppliers
- reminders
- annual and historical dashboards
- unified AI chat and document import

## Development Commands

### Setup
```bash
make install          # Install dependencies (frontend, backend, local Supabase)
make start            # Start full stack with real API (Supabase + Vite dev server)
make stop             # Stop the stack
```

### Testing and Code Quality

```bash
make test             # Run unit tests (vitest)
make test-e2e         # Run Playwright technical regression tests (deterministic local data)
make typecheck        # Run TypeScript type checking
make lint             # Run ESLint and Prettier checks
```

### Building

```bash
make build            # Build production bundle (runs tsc + vite build)
```

### Database Management

```bash
npx supabase migration new <name>  # Create new migration
npx supabase migration up          # Apply migrations locally
npx supabase db push               # Push migrations to remote
npx supabase db reset              # Reset local database (destructive)
```

### Registry (Shadcn Components)

```bash
make registry-gen     # Generate registry.json (runs automatically on pre-commit)
make registry-build   # Build Shadcn registry
```

### Pre-commit Guardrails

- `npm exec lint-staged` formats/fixes staged files
- `npm run continuity:check` blocks commits that change product code without the
  expected continuity docs or companion surfaces

## Architecture

### Technology Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Routing**: React Router v7
- **Data Fetching**: React Query (TanStack Query)
- **Forms**: React Hook Form
- **Application Logic**: shadcn-admin-kit + ra-core (react-admin headless)
- **UI Components**: Shadcn UI + Radix UI
- **Styling**: Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL + REST API + Auth + Storage + Edge Functions)
- **Testing**: Vitest

### Directory Structure

```
src/
├── components/
│   ├── admin/              # Shadcn Admin Kit components (mutable dependency)
│   ├── atomic-crm/         # Main CRM application code
│   │   ├── ai/             # Unified AI launcher, snapshot, import flows
│   │   ├── clients/        # Client management + billing profile
│   │   ├── contacts/       # Referents linked to clients/projects
│   │   ├── dashboard/      # Annual and historical dashboards
│   │   ├── expenses/       # Expenses and km flows
│   │   ├── cloudinary/     # Cloudinary upload/media integration
│   │   ├── filters/        # Shared filter helpers (FilterPopover, FilterSection)
│   │   ├── invoicing/      # Internal invoice draft (no DB write)
│   │   ├── layout/         # App layout components
│   │   ├── login/          # Authentication pages
│   │   ├── misc/           # Shared utilities (CreateSheet, FormToolbar, formatDateRange)
│   │   ├── payments/       # Payment tracking
│   │   ├── projects/       # Projects
│   │   ├── providers/      # Data providers (Supabase runtime modules)
│   │   ├── quotes/         # Quotes and commercial flow
│   │   ├── root/           # Root CRM component (CRM.tsx, moduleRegistry, config)
│   │   ├── sales/          # User profile / auth support
│   │   ├── services/       # Work log / service records
│   │   ├── settings/       # Settings page
│   │   ├── simple-list/    # Lightweight list primitives
│   │   ├── suppliers/      # Supplier registry
│   │   ├── tags/           # Tag management
│   │   ├── tasks/          # Reminders
│   │   ├── travel/         # Travel and km helpers
│   │   └── workflows/      # Trigger-based automations
│   ├── supabase/           # Supabase-specific auth components
│   └── ui/                 # Shadcn UI components (mutable dependency)
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions
└── App.tsx                 # Application entry point

supabase/
├── functions/              # Edge functions (AI, import, email, backend flows)
└── migrations/             # Database migrations
```

### Key Architecture Patterns

For repo-specific continuity, follow the reading order in `docs/README.md`
(sezione "Reading Order For AI Or New Sessions").

#### Mutable Dependencies

The codebase includes mutable dependencies that should be modified directly if needed:
- `src/components/admin/`: Shadcn Admin Kit framework code
- `src/components/ui/`: Shadcn UI components

#### Configuration via `<CRM>` Component

The `src/App.tsx` file renders the `<CRM>` component. In this repo the active
configuration contract is aligned with `ConfigurationContext` and
`defaultConfiguration`, not the old upstream Atomic CRM props list.

Active configuration keys (managed via `ConfigurationContext` and persisted
in the `settings` table):

- `title`
- `darkModeLogo`
- `lightModeLogo`
- `taskTypes`
- `noteStatuses`
- `quoteServiceTypes`
- `serviceTypeChoices`
- `operationalConfig.defaultKmRate`
- `operationalConfig.defaultTravelOrigin`
- `fiscalConfig.*`
- `aiConfig.historicalAnalysisModel`
- `aiConfig.invoiceExtractionModel`
- `businessProfile.*` (emitter identity: name, P.IVA, CF, IBAN, address, etc.)
- `googleWorkplaceDomain`
- `disableEmailPasswordAuthentication`

Note: `disableTelemetry` is a CRM component prop inherited from upstream
Atomic CRM, not a `ConfigurationContext` key. It defaults to `false` and is
not exposed in Settings.

If this contract changes, also update:
- `src/components/atomic-crm/root/ConfigurationContext.tsx`
- `src/components/atomic-crm/root/defaultConfiguration.ts`
- `src/components/atomic-crm/settings/SettingsPage.tsx`
- the relevant settings section in `src/components/atomic-crm/settings/**`

#### Database Views

Complex queries are handled via database views to simplify frontend code and reduce HTTP overhead. Current important views include `project_financials`, `monthly_revenue`, and the `analytics_*` views used by dashboards and AI contexts.

#### Database Triggers

User data syncs between Supabase's `auth.users` table and the CRM's `sales`
table via triggers. The baseline lives in
`supabase/migrations/20240730075425_init_triggers.sql` and later auth/SSO
adjustments also touch the same flow in
`supabase/migrations/20260128165057_sso_handling.sql`.

#### Edge Functions

Located in `supabase/functions/`:
- AI answer/extraction flows
- document import confirmation
- email send flows and other multi-step backend actions

#### Data Providers

The active development/runtime provider is:
1. **Supabase** (default): Production backend using PostgreSQL

The FakeRest/demo provider has been removed from this repository. Development,
QA, smoke validation and docs must assume the real Supabase-backed runtime only.

#### Filter Syntax

List filters follow the `ra-data-postgrest` convention with operator
concatenation: `field_name@operator` (e.g., `first_name@eq`).

## Development Workflows

### Path Aliases

The project uses TypeScript path aliases configured in `tsconfig.json` and `components.json`:
- `@/components` → `src/components`
- `@/lib` → `src/lib`
- `@/hooks` → `src/hooks`
- `@/components/ui` → `src/components/ui`

### Adding Custom Fields

When modifying active CRM data structures:
1. Create a migration: `npx supabase migration new <name>`
2. Update `src/components/atomic-crm/types.ts`
3. Update the Supabase provider
4. Update affected views or Edge Functions
5. Update affected UI surfaces: list/create/edit/show, filters, dialogs, linking helpers
6. Update continuity docs in `docs/`
7. Update `Settings` too if the change is config-driven

### Running with Test Data

Use only the real Supabase-backed workflow for development and validation.
The repository no longer ships a FakeRest/demo provider.

### Git Hooks

- Pre-commit: Automatically runs `make registry-gen` to update `registry.json`

### Accessing Local Services During Development

- Frontend: http://localhost:5173/
- Supabase Dashboard: http://localhost:55323/
- REST API: http://127.0.0.1:55321
- Storage (attachments): http://localhost:55323/project/default/storage/buckets/attachments
- Inbucket (email testing): http://localhost:55324/
- questo repo usa porte locali `5532x` per convivere con altri stack Supabase
  gia' presenti in Docker senza fermarli o sovrascriverli
- in sviluppo locale, `.env.local` e `.env.development` devono puntare al
  Supabase locale su `127.0.0.1:55321`
- `.env.production` resta dedicato al progetto remoto
- `make start` avvia Supabase locale e bootstrapa un admin locale autenticabile
- dopo un `npx supabase db reset`, se serve il login locale, eseguire anche
  `npm run local:admin:bootstrap`
- nel runtime locale il provider email/password Supabase e' abilitato per
  permettere bootstrap admin e smoke E2E; non e' una regola del remoto
- `make supabase-reset-database` esegue: reset schema (migration), load
  domain seed da `supabase/seed_domain_data.sql` (dump del DB remoto),
  bootstrap admin locale
- la suite Playwright corrente usa dati tecnici deterministici generati da
  `tests/e2e/support/test-data-controller.ts` per regressioni UI ripetibili
- quei dati tecnici NON sono fonte di verita' del dominio
- validazione semantica/fiscale e verifiche manuali devono usare il dataset
  locale ricostruito via `make supabase-reset-database`
- default admin locale:
  - email `admin@gestionale.local`
  - password `LocalAdmin123!`
- override opzionali in `.env.local`:
  - `LOCAL_SUPABASE_ADMIN_EMAIL`
  - `LOCAL_SUPABASE_ADMIN_PASSWORD`

## Important Notes

- The codebase is intentionally customized beyond upstream Atomic CRM
- Modify files in `src/components/admin` and `src/components/ui` directly - they are meant to be customized
- Unit tests can be added in the `src/` directory (test files are named `*.test.ts` or `*.test.tsx`)
- User deletion is not supported to avoid data loss; use account disabling instead
- `progress.md` and `learnings.md` are legacy archives, not the primary entry point for new sessions
