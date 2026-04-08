# Hatch CRM

A construction-focused CRM built on [Atomic CRM](https://github.com/marmelab/atomic-crm) with React, react-admin, shadcn/ui, and Supabase. Built for [Hatch Theory](https://hatchtheory.com) to manage leads, deals, and client relationships in the trades and home services space.

**Live:** [hatch-crm.vercel.app](https://hatch-crm.vercel.app)

## Architecture Overview

```
Browser (React SPA)
    |
    ├── Supabase JS Client (REST + Auth)
    |       |
    |       └── Supabase (hosted)
    |               ├── PostgreSQL (public schema)
    |               ├── Auth (Supabase Auth)
    |               ├── Storage (private attachments bucket)
    |               └── Edge Functions (lead ingestion)
    |
    ├── n8n (workflow automation)
    |       └── Postgres pooler (port 6543)
    |
    └── Audit System (separate Vercel app)
            └── Supabase JS Client (service role key)
```

**Key layers:**
- **Interface:** React + react-admin + shadcn/ui. Mobile-responsive with dedicated mobile navigation.
- **Logic:** Supabase DataProvider handles all CRUD. Configuration singleton in DB drives pipeline stages, categories, branding.
- **Data:** PostgreSQL on Supabase. Core tables use bigint PKs (inherited from Atomic CRM). New Hatch tables use UUID PKs.
- **Integrations:** n8n connects via Postgres pooler. Audit System and Edge Functions use Supabase JS client.

## Setup

### Prerequisites

- Node.js 22 LTS
- npm
- A Supabase project (or use the existing one)

### Install and Run

```sh
git clone https://github.com/nathansrm/hatch-crm.git
cd hatch-crm
npm install
```

Create a `.env` file (see Environment Variables below), then:

```sh
npm run dev          # Start dev server at http://localhost:5173
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL (e.g., `https://<ref>.supabase.co`) |
| `VITE_SB_PUBLISHABLE_KEY` | Yes | Supabase anon/public key |
| `VITE_IS_DEMO` | No | Set to `true` for demo mode with FakeRest provider |
| `VITE_INBOUND_EMAIL` | No | Postmark inbound email address for email capture |
| `VITE_ATTACHMENTS_BUCKET` | No | Storage bucket name (default: `attachments`) |

For edge functions, see `supabase/functions/.env`.

### Commands

```sh
npm run dev            # Dev server (http://localhost:5173)
npm run build          # Production build (tsc + vite)
npm run typecheck      # TypeScript check only
npm run lint           # ESLint check
npm run test:unit:app  # Vitest unit tests
```

Supabase CLI:

```sh
npx supabase db push           # Push migrations to remote
npx supabase db diff           # Generate migration diff
npx supabase functions deploy  # Deploy edge functions
```

## Database Schema

### Core Tables (bigint PKs, from Atomic CRM)

| Table | Purpose |
|-------|---------|
| `companies` | Client companies. Extended with trade_type, service_area, company_size, tech_maturity. |
| `contacts` | People at companies. Extended with lead_source_id. |
| `deals` | Sales pipeline items. Extended with lost_reason. |
| `deal_notes` | Notes attached to deals. |
| `contact_notes` | Notes attached to contacts. |
| `sales` | CRM users (linked to Supabase Auth). |
| `tags` | Contact tags (colors + names). |
| `tasks` | Follow-up tasks linked to contacts. |
| `configuration` | Singleton row — pipeline stages, branding, categories. |

### Lookup Tables (UUID PKs)

| Table | Purpose |
|-------|---------|
| `trade_types` | Construction trade classifications (e.g., Plumbing, HVAC). Referenced by companies. |
| `lead_sources` | Where contacts came from (e.g., Referral, Google). Referenced by contacts. |

### Join Tables (composite PKs)

| Table | Purpose |
|-------|---------|
| `contact_tags` | Many-to-many: contacts to tags. Normalized from `contacts.tags[]`. |
| `deal_contacts` | Many-to-many: deals to contacts. Normalized from `deals.contact_ids[]`. |

### System Tables (UUID PKs)

| Table | Purpose |
|-------|---------|
| `audit_results` | Results from AI audit system — scores, findings, classifications. |
| `audit_reports` | Generated audit report URLs and sharing metadata. |
| `n8n_workflow_runs` | Tracks n8n workflow execution history. |
| `integration_log` | All integration events (n8n, edge functions, external systems). |
| `system_settings` | Key-value system configuration. |

## Integration Documentation

### Who Reads/Writes Each Table

| Table | CRM UI | n8n | Audit System | Edge Functions |
|-------|--------|-----|--------------|----------------|
| `companies` | R/W | R | R | W (via lead ingestion) |
| `contacts` | R/W | R | R | W (via lead ingestion) |
| `deals` | R/W | R/W | -- | W (via lead ingestion) |
| `deal_notes` | R/W | -- | -- | -- |
| `contact_notes` | R/W | -- | -- | -- |
| `sales` | R/W | -- | -- | -- |
| `tags` | R/W | R | -- | -- |
| `tasks` | R/W | R | -- | -- |
| `contact_tags` | R/W | R | -- | -- |
| `deal_contacts` | R/W | R | -- | -- |
| `trade_types` | R/W | R | R | -- |
| `lead_sources` | R/W | R | -- | -- |
| `configuration` | R/W | -- | -- | -- |
| `audit_results` | R | -- | R/W | -- |
| `audit_reports` | R | -- | R/W | -- |
| `n8n_workflow_runs` | R | W | -- | -- |
| `integration_log` | R | W | -- | W |
| `system_settings` | R/W | R | -- | -- |

### Connection Methods

| Consumer | Method | Port | Auth |
|----------|--------|------|------|
| CRM UI (browser) | Supabase JS client | HTTPS | Anon key + user JWT |
| n8n | Postgres pooler (session mode) | 6543 | Database password |
| Audit System | Supabase JS client | HTTPS | Service role key |
| Edge Functions | Supabase JS client (internal) | HTTPS | Service role key |
| pg_dump (backups) | Direct Postgres | 5432 | Database password |

See [docs/n8n-integration.md](docs/n8n-integration.md) for detailed n8n setup instructions.

## Pipeline Stages

Lead → Qualified → Audit Scheduled → Proposal Sent → Won → Lost

Stages are stored in the `configuration` table and rendered by the Kanban board. Currency: CAD.

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/backup.sh` | Database backup via pg_dump. Outputs to `backups/`. |
| `scripts/health-check.sh` | Verify Supabase endpoints are responsive. |

Run with: `bash scripts/backup.sh` or `bash scripts/health-check.sh`

## Monitoring Checklist

Where to check when something goes wrong:

| Failure Type | Where to Look |
|-------------|---------------|
| Auth failures | Supabase Dashboard → Auth → Logs |
| RLS rejections | Supabase Dashboard → Database → Logs (filter for "policy") |
| Edge function errors | Supabase Dashboard → Edge Functions → Logs |
| n8n workflow failures | n8n execution history + `n8n_workflow_runs` table |
| Integration events | `integration_log` table (query by source, action, created_at) |
| Build/deploy failures | Vercel → Deployments → Build Logs |
| Database performance | Supabase Dashboard → Database → Query Performance |

## Testing

Unit tests use Vitest:

```sh
npm run test:unit:app        # Application tests
npm run test:unit:functions  # Edge function tests
```

E2e tests use Playwright (see `playwright.config.ts`).

## Key Files

| File | Purpose |
|------|---------|
| `src/components/atomic-crm/root/CRM.tsx` | App composition root |
| `src/components/atomic-crm/root/defaultConfiguration.ts` | Compile-time config fallbacks |
| `src/components/atomic-crm/providers/supabase/dataProvider.ts` | All Supabase CRUD operations |
| `src/components/atomic-crm/providers/supabase/authProvider.ts` | Auth logic |
| `supabase/schemas/` | Source-of-truth SQL definitions |
| `supabase/migrations/` | Ordered migration files |
| `supabase/functions/ingest-lead/` | Lead ingestion edge function |

## Credits

Forked from [Atomic CRM](https://github.com/marmelab/atomic-crm) by [Marmelab](https://marmelab.com). Licensed under MIT — see [LICENSE.md](./LICENSE.md).
