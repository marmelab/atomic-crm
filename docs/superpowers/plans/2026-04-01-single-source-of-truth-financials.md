# Single Source of Truth — Financial Position — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all competing financial calculations — one formula, in the DB, all surfaces read from it.

**Architecture:** Rewrite `project_financials` view (remove dual-path, always use `payments` table), create new `client_commercial_position` view, then rewire all consumers (card cliente, AI snapshot, invoice drafts, quick payment, AI parser) to read from views instead of recalculating.

**Tech Stack:** PostgreSQL views (Supabase migrations), React/TypeScript consumers, Deno Edge Functions

**Spec:** `docs/superpowers/specs/2026-04-01-single-source-of-truth-financials-design.md`

---

## Task 0: Pre-flight — Capture numeric baseline

**Files:**
- Create: `scripts/financial-baseline-before.sql`
- Create: `scripts/financial-baseline-after.sql`
- Create: `scripts/financial-baseline-compare.sql`

**NOTE:** Baseline output files contain real client names and financial data. Do NOT commit them to the repo. Keep them local only (add to `.gitignore` if needed).

- [ ] **Step 1: Write BEFORE baseline query (old schema)**

```sql
-- scripts/financial-baseline-before.sql
-- Run BEFORE migration. Uses old schema columns.

-- Save project-level snapshot to persistent local table for cross-session comparison.
-- These tables survive across psql sessions so the migration can be applied separately.
CREATE SCHEMA IF NOT EXISTS _migration_baseline;

DROP TABLE IF EXISTS _migration_baseline.project_before;
CREATE TABLE _migration_baseline.project_before AS
SELECT
  project_id,
  project_name,
  client_name,
  total_fees,
  total_expenses,
  total_paid,
  balance_due,
  payment_semantics_basis
FROM project_financials
ORDER BY project_name;

-- Save client-level snapshot (replicates current ClientFinancialSummary.tsx logic)
DROP TABLE IF EXISTS _migration_baseline.client_before;
CREATE TABLE _migration_baseline.client_before AS
SELECT
  c.id AS client_id,
  c.name AS client_name,
  -- Fees: from project_financials + orphan services
  COALESCE(pf.total_fees, 0) + COALESCE(ds.direct_fees, 0) AS total_fees,
  -- Expenses: all for this client
  COALESCE(ex.total_expenses, 0) AS total_expenses,
  -- Paid: from payments table (how the card does it today)
  COALESCE(pay.total_paid, 0) AS total_paid,
  COALESCE(pf.total_fees, 0) + COALESCE(ds.direct_fees, 0)
    + COALESCE(ex.total_expenses, 0) - COALESCE(pay.total_paid, 0) AS balance_due
FROM clients c
LEFT JOIN (
  SELECT client_name, SUM(total_fees) AS total_fees
  FROM project_financials GROUP BY client_name
) pf ON pf.client_name = c.name
LEFT JOIN (
  SELECT client_id,
    SUM(COALESCE(fee_shooting,0) + COALESCE(fee_editing,0) + COALESCE(fee_other,0) - COALESCE(discount,0)) AS direct_fees
  FROM services WHERE project_id IS NULL GROUP BY client_id
) ds ON ds.client_id = c.id
LEFT JOIN (
  SELECT client_id, SUM(
    CASE
      WHEN expense_type = 'credito_ricevuto' THEN -COALESCE(amount, 0)
      WHEN expense_type = 'spostamento_km' THEN COALESCE(km_distance * km_rate, 0)
      ELSE COALESCE(amount, 0) * (1 + COALESCE(markup_percent, 0) / 100.0)
    END
  ) AS total_expenses
  FROM expenses GROUP BY client_id
) ex ON ex.client_id = c.id
LEFT JOIN (
  SELECT client_id, SUM(
    CASE WHEN payment_type = 'rimborso' THEN -amount ELSE amount END
  ) FILTER (WHERE status = 'ricevuto') AS total_paid
  FROM payments GROUP BY client_id
) pay ON pay.client_id = c.id
ORDER BY c.name;

-- Display
\echo '=== PROJECT BASELINE (before) ==='
SELECT * FROM _migration_baseline.project_before;

\echo '=== CLIENT BASELINE (before) ==='
SELECT * FROM _migration_baseline.client_before;

\echo '=== FOUNDATION-PATH PROJECTS (will intentionally change) ==='
SELECT project_id, project_name, payment_semantics_basis, total_paid
FROM _migration_baseline.project_before
WHERE payment_semantics_basis IN ('financial_foundation', 'financial_documents');
```

- [ ] **Step 2: Write AFTER baseline query (new schema)**

```sql
-- scripts/financial-baseline-after.sql
-- Run AFTER migration. Uses new schema columns.

\echo '=== PROJECT BASELINE (after) ==='
SELECT
  project_id, project_name, client_name,
  total_fees, total_expenses, total_owed, total_paid, balance_due
FROM project_financials
ORDER BY project_name;

\echo '=== CLIENT BASELINE (after) ==='
SELECT * FROM client_commercial_position
ORDER BY client_name;
```

- [ ] **Step 3: Write comparison query**

```sql
-- scripts/financial-baseline-compare.sql
-- Run AFTER migration. Uses persistent _migration_baseline tables (cross-session safe).
-- Highlights ONLY rows where numbers differ.

\echo '=== PROJECT PARITY CHECK (differences only) ==='
SELECT
  b.project_id,
  b.project_name,
  b.total_fees AS before_fees,   n.total_fees AS after_fees,
  b.total_expenses AS before_exp, n.total_expenses AS after_exp,
  b.total_paid AS before_paid,   n.total_paid AS after_paid,
  b.balance_due AS before_bal,   n.balance_due AS after_bal,
  b.payment_semantics_basis AS was_basis
FROM _migration_baseline.project_before b
JOIN project_financials n ON n.project_id = b.project_id
WHERE ROUND(b.total_fees::numeric, 2) IS DISTINCT FROM n.total_fees
   OR ROUND(b.total_expenses::numeric, 2) IS DISTINCT FROM n.total_expenses
   OR ROUND(b.total_paid::numeric, 2) IS DISTINCT FROM n.total_paid
   OR ROUND(b.balance_due::numeric, 2) IS DISTINCT FROM n.balance_due;

\echo '=== CLIENT PARITY CHECK (differences only) ==='
SELECT
  b.client_id,
  b.client_name,
  b.total_fees AS before_fees,   n.total_fees AS after_fees,
  b.total_expenses AS before_exp, n.total_expenses AS after_exp,
  b.total_paid AS before_paid,   n.total_paid AS after_paid,
  b.balance_due AS before_bal,   n.balance_due AS after_bal
FROM _migration_baseline.client_before b
JOIN client_commercial_position n ON n.client_id = b.client_id
WHERE ROUND(b.total_fees::numeric, 2) IS DISTINCT FROM n.total_fees
   OR ROUND(b.total_expenses::numeric, 2) IS DISTINCT FROM n.total_expenses
   OR ROUND(b.total_paid::numeric, 2) IS DISTINCT FROM n.total_paid
   OR ROUND(b.balance_due::numeric, 2) IS DISTINCT FROM n.balance_due;
```

- [ ] **Step 4: Run BEFORE baseline on local DB**

Run: `psql "postgresql://postgres:postgres@127.0.0.1:55322/postgres" -f scripts/financial-baseline-before.sql`
Expected: Two tables displayed. Review foundation-path projects — these are the ones that will intentionally change.

- [ ] **Step 5: Commit scripts only (not output)**

```bash
git add scripts/financial-baseline-before.sql scripts/financial-baseline-after.sql scripts/financial-baseline-compare.sql
git commit -m "chore: add financial baseline comparison scripts for migration"
```

---

## Task 1: Data quality diagnostic

**Files:**
- Create: `scripts/financial-data-quality-check.sql`

- [ ] **Step 1: Write diagnostic queries**

