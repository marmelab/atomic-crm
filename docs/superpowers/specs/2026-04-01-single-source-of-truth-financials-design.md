# Single Source of Truth — Financial Position

**Date:** 2026-04-01
**Status:** Implementation-ready
**Scope:** Eliminate multiple competing financial calculations across project/client surfaces, AI, invoice drafts, and quick payments. Establish database views as the single canonical source.

---

## Problem Statement

The CRM calculates "how much does the client owe" in at least 3 different ways depending on which page you open:

1. **Project card** reads `project_financials` view (dual-path: foundation docs OR legacy payments)
2. **Client card** recalculates manually from raw `payments` table, filtered by `client_name` (not `client_id`)
3. **AI snapshot** does a third independent calculation from raw tables
4. **Invoice drafts** use yet another partial calculation (client draft ignores payments and expenses; project draft ignores expenses)
5. **Quick payment** suggests full expense total for `rimborso_spese` instead of remaining
6. **AI parser** conflates `rimborso` (refund to client) with `rimborso_spese` (expense reimbursement)

Same reality, different numbers depending on the surface.

## Decision Record

- **Single source**: `payments` table is the only source for "total paid". Always.
- **Foundation documents** (`financial_documents`, `cash_movements`, allocations) remain for invoice/document tracking but no longer influence commercial position calculations.
- **Billable expenses**: all expenses linked to a project/client are billable. No flag needed.
- **"Da fatturare"**: stays out of the canonical views. Calculated only in invoice draft builders where needed.
- **Billable expenses is a domain assumption**: this CRM is single-user, freelance. Every expense linked to a client/project is borne by the client. If this assumption ever changes (e.g., internal non-billable expenses), a `billable` flag on `expenses` would be needed. For now, no flag.

---

## Invariants

These rules are non-negotiable. Every consumer, every surface, every test must respect them:

1. No consumer recalculates commercial totals — views are the single source.
2. `client_id` is the only valid client join key. Never `client_name`.
3. `payments.status = 'ricevuto'` is the only contributor to `total_paid`.
4. `rimborso` reduces `total_paid`; every other payment type increases it.
5. `project_financials` is canonical for project-level commercial position.
6. `client_commercial_position` is canonical for client-level commercial position.
7. `balance_due` negative = client overpayment or credit, not an error. UI shows it as "Credito cliente", AI describes it as such.
8. All monetary fields are `ROUND(..., 2)` at the final projection in the views, not inside partial sums (avoids cumulative rounding drift). Consumers do not re-round.

---

## Record Precedence Rules

| Case                                                      | Rule                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------- |
| `project_id` present                                      | `client_id` derived from `projects.client_id` (authoritative) |
| Only `client_id` present (`project_id IS NULL`)           | Record included in client view as orphan                      |
| Both `project_id` and `client_id` null                    | Excluded from canonical views                                 |
| `client_id` on record mismatches `projects.client_id`     | Project's `client_id` prevails; data quality issue to log     |

For the views: services, expenses, and payments with `project_id` set JOIN to `projects` to get the canonical `client_id`. Records without `project_id` use their own `client_id` directly.

---

## Naming Conventions

To avoid ambiguity between similarly named fields:

- `total_services` = COUNT of service records (integer, not money)
- `total_fees` = SUM of service compensation (money)
- `total_expenses` = SUM of billable expenses (money)
- `total_owed` = `total_fees + total_expenses` (money) — only in `client_commercial_position`
- `total_paid` = SUM of received payments with sign logic (money)
- `balance_due` = `total_owed - total_paid` or `total_fees + total_expenses - total_paid` (money)

`total_services` is never used in monetary calculations. `total_fees` is always money.

---

## Canonical Formula

```
total_fees     = SUM(fee_shooting + fee_editing + fee_other - discount)
total_expenses = SUM(expense_amount)
                 where: credito_ricevuto     -> -amount
                        spostamento_km       -> km_distance * km_rate
                        other                -> amount * (1 + markup_percent / 100)
total_owed     = total_fees + total_expenses
total_paid     = SUM(payment.amount) WHERE status = 'ricevuto'
                 where: rimborso -> -amount
                        all others -> +amount
balance_due    = total_owed - total_paid
```

This formula exists in ONE place: the database views. No surface recalculates it.

---

## Database Changes

### 1. Rewrite `project_financials` view

Remove the dual-path payment logic. Simplify to:

