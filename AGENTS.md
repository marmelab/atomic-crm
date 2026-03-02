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

## COMMUNICATION CONVENTION

- comunicare con l'utente in ITALIANO
- scrivere codice, commenti, nomi variabili e commit in ENGLISH
- non spiegare concetti base quando non servono

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

- il rebuild del dominio locale parte da dati reali importati da
  `Fatture/`
- per Diego/Gustare, i dettagli non presenti nelle fatture vanno letti da
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
make test-e2e         # Run Playwright smoke tests on the local real stack after the local domain is aligned with real source data
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
│   │   ├── layout/         # App layout components
│   │   ├── login/          # Authentication pages
│   │   ├── payments/       # Payment tracking
│   │   ├── providers/      # Data providers (Supabase active + FakeRest legacy scaffolding)
│   │   ├── projects/       # Projects
│   │   ├── quotes/         # Quotes and commercial flow
│   │   ├── root/           # Root CRM component
│   │   ├── services/       # Work log / service records
│   │   ├── settings/       # Settings page
│   │   ├── tags/           # Tag management
│   │   ├── tasks/          # Reminders
│   │   └── travel/         # Travel and km helpers
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

For repo-specific continuity, read first:

1. `docs/README.md`
2. `docs/development-continuity-map.md`
3. `docs/historical-analytics-handoff.md`
4. `docs/architecture.md`

#### Mutable Dependencies

The codebase includes mutable dependencies that should be modified directly if needed:
- `src/components/admin/`: Shadcn Admin Kit framework code
- `src/components/ui/`: Shadcn UI components

#### Configuration via `<CRM>` Component

The `src/App.tsx` file renders the `<CRM>` component. In this repo the active
configuration contract is aligned with `ConfigurationContext` and
`defaultConfiguration`, not the old upstream Atomic CRM props list.

Important active props/config keys include:
- `title`
- `darkModeLogo`
- `lightModeLogo`
- `taskTypes`
- `noteStatuses`
- `quoteServiceTypes`
- `serviceTypeChoices`
- `operationalConfig.defaultKmRate`
- `fiscalConfig.*`
- `aiConfig.historicalAnalysisModel`
- `aiConfig.invoiceExtractionModel`
- `googleWorkplaceDomain`
- `disableEmailPasswordAuthentication`
- `disableTelemetry`

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

`FakeRest` remains in the repo only as legacy internal scaffolding for isolated
tests or migration support. It is **not** a supported development/QA workflow
for this product anymore.

If FakeRest scaffolding is touched, database views are emulated in the
frontend. Test data generators remain in
`src/components/atomic-crm/providers/fakerest/dataGenerator/`.

#### Filter Syntax

List filters follow the `ra-data-postgrest` convention with operator
concatenation: `field_name@operator` (e.g., `first_name@eq`). The FakeRest
adapter still maps these to FakeRest syntax if legacy scaffolding is used.

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
3. Update Supabase provider and only the FakeRest scaffolding if that legacy
   path is still touched by the same change
4. Update affected views or Edge Functions
5. Update affected UI surfaces: list/create/edit/show, filters, dialogs, linking helpers
6. Update continuity docs in `docs/`
7. Update `Settings` too if the change is config-driven

### Running with Test Data

Use only the real Supabase-backed workflow for development and validation.
FakeRest/demo is not a supported local workflow anymore.

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
- `make start` e `npx supabase db reset` ricreano automaticamente un admin
  locale autenticabile
- nel runtime locale il provider email/password Supabase e' abilitato per
  permettere bootstrap admin e smoke E2E; non e' una regola del remoto
- `make start`, `make supabase-reset-database` e `make test-e2e` si appoggiano
  al rebuild locale del dominio basato su:
  - `Fatture/`
  - `Fatture/contabilità interna - diego caltabiano/`
- i browser smoke devono leggere e scrivere sul dataset locale ricostruito,
  non su fixture dominio hardcoded
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
- Filter operators must still be supported by the `supabaseAdapter` if legacy
  FakeRest scaffolding is touched
- `progress.md` and `learnings.md` are legacy archives, not the primary entry point for new sessions