```sql
-- scripts/financial-data-quality-check.sql
-- Check for data quality issues before migration

-- Payments where client_id mismatches project's client_id
\echo '=== PAYMENTS: client_id mismatch with project ==='
SELECT
  p.id AS payment_id,
  p.client_id AS payment_client_id,
  pr.client_id AS project_client_id,
  pr.name AS project_name
FROM payments p
JOIN projects pr ON pr.id = p.project_id
WHERE p.project_id IS NOT NULL
  AND p.client_id IS DISTINCT FROM pr.client_id;

-- Services where client_id mismatches project's client_id
\echo '=== SERVICES: client_id mismatch with project ==='
SELECT
  s.id AS service_id,
  s.client_id AS service_client_id,
  pr.client_id AS project_client_id,
  pr.name AS project_name
FROM services s
JOIN projects pr ON pr.id = s.project_id
WHERE s.project_id IS NOT NULL
  AND s.client_id IS DISTINCT FROM pr.client_id;

-- Expenses where client_id mismatches project's client_id
\echo '=== EXPENSES: client_id mismatch with project ==='
SELECT
  e.id AS expense_id,
  e.client_id AS expense_client_id,
  pr.client_id AS project_client_id,
  pr.name AS project_name
FROM expenses e
JOIN projects pr ON pr.id = e.project_id
WHERE e.project_id IS NOT NULL
  AND e.client_id IS DISTINCT FROM pr.client_id;

-- Orphan records (no project, no client)
\echo '=== ORPHAN RECORDS (no project, no client) ==='
SELECT 'payments' AS source, COUNT(*) FROM payments WHERE project_id IS NULL AND client_id IS NULL
UNION ALL
SELECT 'services', COUNT(*) FROM services WHERE project_id IS NULL AND client_id IS NULL
UNION ALL
SELECT 'expenses', COUNT(*) FROM expenses WHERE project_id IS NULL AND client_id IS NULL;
```

- [ ] **Step 2: Run diagnostic on local DB**

Run: `psql "postgresql://postgres:postgres@127.0.0.1:55322/postgres" -f scripts/financial-data-quality-check.sql`
Expected: Ideally zero mismatches. If any exist, document them — the new views will use project's client_id, which may change aggregation for those records.

- [ ] **Step 3: Commit diagnostic**

```bash
git add scripts/financial-data-quality-check.sql
git commit -m "chore: add data quality diagnostic for financial migration"
```

---

## Task 2: Migration — Rewrite `project_financials` + create `client_commercial_position`

**Files:**
- Create: `supabase/migrations/YYYYMMDD_single_source_financials.sql`

- [ ] **Step 1: Create the migration file**

Run: `npx supabase migration new single_source_financials`

- [ ] **Step 2: Write the migration SQL**

Write the following to the newly created migration file:

```sql
-- Single Source of Truth: Financial Position
-- Spec: docs/superpowers/specs/2026-04-01-single-source-of-truth-financials-design.md
--
-- Changes:
-- 1. Rewrite project_financials: remove dual-path, always use payments table
-- 2. Add client_id and total_owed columns to project_financials
-- 3. Create client_commercial_position view

-- =============================================================================
-- 1. Rewrite project_financials
-- =============================================================================
CREATE OR REPLACE VIEW public.project_financials AS
WITH service_view AS (
    SELECT
        s.project_id,
        COUNT(*)::int AS total_services,
        SUM(
            COALESCE(s.fee_shooting, 0)
            + COALESCE(s.fee_editing, 0)
            + COALESCE(s.fee_other, 0)
            - COALESCE(s.discount, 0)
        ) AS total_fees,
        SUM(COALESCE(s.km_distance, 0)) AS total_km,
        SUM(COALESCE(s.km_distance, 0) * COALESCE(s.km_rate, 0)) AS total_km_cost
    FROM services s
    WHERE s.project_id IS NOT NULL
    GROUP BY s.project_id
),
expense_view AS (
    SELECT
        e.project_id,
        SUM(
            CASE
                WHEN e.expense_type = 'credito_ricevuto'
                    THEN -COALESCE(e.amount, 0)
                WHEN e.expense_type = 'spostamento_km'
                    THEN COALESCE(e.km_distance * e.km_rate, 0)
                ELSE
                    COALESCE(e.amount, 0) * (1 + COALESCE(e.markup_percent, 0) / 100.0)
            END
        ) AS total_expenses
    FROM expenses e
    WHERE e.project_id IS NOT NULL
    GROUP BY e.project_id
),
payment_view AS (
    SELECT
        p.project_id,
        SUM(
            CASE
                WHEN p.payment_type = 'rimborso' THEN -p.amount
                ELSE p.amount
            END
        ) AS total_paid
    FROM payments p
    WHERE p.project_id IS NOT NULL
      AND p.status = 'ricevuto'
    GROUP BY p.project_id
)
SELECT
    pr.id AS project_id,
    pr.name AS project_name,
    pr.client_id,
    c.name AS client_name,
    pr.category,
    COALESCE(sv.total_services, 0) AS total_services,
    ROUND(COALESCE(sv.total_fees, 0), 2) AS total_fees,
    ROUND(COALESCE(sv.total_km, 0), 2) AS total_km,
    ROUND(COALESCE(sv.total_km_cost, 0), 2) AS total_km_cost,
    ROUND(COALESCE(ev.total_expenses, 0), 2) AS total_expenses,
    ROUND(COALESCE(sv.total_fees, 0) + COALESCE(ev.total_expenses, 0), 2) AS total_owed,
    ROUND(COALESCE(pv.total_paid, 0), 2) AS total_paid,
    ROUND(
        COALESCE(sv.total_fees, 0)
        + COALESCE(ev.total_expenses, 0)
        - COALESCE(pv.total_paid, 0)
    , 2) AS balance_due
FROM projects pr
JOIN clients c ON c.id = pr.client_id
LEFT JOIN service_view sv ON sv.project_id = pr.id
LEFT JOIN expense_view ev ON ev.project_id = pr.id
LEFT JOIN payment_view pv ON pv.project_id = pr.id;

-- =============================================================================
-- 2. Create client_commercial_position
-- =============================================================================
DROP VIEW IF EXISTS public.client_commercial_position;

CREATE VIEW public.client_commercial_position AS
WITH canonicalized_fees AS (
    -- Services with project: use project's client_id
    SELECT pr.client_id, s.project_id,
        COALESCE(s.fee_shooting, 0) + COALESCE(s.fee_editing, 0)
        + COALESCE(s.fee_other, 0) - COALESCE(s.discount, 0) AS fee
    FROM services s
    JOIN projects pr ON pr.id = s.project_id
    WHERE s.project_id IS NOT NULL
    UNION ALL
    -- Orphan services: use own client_id
    SELECT s.client_id, s.project_id, 
        COALESCE(s.fee_shooting, 0) + COALESCE(s.fee_editing, 0)
        + COALESCE(s.fee_other, 0) - COALESCE(s.discount, 0) AS fee
    FROM services s
    WHERE s.project_id IS NULL AND s.client_id IS NOT NULL
),
canonicalized_expenses AS (
    -- Expenses with project: use project's client_id
    SELECT pr.client_id, e.project_id,
        CASE
            WHEN e.expense_type = 'credito_ricevuto' THEN -COALESCE(e.amount, 0)
            WHEN e.expense_type = 'spostamento_km' THEN COALESCE(e.km_distance * e.km_rate, 0)
            ELSE COALESCE(e.amount, 0) * (1 + COALESCE(e.markup_percent, 0) / 100.0)
        END AS expense
    FROM expenses e
    JOIN projects pr ON pr.id = e.project_id
    WHERE e.project_id IS NOT NULL
    UNION ALL
    -- Orphan expenses: use own client_id
    SELECT e.client_id, e.project_id,
        CASE
            WHEN e.expense_type = 'credito_ricevuto' THEN -COALESCE(e.amount, 0)
            WHEN e.expense_type = 'spostamento_km' THEN COALESCE(e.km_distance * e.km_rate, 0)
            ELSE COALESCE(e.amount, 0) * (1 + COALESCE(e.markup_percent, 0) / 100.0)
        END AS expense
    FROM expenses e
    WHERE e.project_id IS NULL AND e.client_id IS NOT NULL
),
canonicalized_payments AS (
    -- Payments with project: use project's client_id
    SELECT pr.client_id, p.project_id,
        CASE WHEN p.payment_type = 'rimborso' THEN -p.amount ELSE p.amount END AS paid
    FROM payments p
    JOIN projects pr ON pr.id = p.project_id
    WHERE p.project_id IS NOT NULL AND p.status = 'ricevuto'
    UNION ALL
    -- Orphan payments: use own client_id
    SELECT p.client_id, p.project_id,
        CASE WHEN p.payment_type = 'rimborso' THEN -p.amount ELSE p.amount END AS paid
    FROM payments p
    WHERE p.project_id IS NULL AND p.client_id IS NOT NULL AND p.status = 'ricevuto'
),
fee_agg AS (
    SELECT client_id, COALESCE(SUM(fee), 0) AS total_fees
    FROM canonicalized_fees GROUP BY client_id
),
expense_agg AS (
    SELECT client_id, COALESCE(SUM(expense), 0) AS total_expenses
    FROM canonicalized_expenses GROUP BY client_id
),
payment_agg AS (
    SELECT client_id, COALESCE(SUM(paid), 0) AS total_paid
    FROM canonicalized_payments GROUP BY client_id
),
-- projects_count: DISTINCT project_ids across ALL three sources
project_count AS (
    SELECT client_id, project_id FROM canonicalized_fees WHERE project_id IS NOT NULL
    UNION
    SELECT client_id, project_id FROM canonicalized_expenses WHERE project_id IS NOT NULL
    UNION
    SELECT client_id, project_id FROM canonicalized_payments WHERE project_id IS NOT NULL
),
project_count_agg AS (
    SELECT client_id, COUNT(*) AS projects_count
    FROM project_count GROUP BY client_id
)
SELECT
    c.id AS client_id,
    c.name AS client_name,
    ROUND(COALESCE(fa.total_fees, 0), 2) AS total_fees,
    ROUND(COALESCE(ea.total_expenses, 0), 2) AS total_expenses,
    ROUND(COALESCE(fa.total_fees, 0) + COALESCE(ea.total_expenses, 0), 2) AS total_owed,
    ROUND(COALESCE(pa.total_paid, 0), 2) AS total_paid,
    ROUND(
        COALESCE(fa.total_fees, 0)
        + COALESCE(ea.total_expenses, 0)
        - COALESCE(pa.total_paid, 0)
    , 2) AS balance_due,
    -- projects_count = projects with canonical financial activity, NOT total projects owned
    COALESCE(pc.projects_count, 0)::int AS projects_count
FROM clients c
LEFT JOIN fee_agg fa ON fa.client_id = c.id
LEFT JOIN expense_agg ea ON ea.client_id = c.id
LEFT JOIN payment_agg pa ON pa.client_id = c.id
LEFT JOIN project_count_agg pc ON pc.client_id = c.id;

-- =============================================================================
-- 3. RLS — verify access
-- =============================================================================
-- Views inherit RLS from underlying tables (same as project_financials today).
-- VERIFY after migration: run a SELECT on client_commercial_position as
-- an authenticated user to confirm it returns data. If it returns empty
-- when it shouldn't, check RLS policies on clients, services, expenses, payments.

-- =============================================================================
-- 4. Performance indexes (if not already present)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_payments_project_status_type
    ON payments (project_id, status, payment_type);
CREATE INDEX IF NOT EXISTS idx_payments_client_status_type
    ON payments (client_id, status, payment_type);
CREATE INDEX IF NOT EXISTS idx_expenses_project
    ON expenses (project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_client
    ON expenses (client_id);
CREATE INDEX IF NOT EXISTS idx_services_project
    ON services (project_id);
CREATE INDEX IF NOT EXISTS idx_services_client
    ON services (client_id);
```