**CTEs:**
- `service_view`: aggregates fees per project (unchanged)
- `expense_view`: aggregates expenses per project (unchanged)
- `payment_view`: aggregates payments per project — ALWAYS from `payments` table, `status = 'ricevuto'`, rimborso sign inversion

**Remove:**
- `legacy_payment_view` CTE
- `foundation_payment_view` CTE
- `foundation_document_view` CTE
- `CASE WHEN fdv.project_id IS NOT NULL` conditional logic
- `payment_semantics_basis` column
- `total_paid_foundation` / `total_paid_legacy` intermediate values
- `documented_outbound_total` / `documented_inbound_total` columns

**Columns retained:**
- `project_id`, `project_name`, `client_id`, `client_name`, `category`
- `total_services`, `total_fees`, `total_km`, `total_km_cost`
- `total_expenses`, `total_owed`, `total_paid`, `balance_due`

`total_owed = total_fees + total_expenses` is computed in the view so no consumer ever recalculates it. Symmetric with `client_commercial_position`.

**New column:**
- `client_id` — added via JOIN to `projects.client_id` (currently the view exposes `client_name` but not `client_id`)

### 2. New view `client_commercial_position`

Aggregates project-level data + client-level orphans (services/expenses/payments without a project).

**Columns:**

- `client_id` (logical unique key for the view)
- `client_name`
- `total_fees` — SUM across projects + direct client services
- `total_expenses` — SUM across projects + direct client expenses
- `total_owed` — total_fees + total_expenses
- `total_paid` — SUM across ALL client payments (status='ricevuto', rimborso negative)
- `balance_due` — total_owed - total_paid
- `projects_count` — COUNT(DISTINCT project_id) from canonicalized rows that have at least one financial record (service, expense, or payment). This is NOT the total projects for the client, only those with financial activity.

**Implementation approach:** the view aggregates independently from the source tables (services, expenses, payments) for a given `client_id`, NOT by summing `project_financials` rows. This ensures client-level orphans (services/expenses/payments where `project_id IS NULL`) are included, and avoids double-counting or missing data from view-to-view aggregation.

**Concretely, following Record Precedence Rules:**

For each source table (`services`, `expenses`, `payments`), the view canonicalizes `client_id` in two steps:

1. Records with `project_id` set: JOIN to `projects`, use `projects.client_id` as the canonical client (not the record's own `client_id`)
2. Records without `project_id` (`project_id IS NULL`): use the record's own `client_id` directly

Then aggregate by canonical `client_id`:

- `total_fees` = SUM of canonicalized service rows
- `total_expenses` = SUM of canonicalized expense rows
- `total_paid` = SUM of canonicalized payment rows (status='ricevuto', rimborso negative)
- `total_owed` = total_fees + total_expenses
- `balance_due` = total_owed - total_paid
- `projects_count` = COUNT(DISTINCT project_id) from canonicalized rows WHERE project_id IS NOT NULL

---

## Consumer Changes

### Client Card (`ClientFinancialSummary.tsx`)

**Before:** 4 separate fetches (project_financials by client_name, payments, expenses, services) + manual aggregation in React.
**After:** Single fetch from `client_commercial_position` by `client_id`. Zero calculation in React.

### Project Card (`ProjectShow.tsx`)

**Before:** reads `project_financials` — already correct.
**After:** no functional change. The view simplifies underneath but exposes the same columns (minus `payment_semantics_basis` and `documented_*` columns). Remove any UI references to removed columns.

### AI Snapshot (`unifiedCrmFinancialSummaries.ts`)

**Before:** `buildProjectFinancialSummaries()` and `buildClientFinancialSummaries()` recalculate from raw tables.
**After:** Both functions become mappers that read `project_financials` and `client_commercial_position` from the dataProvider. Same snapshot shape for downstream AI, different (canonical) source.

### AI Invoice Draft (`unifiedCrmAnswerCreateFlows.ts`)

**Before:** `getClientFinancials()` reads snapshot without expenses.
**After:** Snapshot now includes `totalExpenses` (from view). AI markdown shows: Compensi, Spese, Gia pagato, Da saldare.

### Quick Payment (`QuickPaymentDialog.tsx`)

**Before:** `rimborso_spese` suggests `totals.expenses` (full amount).
**After:** `rimborso_spese` suggests `totals.expenses - SUM(received rimborso_spese payments for this project)`. The dialog already fetches project payments — filter by `payment_type='rimborso_spese'` and `status='ricevuto'`, subtract from total expenses.

### Payment Draft Card (`PaymentDraftCard.tsx`)

**Before:** project quick payment excludes `parziale`.
**After:** unified set for all origins: `acconto`, `saldo`, `parziale`, `rimborso_spese`.

### AI Payment Type (`UnifiedCrmPaymentDraft` + parser)

**Before:** type excludes `rimborso`. Parser maps "rimborso" to `rimborso_spese`.
**After:**
- Type adds `rimborso` to the union.
- Parser checks longest match first: "rimborso spese" / "spes" -> `rimborso_spese`; "rimborso" alone -> `rimborso`.

### Invoice Draft — Client (`buildInvoiceDraftFromClient.ts`)

**Before:** only uninvoiced services, no payments, no expenses.
**After:**
- Adds line items for billable expenses (not yet invoiced)
- Adds negative line item for received payments (see sign rule below)

### Invoice Draft — Project (`buildInvoiceDraftFromProject.ts`)

**Before:** services + negative payment line, no expenses.
**After:** adds line items for project expenses (billable, not yet invoiced).

### Invoice Draft Sign Rule

The sign semantics used in canonical commercial views are NOT automatically reused in invoice line construction. Invoice draft builders define document-sign behavior explicitly per payment type:

- `acconto`, `saldo`, `parziale`, `rimborso_spese` received: negative line item (reduces amount to collect)
- `rimborso` received: this is money you returned to the client — it does NOT reduce the invoice amount. Rimborso payments are excluded from invoice draft line items entirely (they already reduced `total_paid` in the commercial position; including them as a positive line in the invoice would double-count).

This distinction exists because commercial position models cash effect (rimborso = less cash received) while invoice draft models what remains to bill (rimborso = already handled, not a billing event).

### Mobile Dashboard (`MobileDashboard.tsx`)

Where it shows client/project commercial position, reads from the canonical views instead of recalculating. Annual/monthly revenue calculations (from services) remain unchanged.

---

## Record States

Only records in these states participate in the canonical views:

- **Payments**: only `status = 'ricevuto'` contributes to `total_paid`. Payments with `status = 'in_attesa'` or `status = 'scaduto'` are excluded from commercial position (they represent expected, not realized, cash).
- **Services**: all services linked to a project/client participate in `total_fees`. There is no draft/confirmed distinction in the current schema.
- **Expenses**: all expenses linked to a project/client participate in `total_expenses`. There is no draft/archived state in the current schema.

If draft/archived states are introduced in the future, the views must be updated to filter them explicitly.

---

## Performance Considerations

The canonical views will be read frequently by: card progetto, card cliente, AI snapshot, quick payment dialog, mobile dashboard.

Indexes to verify exist (or create if missing):

- `payments(project_id, status, payment_type)` — for project-level payment aggregation
- `payments(client_id, status, payment_type)` — for client-level payment aggregation
- `expenses(project_id)` — for project expense aggregation
- `expenses(client_id)` — for client expense aggregation
- `services(project_id)` — for project fee aggregation
- `services(client_id)` — for client fee aggregation
- `projects(id, client_id)` — for client derivation from project

Given the data volume of this single-user CRM (hundreds, not millions of records), these views will perform well without materialization. If performance becomes an issue, materialized views with trigger-based refresh are a future option.

---

## What Does NOT Change

- `payments` table and CRUD
- The 5 payment types (acconto, saldo, parziale, rimborso_spese, rimborso)
- Sign logic: rimborso = negative, everything else = positive
- `financial_documents`, `cash_movements`, allocation tables — remain intact for document tracking
- `financial_documents_summary` view — unchanged
- `analytics_*` views — unchanged (they use services/payments directly for historical aggregation, which is correct for their purpose)
- Dashboard annual/historical KPIs — unchanged
- `monthly_revenue` view — unchanged

---

## Testing Strategy

### Principle: numeric snapshots before and after

Before any code change, capture current numbers from the local DB for every project and client. After each change, compare. Any difference must be explainable.

### Layer 1 — SQL (view correctness)

1. **Project parity**: for each project, new `project_financials` produces the same `balance_due` as old view (except projects with foundation docs — those change intentionally, documented per-project)
2. **Client parity**: `client_commercial_position` matches what `ClientFinancialSummary` currently calculates in React
3. **Rimborso sign**: insert a `rimborso` payment -> `total_paid` decreases, `balance_due` increases
4. **Client-level orphans**: services/expenses/payments without project are included in client view

### Layer 2 — TypeScript unit tests

5. **`unifiedCrmFinancialSummaries`**: mapper from view rows produces correct snapshot format
6. **`buildInvoiceDraftFromClient`**: with expenses and payments, produces correct line items (billable expenses + negative payment line)
7. **`buildInvoiceDraftFromProject`**: includes expense line items
8. **`QuickPaymentDialog` suggested amount**: `rimborso_spese` suggests remaining expenses, not gross total
9. **`inferPreferredPaymentType`**: "rimborso" -> `rimborso`, "rimborso spese" -> `rimborso_spese`

### Layer 3 — E2E smoke

10. **Project card**: open a project with payments, verify numbers match view
11. **Client card**: open client, verify fees/expenses/paid/balance match
12. **Quick payment**: open rimborso_spese dialog, verify suggested amount is coherent
13. **AI**: ask "quanto deve ClienteX?" -> number matches card

### Layer 4 — Edge cases

1. **Overpayment**: total_paid > total_owed -> `balance_due` negative, no crash, UI shows "Credito cliente", AI describes it correctly
2. **Zero rows**: client/project with no services, no expenses, no payments -> all totals = 0 (not null)
3. **Client/project mismatch**: payment with `project_id` pointing to project of client A but record `client_id` = client B -> view uses project's client_id, not payment's
4. **Partial reimbursement**: expenses = 300, rimborso_spese received = 100 -> quick payment suggests 200
5. **Mixed payment types**: acconto + saldo + parziale + rimborso_spese + rimborso on same project -> total_paid = sum with correct sign per type

### Out of scope for testing

- `financial_documents_summary` — unchanged
- Dashboard annual/historical — doesn't touch commercial position
- `analytics_*` views — unchanged
- Base payments CRUD — unchanged

---

## Migration Safety

The `project_financials` view rewrite is a `CREATE OR REPLACE VIEW` — no data loss, instantly rollbackable by re-running the old migration SQL.

The `client_commercial_position` is a new view — `DROP VIEW IF EXISTS` + `CREATE VIEW` in the migration.

Projects that currently use foundation payment path will see `total_paid` change to the legacy payments value. This is intentional and must be verified project-by-project on the local dataset before pushing to production.

---

## Implementation Notes

1. **COALESCE on all exposed aggregates**: every monetary field and every count field in both views must be wrapped in `COALESCE(..., 0)`. This guarantees zero-not-null at the SQL level, not just in tests.
2. **ROUND at final projection only**: `ROUND(..., 2)` applied once at the outermost SELECT, never inside CTEs or partial sums.
3. **Canonicalize client_id before aggregation**: in `client_commercial_position`, the UNION of project-linked and orphan records must resolve `client_id` BEFORE the GROUP BY, not after.
4. **Data quality diagnostic query before deploy**: run a query to find records where `payments.client_id != projects.client_id` (via `payments.project_id`), same for services and expenses. Document any mismatches. This is a manual pre-deploy check, not an app-level runtime log.

---

## File Impact Summary

| File | Change Type |
|------|------------|
| `supabase/migrations/YYYYMMDD_single_source_financials.sql` | New migration (rewrite view + new view) |
| `src/components/atomic-crm/clients/ClientFinancialSummary.tsx` | Major rewrite (view consumer) |
| `src/components/atomic-crm/projects/ProjectShow.tsx` | Minor (remove references to dropped columns) |
| `src/components/atomic-crm/projects/QuickPaymentDialog.tsx` | Minor (fix rimborso_spese suggestion) |
| `src/components/atomic-crm/ai/PaymentDraftCard.tsx` | Minor (unify payment type set) |
| `src/lib/ai/unifiedCrmFinancialSummaries.ts` | Major rewrite (view mapper, not calculator) |
| `src/lib/ai/unifiedCrmAssistant.ts` | Minor (add rimborso to type union) |
| `supabase/functions/_shared/unifiedCrmAnswerIntents.ts` | Minor (fix parser order) |
| `supabase/functions/_shared/unifiedCrmAnswerCreateFlows.ts` | Minor (expose expenses in AI markdown) |
| `src/components/atomic-crm/invoicing/buildInvoiceDraftFromClient.ts` | Medium (add expenses + payments) |
| `src/components/atomic-crm/invoicing/buildInvoiceDraftFromProject.ts` | Minor (add expense line items) |
| `src/components/atomic-crm/dashboard/MobileDashboard.tsx` | Minor (read from views where applicable) |
| `src/components/atomic-crm/types.ts` | Minor (add client_commercial_position type) |
| `docs/architecture.md` | Update (new view, removed dual-path) |
| `docs/development-continuity-map.md` | Update |
