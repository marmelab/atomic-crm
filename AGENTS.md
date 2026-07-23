# AGENTS.md

## Project Overview

Atomic CRM is a full-featured CRM built with React, shadcn-admin-kit, and Turso (libSQL/SQLite). It provides contact management, task tracking, notes, and deal management with a Kanban board.

## Development Commands

### Setup
```bash
make install          # Install dependencies (npm)
make start            # Start the full stack (Turso API server + Vite dev server)
make start-server     # Start only the backend API server (server/index.mjs)
make start-app        # Start only the Vite dev server
make stop             # Stop the local backend API server
make start-demo       # Start the app in demo mode (in-browser FakeRest data)
```

### Testing and Code Quality

```bash
make test             # Run unit tests (vitest)
make typecheck        # Run TypeScript type checking
make lint             # Run ESLint and Prettier checks
```

### Building

```bash
make build            # Build production bundle (runs tsc + vite build)
```

### Database Management

The database runs on [Turso](https://turso.tech) (libSQL/SQLite). The schema (tables + views) lives in `db/schema.sql` and reference seed data in `db/seed.sql` — these are the source of truth. The backend provisions the schema automatically the first time it connects to an empty database; apply it manually (after editing it, or to a fresh database) with:

```bash
npm run db:apply        # apply db/schema.sql (+ seed) to $TURSO_DATABASE_URL
```

Backend DB credentials are read from `.env` (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`); see `.env.example`. Create a database and token with the Turso CLI:

```bash
turso db create <name>
turso db show <name> --url        # -> TURSO_DATABASE_URL
turso db tokens create <name>     # -> TURSO_AUTH_TOKEN
```

### Registry (Shadcn Components)

```bash
make registry-gen     # Generate registry.json (runs automatically on pre-commit)
make registry-build   # Build Shadcn registry
```

## Architecture

### Technology Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Routing**: React Router v7
- **Data Fetching**: React Query (TanStack Query)
- **Forms**: React Hook Form
- **Application Logic**: shadcn-admin-kit + ra-core (react-admin headless)
- **UI Components**: Shadcn UI + Radix UI
- **Styling**: Tailwind CSS v4
- **Backend**: Turso (libSQL/SQLite) accessed through a small Hono API server (`server/`); single-user with no real login; file attachments stored as base64 in the database
- **Testing**: Vitest

### Directory Structure

```
src/
├── components/
│   ├── admin/              # Shadcn Admin Kit components (mutable dependency)
│   ├── atomic-crm/         # Main CRM application code (~15,000 LOC)
│   │   ├── activity/       # Activity logs
│   │   ├── companies/      # Company management
│   │   ├── contacts/       # Contact management (includes CSV import/export)
│   │   ├── dashboard/      # Dashboard widgets
│   │   ├── deals/          # Deal pipeline (Kanban)
│   │   ├── filters/        # List filters
│   │   ├── layout/         # App layout components
│   │   ├── login/          # Authentication pages
│   │   ├── misc/           # Shared utilities
│   │   ├── notes/          # Note management
│   │   ├── providers/      # Data providers (Turso + FakeRest)
│   │   ├── root/           # Root CRM component
│   │   ├── sales/          # Sales team management
│   │   ├── settings/       # Settings page
│   │   ├── simple-list/    # List components
│   │   ├── tags/           # Tag management
│   │   └── tasks/          # Task management
│   └── ui/                 # Shadcn UI components (mutable dependency)
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions
└── App.tsx                 # Application entry point

db/                         # SQLite schema + seed for Turso (schema.sql, seed.sql, apply-schema.mjs)
server/                     # Node/Hono API server over libSQL/Turso (index.mjs + helpers)
```

### Key Architecture Patterns

For more details, check out the doc/src/content/docs/developers/architecture-choices.mdx document.

#### Mutable Dependencies

The codebase includes mutable dependencies that should be modified directly if needed:
- `src/components/admin/`: Shadcn Admin Kit framework code
- `src/components/ui/`: Shadcn UI components

#### Configuration via `<CRM>` Component

The `src/App.tsx` file renders the `<CRM>` component, which accepts props for domain-specific configuration:
- `contactGender`: Gender options
- `companySectors`: Company industry sectors
- `dealCategories`, `dealStages`, `dealPipelineStatuses`: Deal configuration
- `noteStatuses`: Note status options with colors
- `taskTypes`: Task type options
- `logo`, `title`: Branding
- `lightTheme`, `darkTheme`: Theme customization
- `disableTelemetry`: Opt-out of anonymous usage tracking

#### Database Views

Complex queries are handled via SQLite views (defined in `db/schema.sql`) to simplify frontend code and reduce round-trips. `companies_summary` and `contacts_summary` expose aggregated columns (contact/deal counts, open-task count, company name, and full-text-search helpers extracted from the email/phone JSON). The frontend reads them by redirecting `getList`/`getOne` for `companies`/`contacts` to the matching `_summary` view (writes still go to the base tables).

#### Backend API Server

`server/` is a small [Hono](https://hono.dev) app (`server/index.mjs`) exposing a generic data endpoint (`POST /api/:resource/:method`) that mirrors the react-admin DataProvider methods, backed by `@libsql/client` against Turso. It translates the app's `field@operator` filters to SQL (`server/filter.mjs`), (de)serializes JSON/boolean columns per `server/resources.mjs`, and cascades deletes. In production it also serves the built `dist/` from the same process. There is no separate auth service, object storage, or serverless-function layer: the app is single-user with no real login, attachments are stored as base64 in the database, and the former Supabase edge functions (user management, inbound email) were dropped.

#### Data Providers

Two data providers are available (`src/components/atomic-crm/providers/`):
1. **Turso** (default): talks over HTTP (`/api`) to the backend server, which runs SQL against Turso. See `providers/turso/` (`dataProvider.ts`, `authProvider.ts`, `internal/httpClient.ts`).
2. **FakeRest**: in-browser fake API for demos, resets on page reload.

Both emulate the same `contacts_summary` / `companies_summary` / `activity_log` shapes so the UI is identical. FakeRest test-data generators are in `providers/fakerest/dataGenerator/`.

#### Filter Syntax

List filters follow the `ra-data-postgrest` convention with operator concatenation: `field_name@operator` (e.g., `first_name@ilike`, `id@in`, `tags@cs`). The Turso backend translates these to SQL (`server/filter.mjs`); the FakeRest adapter maps them to FakeRest syntax at runtime.

## Development Workflows

### Path Aliases

The project uses TypeScript path aliases configured in `tsconfig.json` and `components.json`:
- `@/components` → `src/components`
- `@/lib` → `src/lib`
- `@/hooks` → `src/hooks`
- `@/components/ui` → `src/components/ui`

### Adding Custom Fields

When modifying contact or company data structures:
1. Edit `db/schema.sql`: add the column to the table AND to the related view (`contacts_summary` / `companies_summary`). If the column stores JSON or a boolean, register it in `server/resources.mjs` so the backend (de)serializes it correctly.
2. Apply the schema: `npm run db:apply`
3. Update the sample CSV: `src/components/atomic-crm/contacts/contacts_export.csv`
4. Update the import function: `src/components/atomic-crm/contacts/useContactImport.tsx`
5. If using FakeRest, update data generators in `src/components/atomic-crm/providers/fakerest/dataGenerator/`
6. Don't forget the export functions and the contact merge logic

### Running with Test Data

Import `test-data/contacts.csv` via the Contacts page → Import button.

### Git Hooks

- Pre-commit: Automatically runs `make registry-gen` to update `registry.json`

### Accessing Local Services During Development

- Frontend (Vite dev server): http://localhost:5173/
- Backend API: http://localhost:3001/api (the frontend proxies `/api` here — see `vite.config.ts`)
- Turso database: inspect with `turso db shell <name>` or the Turso dashboard (https://turso.tech)

## Important Notes

- The codebase is intentionally small (~15,000 LOC in `src/components/atomic-crm`) for easy customization
- Modify files in `src/components/admin` and `src/components/ui` directly - they are meant to be customized
- Unit tests can be added in the `src/` directory (test files are named `*.test.ts` or `*.test.tsx`)
- User deletion is not supported to avoid data loss; use account disabling instead
- Filter operators must be supported by the Turso backend (`server/filter.mjs`), and — for demo mode — by the FakeRest `supabaseAdapter`