- [ ] **Step 3: Apply migration locally**

Run: `npx supabase migration up`
Expected: Migration applies without errors.

- [ ] **Step 4: Run comparison (baseline tables are persistent)**

The before-baseline was captured in Task 0 Step 4 as persistent tables in `_migration_baseline` schema. Now that the migration is applied, run the compare in any psql session:

Run: `psql "postgresql://postgres:postgres@127.0.0.1:55322/postgres" -f scripts/financial-baseline-compare.sql`

Expected: The compare query shows ONLY foundation-path projects as differences. All legacy-path projects should show zero differences.

- [ ] **Step 5: Verify client_commercial_position and RLS access**

Run: `psql "postgresql://postgres:postgres@127.0.0.1:55322/postgres" -c "SELECT * FROM client_commercial_position ORDER BY client_name;"`

Expected: One row per client with all COALESCE-ed values (no nulls). Clients with no activity show all zeros.

Also verify RLS: run the same query as an authenticated user (via the app or Supabase dashboard) to confirm data is returned.

- [ ] **Step 6: Commit migration**

```bash
git add supabase/migrations/*_single_source_financials.sql
git commit -m "feat(db): single source of truth for financial position

Rewrite project_financials view: remove dual-path (foundation/legacy),
always use payments table. Add client_id and total_owed columns.

Create client_commercial_position view: canonical client-level aggregation
with Record Precedence Rules (project client_id prevails over record's).

Spec: docs/superpowers/specs/2026-04-01-single-source-of-truth-financials-design.md"
```

---

## Task 3: TypeScript types for new views

**Files:**
- Modify: `src/components/atomic-crm/types.ts`

- [ ] **Step 1: Add ProjectFinancialRow and ClientCommercialPosition types**

Add at the end of `src/components/atomic-crm/types.ts`:

```typescript
// ── Canonical financial view types ──────────────────────────────────────────
// These map 1:1 to the database views. Do NOT add computed fields here.

export type ProjectFinancialRow = {
  project_id: string;
  project_name: string;
  client_id: string;
  client_name: string;
  category: string | null;
  total_services: number;
  total_fees: number;
  total_km: number;
  total_km_cost: number;
  total_expenses: number;
  total_owed: number;
  total_paid: number;
  balance_due: number;
};

export type ClientCommercialPosition = {
  client_id: string;
  client_name: string;
  total_fees: number;
  total_expenses: number;
  total_owed: number;
  total_paid: number;
  balance_due: number;
  projects_count: number;
};
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors (existing errors may be present).

- [ ] **Step 3: Commit types**

```bash
git add src/components/atomic-crm/types.ts
git commit -m "feat(types): add ProjectFinancialRow and ClientCommercialPosition types"
```

---

## Task 4: Fix AI payment type parser — `rimborso` vs `rimborso_spese`

**Files:**
- Modify: `supabase/functions/_shared/unifiedCrmAnswerUtils.ts:166-169`
- Modify: `supabase/functions/_shared/unifiedCrmAnswerIntents.ts:697-717`
- Modify: `src/lib/ai/unifiedCrmAssistant.ts:62`
- Create: `src/lib/ai/__tests__/inferPreferredPaymentType.test.ts`

- [ ] **Step 1: Extract `inferPreferredPaymentType` logic to a shared pure function**

The Edge Function version lives in Deno and can't be imported by Vitest directly. Extract the pure logic to a shared file that both the EF and the test can use.

Create `src/lib/ai/inferPreferredPaymentType.ts`:

```typescript
/**
 * Infer payment type from natural language question.
 * Longest match first: "rimborso spese" before bare "rimborso".
 */
export const inferPreferredPaymentType = (
  normalizedQuestion: string,
): string | null => {
  const includes = (kw: string) => normalizedQuestion.includes(kw);

  if (includes("rimborso spese") || includes("spes")) return "rimborso_spese";
  if (includes("rimborso")) return "rimborso";
  if (includes("acconto") || includes("anticip")) return "acconto";
  if (includes("saldo") || includes("residu") || includes("chiuder"))
    return "saldo";
  if (includes("parzial")) return "parziale";
  return null;
};
```

- [ ] **Step 2: Write test importing the real function**

Create `src/lib/ai/__tests__/inferPreferredPaymentType.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { inferPreferredPaymentType } from "../inferPreferredPaymentType";

