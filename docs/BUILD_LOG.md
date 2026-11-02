# Build log: lead-calling and WhatsApp follow-up system

Branch: `feature/lead-calling` (forked from `main`; the first commit is the
pre-existing uncommitted work, kept as a baseline so each phase commit only
contains that phase).

Resume rule: read this file top to bottom, then continue with the first phase
whose status is not `done`.

## Status

| Phase | Status |
|---|---|
| 1. Foundation (roles, lead fields, import, access) | in progress |
| 2. Daily call engine | todo |
| 3. Retry, recycle pool, auto-replacement | todo |
| 4. Brochure + WhatsApp approval | todo |
| 5. WhatsApp sending and delivery log | todo |
| 6. Manager dashboard and reports | todo |
| 7. UI redesign | todo |
| 8. QA and hardening | todo |

## Domain model (decisions)

- **A lead is a contact** (`contacts` row). Its company carries the industry
  (`companies.sector`) and the pitch script (`companies.pitch_point`). Deals are
  unchanged and stay optional (an interested lead can be turned into a deal).
- **Roles**: `sales.role` (`admin` | `manager` | `bde`). The legacy
  `sales.administrator` flag is kept and synced by a trigger
  (`administrator = (role = 'admin')`), so the `users` edge function, the
  configuration policies and existing code keep working. Existing non-admin
  users are migrated to `manager` (they keep the full access they had);
  newly invited users default to `bde`.
- **Lead owner**: `contacts.assigned_to` (the BDE currently holding the lead)
  is separate from `contacts.sales_id` (account manager / creator).
- **Permissions live in the database**: helper functions `crm_role()`,
  `current_sales_id()`, `is_manager()` (security definer, return null / false
  for disabled users, so a disabled account loses all row access at once, even
  with a still-valid JWT). RLS rules:
  - admin / manager: everything (configuration writes stay admin-only).
  - bde: contacts where `assigned_to = me` or `sales_id = me`; companies of
    those contacts or created by them; notes / tasks of visible contacts;
    deals where `sales_id = me`; read-only sales list, tags, sectors.
- **Business rules are configuration**, stored in `configuration.config.callEngine`
  (`dailyCallQuota` 25, `retryWindowWorkingDays` 3, `timezone` Asia/Kolkata,
  `workingDays` [1..5] (ISO, Mon=1), `holidays` [], `recycleCooldownDays` 7,
  `assignmentTime` "08:30"). SQL reads them through
  `call_engine_settings()` which falls back to these defaults.
- **No new libraries** so far. Phone normalization (E.164, default India) is a
  small in-house function instead of `libphonenumber-js`: it covers Indian
  mobile/landline formats and `+<country>` input; documented limitation: it
  does not validate per-country number plans.

## Phase 1 plan

| Item | Files |
|---|---|
| Roles + sync trigger + helpers | `supabase/schemas/01_tables.sql`, `02_functions.sql`, `04_triggers.sql` |
| RLS by role, anon grant sweep, storage policies | `05_policies.sql`, `06_grants.sql`, `07_storage.sql` |
| Lead lifecycle columns, `import_batches`, view | `01_tables.sql`, `03_views.sql`, `types.ts`, fakerest generators |
| Lead import RPC (server dedupe) + client normalizer | `02_functions.sql` (`import_leads`), `src/components/atomic-crm/leads/leadImport*.ts`, `LeadImportPage.tsx`, both data providers |
| Non-blocking enrichment | `handle_contact_saved` / `handle_company_saved` skip HTTP when `crm.skip_enrichment` is set (import sets it); backfill job in phase 2 scheduler |
| Disabled / role cache | `providers/supabase/authProvider.ts` (cache TTL + re-check on sensitive actions) |
| Role-aware access + UI | `providers/commons/canAccess.ts`, both auth providers, `sales/SalesInputs.tsx`, `supabase/functions/users` |
| Settings | `root/ConfigurationContext.tsx`, `defaultConfiguration.ts`, `settings/SettingsPage.tsx` |

## Phase 2-8 expected files

- P2: `call_assignments`, `call_logs` tables, `assign_daily_calls()`,
  `record_call_outcome()`, pg_cron job, `calls/MyCallsPage.tsx`.
- P3: `workingDays.ts` (+ SQL twin `add_working_days()`), `sweep_recycle()`,
  `recycle/RecyclePoolPage.tsx`.
- P4: `lead_brochures` table, `supabase/functions/brochure_push`,
  `approvals/WhatsAppApprovalPage.tsx`, `review_brochure()` RPC.
- P5: `whatsapp_messages`, `supabase/functions/send_whatsapp`,
  `supabase/functions/whatsapp_webhook`, `.env.example`.
- P6: `reports/` module, role dashboards.
- P7: `src/index.css` tokens, layout/sidebar, tables, lead page.
- P8: `e2e/lead-calling.spec.ts`, RLS tests, seed, README, screenshots.

## Log

- 2026-11-02: baseline commit; plan written.