describe("inferPreferredPaymentType", () => {
  it("maps 'rimborso spese' to rimborso_spese", () => {
    expect(inferPreferredPaymentType("registra rimborso spese")).toBe(
      "rimborso_spese",
    );
  });

  it("maps 'spes' to rimborso_spese", () => {
    expect(inferPreferredPaymentType("spese viaggio")).toBe("rimborso_spese");
  });

  it("maps 'rimborso' alone to rimborso (NOT rimborso_spese)", () => {
    expect(inferPreferredPaymentType("registra un rimborso al cliente")).toBe(
      "rimborso",
    );
  });

  it("maps 'acconto' to acconto", () => {
    expect(inferPreferredPaymentType("registra acconto")).toBe("acconto");
  });

  it("maps 'saldo' to saldo", () => {
    expect(inferPreferredPaymentType("registra saldo")).toBe("saldo");
  });

  it("maps 'parziale' to parziale", () => {
    expect(inferPreferredPaymentType("pagamento parziale")).toBe("parziale");
  });

  it("returns null for unrecognized input", () => {
    expect(inferPreferredPaymentType("ciao come stai")).toBeNull();
  });
});
```

- [ ] **Step 3: Run test**

Run: `npx vitest run src/lib/ai/__tests__/inferPreferredPaymentType.test.ts`
Expected: All 7 tests PASS.

- [ ] **Step 4: Update DraftPaymentType in Edge Function**

Edit `supabase/functions/_shared/unifiedCrmAnswerUtils.ts` lines 166-169:

Replace:
```typescript
export type DraftPaymentType =
  | "acconto"
  | "saldo"
  | "parziale"
```

With:
```typescript
export type DraftPaymentType =
  | "acconto"
  | "saldo"
  | "parziale"
  | "rimborso_spese"
  | "rimborso"
```

- [ ] **Step 5: Update inferPreferredPaymentType in Edge Function to match shared logic**

Edit `supabase/functions/_shared/unifiedCrmAnswerIntents.ts` lines 697-717.

The EF can't import from `src/lib/`, so update the function inline to match the shared logic:

Replace:
```typescript
export const inferPreferredPaymentType = (
  normalizedQuestion: string,
): DraftPaymentType | null => {
  if (includesAny(normalizedQuestion, ["rimborso spese", "rimborso", "spes"])) {
    return "rimborso_spese";
  }
```

With:
```typescript
export const inferPreferredPaymentType = (
  normalizedQuestion: string,
): DraftPaymentType | null => {
  // Longest match first: "rimborso spese" before bare "rimborso"
  // Mirrors src/lib/ai/inferPreferredPaymentType.ts (canonical)
  if (includesAny(normalizedQuestion, ["rimborso spese", "spes"])) {
    return "rimborso_spese";
  }
  if (includesAny(normalizedQuestion, ["rimborso"])) {
    return "rimborso";
  }
```

- [ ] **Step 6: Update UnifiedCrmPaymentDraft type**

Edit `src/lib/ai/unifiedCrmAssistant.ts` line 62:

Replace:
```typescript
  paymentType: "acconto" | "saldo" | "parziale" | "rimborso_spese";
```

With:
```typescript
  paymentType: "acconto" | "saldo" | "parziale" | "rimborso_spese" | "rimborso";
```

- [ ] **Step 7: Update PaymentDraftCard allowed types**

Edit `src/components/atomic-crm/ai/PaymentDraftCard.tsx` lines 75-78:

Replace:
```typescript
  const allowedPaymentTypes =
    draft.originActionId === "project_quick_payment"
      ? new Set(["acconto", "saldo", "rimborso_spese"])
      : new Set(["acconto", "saldo", "parziale"]);
```

With:
```typescript
  // rimborso is intentionally excluded: refunds to clients are rare,
  // sensitive operations done only via the manual payments CRUD.
  // The AI parser recognizes "rimborso" to give an informative text response,
  // but never generates a navigable draft card for it.
  const allowedPaymentTypes = new Set([
    "acconto",
    "saldo",
    "parziale",
    "rimborso_spese",
  ]);
```

- [ ] **Step 8: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors.

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/_shared/unifiedCrmAnswerUtils.ts \
       supabase/functions/_shared/unifiedCrmAnswerIntents.ts \
       src/lib/ai/unifiedCrmAssistant.ts \
       src/lib/ai/inferPreferredPaymentType.ts \
       src/components/atomic-crm/ai/PaymentDraftCard.tsx \
       src/lib/ai/__tests__/inferPreferredPaymentType.test.ts
git commit -m "fix(ai): distinguish rimborso from rimborso_spese in payment parser

Longest-match-first: 'rimborso spese' -> rimborso_spese,
bare 'rimborso' -> rimborso (refund to client).

Add rimborso + rimborso_spese to DraftPaymentType.
Unify PaymentDraftCard allowed types (parziale now allowed everywhere)."
```

---

## Task 5: Rewrite ClientFinancialSummary to read from view

**Files:**
- Modify: `src/components/atomic-crm/clients/ClientFinancialSummary.tsx`
- Create: `src/components/atomic-crm/clients/__tests__/ClientFinancialSummary.test.tsx`

- [ ] **Step 1: Write type-shape contract test**

This is a lightweight contract test verifying that the `ClientCommercialPosition`
type shape matches what the component expects. The real behavioral verification
happens in the E2E smoke tests (spec Layer 3, Test 11).

Create `src/components/atomic-crm/clients/__tests__/ClientFinancialSummary.test.tsx`:

```typescript
import { describe, expect, it } from "vitest";
import type { ClientCommercialPosition } from "../../types";

// Contract test: verify the view row shape has the fields the component needs.
// Not a behavioral test — the component is a thin reader with no logic to test.
// Real verification: E2E smoke (open client card, check numbers match view).
const mapViewRowToDisplay = (row: ClientCommercialPosition) => ({
  totalFees: row.total_fees,
  totalExpenses: row.total_expenses,
  totalOwed: row.total_owed,
  totalPaid: row.total_paid,
  balanceDue: row.balance_due,
});

describe("ClientFinancialSummary view consumption", () => {
  it("maps view row to display values with no recalculation", () => {
    const row: ClientCommercialPosition = {
      client_id: "c1",
      client_name: "Test Client",
      total_fees: 1000,
      total_expenses: 200,
      total_owed: 1200,
      total_paid: 500,
      balance_due: 700,
      projects_count: 2,
    };

    const display = mapViewRowToDisplay(row);
    expect(display.totalFees).toBe(1000);
    expect(display.totalExpenses).toBe(200);
    expect(display.totalOwed).toBe(1200);
    expect(display.totalPaid).toBe(500);
    expect(display.balanceDue).toBe(700);
  });

  it("handles zero-activity client (all zeros, not nulls)", () => {
    const row: ClientCommercialPosition = {
      client_id: "c2",
      client_name: "Empty Client",
      total_fees: 0,
      total_expenses: 0,
      total_owed: 0,
      total_paid: 0,
      balance_due: 0,
      projects_count: 0,
    };

    const display = mapViewRowToDisplay(row);
    expect(display.balanceDue).toBe(0);
    expect(display.totalOwed).toBe(0);
  });

  it("handles negative balance_due (overpayment / client credit)", () => {
    const row: ClientCommercialPosition = {
      client_id: "c3",
      client_name: "Overpaid Client",
      total_fees: 500,
      total_expenses: 0,
      total_owed: 500,
      total_paid: 700,
      balance_due: -200,
      projects_count: 1,
    };

    const display = mapViewRowToDisplay(row);
    expect(display.balanceDue).toBe(-200);
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run src/components/atomic-crm/clients/__tests__/ClientFinancialSummary.test.tsx`
Expected: All 3 tests PASS.

- [ ] **Step 3: Rewrite ClientFinancialSummary**

Replace the entire content of `src/components/atomic-crm/clients/ClientFinancialSummary.tsx`:

```typescript
import { useGetOne } from "ra-core";
import { Euro, TrendingUp, TrendingDown, Car } from "lucide-react";
import type { Client, ClientCommercialPosition } from "../types";

const eur = (n: number) =>
  n.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

type Props = { record: Client };

export const ClientFinancialSummary = ({ record }: Props) => {
  const { data, isPending } = useGetOne<ClientCommercialPosition>(
    "client_commercial_position",
    { id: record.id },
    { enabled: !!record.id },
  );

  if (isPending || !data) return null;

  const totalFees = toNum(data.total_fees);
  const totalExpenses = toNum(data.total_expenses);
  const totalPaid = toNum(data.total_paid);
  const balanceDue = toNum(data.balance_due);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCard
        icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
        label="Compensi"
        value={eur(totalFees)}
      />
      <MetricCard
        icon={<Car className="h-4 w-4 text-orange-600" />}
        label="Spese"
        value={eur(totalExpenses)}
      />
      <MetricCard
        icon={<Euro className="h-4 w-4 text-emerald-600" />}
        label="Pagato"
        value={eur(totalPaid)}
      />
      <MetricCard
        icon={
          <TrendingDown
            className={`h-4 w-4 ${balanceDue < 0 ? "text-blue-600" : "text-red-600"}`}
          />
        }
        label={balanceDue < 0 ? "Credito cliente" : "Da saldare"}
        value={eur(Math.abs(balanceDue))}
        className={balanceDue < 0 ? "text-blue-700" : undefined}
      />
    </div>
  );
};

const MetricCard = ({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  className?: string;
}) => (
  <div className="flex flex-col gap-1 rounded-lg border p-3">
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon}
      {label}
    </div>
    <div className={`text-sm font-semibold ${className ?? ""}`}>{value}</div>
  </div>
);
```

- [ ] **Step 4: Run typecheck and lint**

Run: `npx tsc --noEmit 2>&1 | head -30 && npx eslint src/components/atomic-crm/clients/ClientFinancialSummary.tsx`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/atomic-crm/clients/ClientFinancialSummary.tsx \
       src/components/atomic-crm/clients/__tests__/ClientFinancialSummary.test.tsx
git commit -m "refactor(client): read from client_commercial_position view

Replace 4 separate fetches + manual aggregation with single view read.
Filter by client_id (not client_name). Zero recalculation in React.
Handle negative balance_due as 'Credito cliente'."
```

---

## Task 6: Update ProjectShow to use new view shape

**Files:**
- Modify: `src/components/atomic-crm/projects/ProjectShow.tsx:234-239`

- [ ] **Step 1: Update ProjectFinancials to use total_owed and handle negative balance**

In `src/components/atomic-crm/projects/ProjectShow.tsx`, update the ProjectFinancials component (around lines 234-250):

Replace:
```typescript
    const totalFees = toNum(data.total_fees);
    const totalExpenses = toNum(data.total_expenses);
    const totalServices = toNum(data.total_services);
    const totalPaid = toNum(data.total_paid);
    const grandTotal = totalFees + totalExpenses;
    const balanceDue = grandTotal - totalPaid;
```

With:
```typescript
    const totalFees = toNum(data.total_fees);
    const totalExpenses = toNum(data.total_expenses);
    const totalServices = toNum(data.total_services);
    const totalOwed = toNum(data.total_owed);
    const totalPaid = toNum(data.total_paid);
    const balanceDue = toNum(data.balance_due);
```

Then update the MetricCard that shows "Totale" to use `totalOwed` instead of `grandTotal`, and the "Da incassare" card to use `balanceDue` directly. If the existing code references `grandTotal`, replace it with `totalOwed`. If it computes `balanceDue`, use the view's value.

Also handle negative balance: where the label says "Da incassare", show "Credito cliente" when `balanceDue < 0` and display `Math.abs(balanceDue)`.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/atomic-crm/projects/ProjectShow.tsx
git commit -m "refactor(project): read total_owed and balance_due from view

No recalculation in React. Handle negative balance as 'Credito cliente'."
```

---

## Task 7: Fix QuickPaymentDialog `rimborso_spese` suggestion

**Files:**
- Modify: `src/components/atomic-crm/projects/QuickPaymentDialog.tsx:36-51`
- Create: `src/components/atomic-crm/projects/__tests__/getSuggestedAmount.test.ts`

- [ ] **Step 1: Write failing test (imports real function)**

Create `src/components/atomic-crm/projects/__tests__/getSuggestedAmount.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { getSuggestedAmount } from "../QuickPaymentDialog";

describe("getSuggestedAmount", () => {
  it("rimborso_spese suggests remaining expenses, not total", () => {
    expect(
      getSuggestedAmount("rimborso_spese", {
        fees: 1000,
        expenses: 300,
        paid: 500,
        paidRimborsoSpese: 100,
      }),
    ).toBe(200);
  });

  it("rimborso_spese suggests 0 when all expenses reimbursed", () => {
    expect(
      getSuggestedAmount("rimborso_spese", {
        fees: 1000,
        expenses: 300,
        paid: 800,
        paidRimborsoSpese: 300,
      }),
    ).toBe(0);
  });

  it("saldo suggests full balance due", () => {
    expect(
      getSuggestedAmount("saldo", {
        fees: 1000,
        expenses: 200,
        paid: 500,
        paidRimborsoSpese: 0,
      }),
    ).toBe(700);
  });

  it("saldo suggests 0 when overpaid", () => {
    expect(
      getSuggestedAmount("saldo", {
        fees: 500,
        expenses: 0,
        paid: 700,
        paidRimborsoSpese: 0,
      }),
    ).toBe(0);
  });

  it("acconto suggests total fees", () => {
    expect(
      getSuggestedAmount("acconto", {
        fees: 1000,
        expenses: 200,
        paid: 0,
        paidRimborsoSpese: 0,
      }),
    ).toBe(1000);
  });
});
```

- [ ] **Step 2: Update QuickPaymentDialog — export getSuggestedAmount as pure function**

In `src/components/atomic-crm/projects/QuickPaymentDialog.tsx`:

First, add a `useGetList` import and fetch received `rimborso_spese` payments for the project. Then update and EXPORT `getSuggestedAmount` to accept `paidRimborsoSpese`.

Replace:
```typescript
const getSuggestedAmount = (
  type: string,
  totals: { fees: number; expenses: number; paid: number },
) => {
  const balance = totals.fees + totals.expenses - totals.paid;
  switch (type) {
    case "rimborso_spese":
      return round2(totals.expenses);
    case "acconto":
      return round2(totals.fees);
    case "saldo":
      return round2(Math.max(balance, 0));
    default:
      return round2(Math.max(balance, 0));
  }
};
```

With:
```typescript
export type QuickPaymentTotals = {
  fees: number;
  expenses: number;
  paid: number;
  paidRimborsoSpese: number;
};

export const getSuggestedAmount = (
  type: string,
  totals: QuickPaymentTotals,
) => {
  const balance = totals.fees + totals.expenses - totals.paid;
  switch (type) {
    case "rimborso_spese":
      return round2(
        Math.max(totals.expenses - totals.paidRimborsoSpese, 0),
      );
    case "acconto":
      return round2(totals.fees);
    case "saldo":
      return round2(Math.max(balance, 0));
    default:
      return round2(Math.max(balance, 0));
  }
};
```

- [ ] **Step 3: Run test (should now pass with real import)**

Run: `npx vitest run src/components/atomic-crm/projects/__tests__/getSuggestedAmount.test.ts`
Expected: All 5 tests PASS.

Then in the component body, after fetching `project_financials`, add a fetch for payments to compute `paidRimborsoSpese`:

```typescript
const { data: projectPayments } = useGetList<Payment>("payments", {
  filter: {
    "project_id@eq": record.id,
    "status@eq": "ricevuto",
    "payment_type@eq": "rimborso_spese",
  },
  pagination: { page: 1, perPage: 100 },
});

const paidRimborsoSpese = (projectPayments ?? []).reduce(
  (sum, p) => sum + toNum(p.amount),
  0,
);
```

Update the call to `getSuggestedAmount` to pass `paidRimborsoSpese`:

```typescript
const suggested = getSuggestedAmount(watchedType, {
  fees: totalFees,
  expenses: totalExpenses,
  paid: totalPaid,
  paidRimborsoSpese,
});
```

Also add `useGetList` to the ra-core import and `Payment` to the types import.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/atomic-crm/projects/QuickPaymentDialog.tsx \
       src/components/atomic-crm/projects/__tests__/getSuggestedAmount.test.ts
git commit -m "fix(quick-payment): rimborso_spese suggests remaining, not total

Fetch received rimborso_spese payments and subtract from total expenses.
Prevents suggesting full expense amount when partial reimbursement exists."
```

---

## Task 8: Rewrite AI financial summaries as view mappers

**Files:**
- Modify: `src/lib/ai/unifiedCrmFinancialSummaries.ts`
- Create: `src/lib/ai/__tests__/unifiedCrmFinancialSummaries.test.ts`

- [ ] **Step 1: Write test for the new mapper**

Create `src/lib/ai/__tests__/unifiedCrmFinancialSummaries.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  mapProjectFinancialRows,
  mapClientCommercialPositions,
} from "../unifiedCrmFinancialSummaries";
import type {
  ClientCommercialPosition,
  ProjectFinancialRow,
} from "@/components/atomic-crm/types";

describe("mapProjectFinancialRows", () => {
  it("maps view rows to snapshot Map keyed by project_id", () => {
    const rows: ProjectFinancialRow[] = [
      {
        project_id: "p1",
        project_name: "Project Alpha",
        client_id: "c1",
        client_name: "Client A",
        category: "spot",
        total_services: 5,
        total_fees: 2500,
        total_km: 100,
        total_km_cost: 19,
        total_expenses: 300,
        total_owed: 2800,
        total_paid: 1000,
        balance_due: 1800,
      },
    ];

    const map = mapProjectFinancialRows(rows);
    const entry = map.get("p1");
    expect(entry).toBeDefined();
    expect(entry!.totalFees).toBe(2500);
    expect(entry!.totalExpenses).toBe(300);
    expect(entry!.totalPaid).toBe(1000);
    expect(entry!.balanceDue).toBe(1800);
  });
});

describe("mapClientCommercialPositions", () => {
  it("maps view rows with uninvoiced flag from Map", () => {
    const rows: ClientCommercialPosition[] = [
      {
        client_id: "c1",
        client_name: "Client A",
        total_fees: 5000,
        total_expenses: 600,
        total_owed: 5600,
        total_paid: 3000,
        balance_due: 2600,
        projects_count: 3,
      },
    ];

    const uninvoiced = new Map([["c1", 2]]);
    const result = mapClientCommercialPositions(rows, uninvoiced);
    expect(result[0].totalFees).toBe(5000);
    expect(result[0].totalExpenses).toBe(600);
    expect(result[0].balanceDue).toBe(2600);
    expect(result[0].hasUninvoicedServices).toBe(true);
  });

  it("sets hasUninvoicedServices false when count is 0", () => {
    const rows: ClientCommercialPosition[] = [
      {
        client_id: "c2",
        client_name: "Client B",
        total_fees: 1000,
        total_expenses: 0,
        total_owed: 1000,
        total_paid: 1000,
        balance_due: 0,
        projects_count: 1,
      },
    ];

    const result = mapClientCommercialPositions(rows, new Map());
    expect(result[0].hasUninvoicedServices).toBe(false);
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run src/lib/ai/__tests__/unifiedCrmFinancialSummaries.test.ts`
Expected: All tests PASS.

- [ ] **Step 3: Rewrite unifiedCrmFinancialSummaries.ts**

The full rewrite replaces `buildProjectFinancialSummaries` and `buildClientFinancialSummaries` with thin mappers. The `getExpenseOperationalAmount` helper and `buildSupplierFinancialSummaries` are kept (they serve other purposes).

Replace the `buildProjectFinancialSummaries` function (lines 43-107) with:

```typescript
export const mapProjectFinancialRows = (
  rows: ProjectFinancialRow[],
): Map<string, ProjectFinancialSummary> => {
  const summaries = new Map<string, ProjectFinancialSummary>();
  for (const row of rows) {
    summaries.set(row.project_id, {
      totalServices: row.total_services,
      totalFees: row.total_fees,
      totalExpenses: row.total_expenses,
      totalPaid: row.total_paid,
      balanceDue: row.balance_due,
    });
  }
  return summaries;
};
```

Replace `buildClientFinancialSummaries` (lines 111-171) with:

```typescript
export const mapClientCommercialPositions = (
  rows: ClientCommercialPosition[],
  uninvoicedCountByClient: Map<string, number>,
) =>
  rows.map((row) => ({
    clientId: row.client_id,
    clientName: row.client_name,
    totalFees: row.total_fees,
    totalExpenses: row.total_expenses,
    totalPaid: row.total_paid,
    balanceDue: row.balance_due,
    hasUninvoicedServices:
      (uninvoicedCountByClient.get(row.client_id) ?? 0) > 0,
  }));
```

Add imports at the top of the file:

```typescript
import type {
  ClientCommercialPosition,
  ProjectFinancialRow,
} from "@/components/atomic-crm/types";
```

Remove unused imports (`Client`, `Payment`, `calculateServiceNetValue`) if they're no longer used by the remaining functions.

- [ ] **Step 4: Run typecheck and test**

Run: `npx tsc --noEmit 2>&1 | head -30 && npx vitest run src/lib/ai/__tests__/unifiedCrmFinancialSummaries.test.ts`
Expected: No type errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/unifiedCrmFinancialSummaries.ts \
       src/lib/ai/__tests__/unifiedCrmFinancialSummaries.test.ts
git commit -m "refactor(ai): replace financial calculators with view mappers

buildProjectFinancialSummaries -> mapProjectFinancialRows (reads view)
buildClientFinancialSummaries -> mapClientCommercialPositions (reads view)
No recalculation. Canonical source is the DB views."
```

---

## Task 9: Update AI snapshot builder to use views

**Files:**
- Modify: `src/components/atomic-crm/providers/supabase/dataProviderAi.ts`
- Modify: `supabase/functions/_shared/unifiedCrmAnswerCreateFlows.ts:849-870, 1006-1024`

- [ ] **Step 1: Update dataProviderAi to fetch canonical views**

In the `getUnifiedCrmReadContextFromResources` function, add fetches for `project_financials` and `client_commercial_position` alongside the existing raw table fetches. Pass these view results to the snapshot builder.

This step requires reading the current `dataProviderAi.ts` to understand the exact function shape — the agent executing this task should read it and add the two `getList` calls for the canonical views.

- [ ] **Step 2: Update getClientFinancials in unifiedCrmAnswerCreateFlows.ts**

Edit lines 849-870 to include `totalExpenses`:

Replace the return object:
```typescript
  return {
    totalFees,
    totalPaid,
    balanceDue,
    hasUninvoicedServices: match.hasUninvoicedServices === true,
  };
```

With:
```typescript
  const totalExpenses = getNumber(match.totalExpenses) ?? 0;

  return {
    totalFees,
    totalExpenses,
    totalPaid,
    balanceDue,
    hasUninvoicedServices: match.hasUninvoicedServices === true,
  };
```

- [ ] **Step 3: Update invoice draft markdown to show expenses**

Edit around lines 1006-1024, after `**Lavoro totale**` line, add expenses:

Replace:
```typescript
  lines.push(`- **Lavoro totale**: ${formatNumber(financials.totalFees)} EUR`);
  lines.push(`- **Gia pagato**: ${formatNumber(financials.totalPaid)} EUR`);
```

With:
```typescript
  lines.push(`- **Compensi**: ${formatNumber(financials.totalFees)} EUR`);
  if (financials.totalExpenses > 0) {
    lines.push(`- **Spese**: ${formatNumber(financials.totalExpenses)} EUR`);
  }
  lines.push(`- **Gia pagato**: ${formatNumber(financials.totalPaid)} EUR`);
```

- [ ] **Step 4: Commit**

```bash
git add src/components/atomic-crm/providers/supabase/dataProviderAi.ts \
       supabase/functions/_shared/unifiedCrmAnswerCreateFlows.ts
git commit -m "feat(ai): use canonical views for financial snapshot

AI snapshot now reads from project_financials and client_commercial_position.
Invoice draft markdown shows expenses when present."
```

---

## Task 10: Add expenses to invoice draft builders

**Files:**
- Modify: `src/components/atomic-crm/invoicing/buildInvoiceDraftFromProject.ts`
- Modify: `src/components/atomic-crm/invoicing/buildInvoiceDraftFromClient.ts`
- Create: `src/components/atomic-crm/invoicing/__tests__/buildInvoiceDraftFromProject.test.ts`
- Create: `src/components/atomic-crm/invoicing/__tests__/buildInvoiceDraftFromClient.test.ts`

- [ ] **Step 1: Write test for project draft with expenses**

Create `src/components/atomic-crm/invoicing/__tests__/buildInvoiceDraftFromProject.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildInvoiceDraftFromProject } from "../buildInvoiceDraftFromProject";
import type { Client, Expense, Payment, Project, Service } from "../../types";

const client: Client = { id: "c1", name: "Test Client" } as Client;
const project: Project = {
  id: "p1",
  name: "Project A",
  client_id: "c1",
} as Project;

const service: Service = {
  id: "s1",
  project_id: "p1",
  client_id: "c1",
  service_date: "2026-01-15",
  description: "Shooting day",
  fee_shooting: 500,
  fee_editing: 200,
  fee_other: 0,
  discount: 0,
  km_distance: 0,
  km_rate: 0,
  invoice_ref: null,
} as unknown as Service;

const expense: Expense = {
  id: "e1",
  project_id: "p1",
  client_id: "c1",
  expense_type: "noleggio_attrezzatura",
  description: "Drone rental",
  amount: 150,
  markup_percent: 0,
  km_distance: null,
  km_rate: null,
  invoice_ref: null,
} as unknown as Expense;

const payment: Payment = {
  id: "pay1",
  project_id: "p1",
  client_id: "c1",
  amount: 300,
  payment_type: "acconto",
  status: "ricevuto",
} as unknown as Payment;

const rimborso: Payment = {
  id: "pay2",
  project_id: "p1",
  client_id: "c1",
  amount: 50,
  payment_type: "rimborso",
  status: "ricevuto",
} as unknown as Payment;

describe("buildInvoiceDraftFromProject", () => {
  it("includes expense line items", () => {
    const draft = buildInvoiceDraftFromProject(
      project,
      client,
      [service],
      [payment],
      0.19,
      [expense],
    );
    expect(draft).not.toBeNull();
    const expenseLine = draft!.lineItems.find((l) =>
      l.description.includes("Drone rental"),
    );
    expect(expenseLine).toBeDefined();
    expect(expenseLine!.unitPrice).toBe(150);
  });

  it("excludes rimborso from payment deduction line", () => {
    const draft = buildInvoiceDraftFromProject(
      project,
      client,
      [service],
      [payment, rimborso],
      0.19,
      [expense],
    );
    expect(draft).not.toBeNull();
    const paymentLine = draft!.lineItems.find((l) =>
      l.description.includes("Pagamenti"),
    );
    // Only acconto (300) is deducted, rimborso (50) excluded per Invoice Draft Sign Rule
    expect(paymentLine).toBeDefined();
    expect(paymentLine!.unitPrice).toBe(-300);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/atomic-crm/invoicing/__tests__/buildInvoiceDraftFromProject.test.ts`
Expected: FAIL — function signature doesn't accept expenses parameter yet.

- [ ] **Step 3: Update buildInvoiceDraftFromProject**

Edit `src/components/atomic-crm/invoicing/buildInvoiceDraftFromProject.ts`:

Add `Expense` to the type import:
```typescript
import type { Client, Expense, Payment, Project, Service } from "../types";
```

Update function signature (line 22):
```typescript
export const buildInvoiceDraftFromProject = (
  project: Project,
  client: Client,
  services: Service[],
  payments: DraftPayment[] = [],
  defaultKmRate = 0.19,
  expenses: Expense[] = [],
): InvoiceDraftInput | null => {
```

After the service line items loop (after line ~75), add expense line items:

```typescript
  // Expense line items (billable, not yet invoiced)
  for (const expense of expenses.filter(
    (e) => e.project_id === project.id && !e.invoice_ref,
  )) {
    const amount =
      expense.expense_type === "credito_ricevuto"
        ? -Number(expense.amount ?? 0)
        : expense.expense_type === "spostamento_km"
          ? (expense.km_distance ?? 0) * (expense.km_rate ?? defaultKmRate)
          : Number(expense.amount ?? 0) *
            (1 + (expense.markup_percent ?? 0) / 100);

    if (amount !== 0) {
      lineItems.push({
        description: `Spesa: ${expense.description || expense.expense_type}`,
        quantity: 1,
        unitPrice: amount,
      });
    }
  }
```

Update the payment deduction to exclude `rimborso` per Invoice Draft Sign Rule:

Replace the receivedTotal calculation:
```typescript
const receivedTotal = payments
    .filter((p) => p.status === "ricevuto")
    .reduce((sum, p) => sum + getSignedPaymentAmount(p), 0);
```

With:
```typescript
  // Invoice Draft Sign Rule: rimborso excluded (already handled in commercial position)
  const receivedTotal = payments
    .filter((p) => p.status === "ricevuto" && p.payment_type !== "rimborso")
    .reduce((sum, p) => sum + p.amount, 0);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/atomic-crm/invoicing/__tests__/buildInvoiceDraftFromProject.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Write test for client draft**

Create `src/components/atomic-crm/invoicing/__tests__/buildInvoiceDraftFromClient.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildInvoiceDraftFromClient } from "../buildInvoiceDraftFromClient";
import type {
  Client,
  Expense,
  Payment,
  Project,
  Service,
} from "../../types";

const client: Client = { id: "c1", name: "Test Client" } as Client;
const project: Project = {
  id: "p1",
  name: "Project A",
  client_id: "c1",
} as Project;

const service: Service = {
  id: "s1",
  project_id: "p1",
  client_id: "c1",
  description: "Shooting",
  fee_shooting: 800,
  fee_editing: 0,
  fee_other: 0,
  discount: 0,
  km_distance: 0,
  km_rate: 0,
  invoice_ref: null,
} as unknown as Service;

const expense: Expense = {
  id: "e1",
  project_id: "p1",
  client_id: "c1",
  expense_type: "noleggio_attrezzatura",
  description: "Lights rental",
  amount: 100,
  markup_percent: 0,
  km_distance: null,
  km_rate: null,
  invoice_ref: null,
} as unknown as Expense;

const payment: Payment = {
  id: "pay1",
  project_id: "p1",
  client_id: "c1",
  amount: 200,
  payment_type: "acconto",
  status: "ricevuto",
} as unknown as Payment;

describe("buildInvoiceDraftFromClient", () => {
  it("includes expenses and subtracts payments", () => {
    const draft = buildInvoiceDraftFromClient(
      client,
      [service],
      [project],
      0.19,
      [expense],
      [payment],
    );
    expect(draft).not.toBeNull();

    const expenseLine = draft!.lineItems.find((l) =>
      l.description.includes("Lights rental"),
    );
    expect(expenseLine).toBeDefined();
    expect(expenseLine!.unitPrice).toBe(100);

    const paymentLine = draft!.lineItems.find((l) =>
      l.description.includes("Pagamenti"),
    );
    expect(paymentLine).toBeDefined();
    expect(paymentLine!.unitPrice).toBe(-200);
  });

  it("returns null when nothing to collect", () => {
    const bigPayment = {
      ...payment,
      amount: 2000,
    } as unknown as Payment;
    const draft = buildInvoiceDraftFromClient(
      client,
      [service],
      [project],
      0.19,
      [expense],
      [bigPayment],
    );
    expect(draft).toBeNull();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/components/atomic-crm/invoicing/__tests__/buildInvoiceDraftFromClient.test.ts`
Expected: FAIL — function signature doesn't accept expenses/payments yet.

- [ ] **Step 7: Update buildInvoiceDraftFromClient**

Edit `src/components/atomic-crm/invoicing/buildInvoiceDraftFromClient.ts`:

Add `Expense` and `Payment` to imports:
```typescript
import type { Client, Expense, Payment, Project, Service } from "../types";
```

Also import `getInvoiceDraftLineTotal`:
```typescript
import { getInvoiceDraftLineTotal } from "./invoiceDraftTypes";
```

Update function signature (line 32):
```typescript
export const buildInvoiceDraftFromClient = (
  client: Client,
  services: Service[],
  projects: Project[],
  defaultKmRate = 0.19,
  expenses: Expense[] = [],
  payments: Payment[] = [],
): InvoiceDraftInput | null => {
```

After the service line items loop (after line ~94), add expense line items:

```typescript
  // Expense line items (billable, not yet invoiced, for this client)
  for (const expense of expenses.filter(
    (e) => e.client_id === client.id && !e.invoice_ref,
  )) {
    const amount =
      expense.expense_type === "credito_ricevuto"
        ? -Number(expense.amount ?? 0)
        : expense.expense_type === "spostamento_km"
          ? (expense.km_distance ?? 0) * (expense.km_rate ?? defaultKmRate)
          : Number(expense.amount ?? 0) *
            (1 + (expense.markup_percent ?? 0) / 100);

    if (amount !== 0) {
      const projectName = projects.find(
        (p) => p.id === expense.project_id,
      )?.name;
      lineItems.push({
        description: projectName
          ? `${projectName} · Spesa: ${expense.description || expense.expense_type}`
          : `Spesa: ${expense.description || expense.expense_type}`,
        quantity: 1,
        unitPrice: amount,
      });
    }
  }

  // Payment deduction (Invoice Draft Sign Rule: rimborso excluded)
  const receivedTotal = payments
    .filter(
      (p) =>
        p.client_id === client.id &&
        p.status === "ricevuto" &&
        p.payment_type !== "rimborso",
    )
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  if (receivedTotal !== 0) {
    lineItems.push({
      description: "Pagamenti gia ricevuti",
      quantity: 1,
      unitPrice: -receivedTotal,
    });
  }

  // Only return if there's something to collect
  const collectableAmount = lineItems.reduce(
    (sum, item) => sum + getInvoiceDraftLineTotal(item),
    0,
  );
  if (collectableAmount <= 0) return null;
```

Update the return to remove the old `if (!lineItems.length)` guard and use the new collectable check.

- [ ] **Step 8: Run tests**

Run: `npx vitest run src/components/atomic-crm/invoicing/__tests__/`
Expected: All tests PASS.

- [ ] **Step 9: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors.

- [ ] **Step 10: Commit**

```bash
git add src/components/atomic-crm/invoicing/buildInvoiceDraftFromProject.ts \
       src/components/atomic-crm/invoicing/buildInvoiceDraftFromClient.ts \
       src/components/atomic-crm/invoicing/__tests__/buildInvoiceDraftFromProject.test.ts \
       src/components/atomic-crm/invoicing/__tests__/buildInvoiceDraftFromClient.test.ts
git commit -m "feat(invoice): add expenses to draft builders, apply Invoice Draft Sign Rule

Project draft: adds expense line items, excludes rimborso from deductions.
Client draft: adds expenses + payment deduction (same sign rule).
Both return null when collectable amount <= 0."
```

---

## Task 10b: Update all call sites for changed builder signatures

**Files:**

- Search and modify: all callers of `buildInvoiceDraftFromProject` and `buildInvoiceDraftFromClient`

Task 10 changed the signatures of both builders (added `expenses` and `payments` parameters). This task finds and updates every call site.

- [ ] **Step 1: Find all call sites for `buildInvoiceDraftFromProject`**

Run: `grep -rn "buildInvoiceDraftFromProject" src/ --include="*.ts" --include="*.tsx" | grep -v "__tests__" | grep -v "\.d\.ts"`

For each call site that doesn't already pass `expenses`, add the expenses parameter. The new parameter has a default value (`[]`) so existing calls won't break at compile time, but they should pass real data for correct behavior.

- [ ] **Step 2: Find all call sites for buildInvoiceDraftFromClient**

Run: `grep -rn "buildInvoiceDraftFromClient" src/ --include="*.ts" --include="*.tsx" | grep -v "__tests__" | grep -v "\.d\.ts"`

Same: update each call to pass `expenses` and `payments` arrays. Default is `[]` so compilation won't fail, but verify each caller has access to the data and passes it.

- [ ] **Step 3: Verify no old-signature calls remain**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: Clean. No type errors.

- [ ] **Step 4: Commit**

```bash
git add -u src/
git commit -m "fix(invoice): update all call sites for new builder signatures

Pass expenses and payments to buildInvoiceDraftFromProject and
buildInvoiceDraftFromClient at every call site."
```

---

## Task 11: Post-migration verification and baseline comparison

**Files:**

- No files modified — verification only

- [ ] **Step 1: Run baseline comparison**

The `_migration_baseline` schema has persistent tables from Task 0. Run the compare:

Run: `psql "postgresql://postgres:postgres@127.0.0.1:55322/postgres" -f scripts/financial-baseline-compare.sql`

- [ ] **Step 2: Review comparison output**

The compare query shows only rows where numbers differ. Expected:
- Foundation-path projects show differences (intentional — they now use payments instead of foundation docs)
- All legacy-path projects show NO differences
- Client-level differences are explained by the client_name→client_id fix or by orphan record inclusion

Document any unexpected differences before proceeding.

- [ ] **Step 3: Verify `client_commercial_position` completeness**

Run: `psql "postgresql://postgres:postgres@127.0.0.1:55322/postgres" -c "SELECT client_name, total_fees, total_expenses, total_paid, balance_due FROM client_commercial_position WHERE balance_due != 0 ORDER BY balance_due DESC;"`

Verify numbers make sense for known clients.

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Run typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/ --ext .ts,.tsx 2>&1 | tail -5`
Expected: Clean.

- [ ] **Step 6: Cleanup baseline tables and log result**

Run: `psql "postgresql://postgres:postgres@127.0.0.1:55322/postgres" -c "DROP SCHEMA IF EXISTS _migration_baseline CASCADE;"`

No files to commit — baseline outputs are local only. Note in the Task 12 docs commit that verification passed (or document exceptions).

---

## Task 12: Update continuity docs

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/development-continuity-map.md`

- [ ] **Step 1: Update architecture.md**

Add/update the Database Views section to document:
- `project_financials` is now single-path (always `payments` table)
- `client_commercial_position` is new, canonical for client-level financials
- The dual-path foundation/legacy is removed
- `financial_documents_summary` remains for document tracking (unchanged)
- New columns: `client_id`, `total_owed` on `project_financials`

Remove references to `payment_semantics_basis`, `documented_outbound_total`, `documented_inbound_total`.

- [ ] **Step 2: Update development-continuity-map.md**

Add an entry for this refactoring documenting:
- What changed and why
- The invariants from the spec
- Which surfaces now read from which view

- [ ] **Step 3: Commit docs**

```bash
git add docs/architecture.md docs/development-continuity-map.md
git commit -m "docs: update architecture for single-source financial views

Document removal of dual-path, new client_commercial_position view,
and canonical financial invariants."
```

---

## Implementation Notes

- `financial-baseline-after.sql` is for manual inspection only; parity is enforced by `financial-baseline-compare.sql`.
- `rimborso` never produces a `PaymentDraftCard` — the AI parser recognizes it for informational guidance only, the draft flow filters it out. This is a product decision, not a missing feature.
- `getSuggestedAmount` is exported from `QuickPaymentDialog.tsx` for testability. If test ergonomics or import weight become an issue, extract it to `quickPaymentUtils.ts`.
- `projects_count` in `client_commercial_position` counts projects with canonical financial activity, not total projects owned by the client.
