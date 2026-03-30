# Bugfix Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 11 verified bugs found during deterministic codebase audit — type mismatches, missing UI data, formatting inconsistencies.

**Architecture:** All fixes are isolated per-file changes. No new files, no new dependencies, no architectural changes. Each tier groups related fixes to minimize surface area.

**Tech Stack:** TypeScript, React, ra-core hooks, Tailwind CSS

**Spec:** `.planning/bugfix-audit-spec.md`

---

## File Map

| Task | Action | File |
|------|--------|------|
| 1 | Modify | `src/components/atomic-crm/types.ts` |
| 1 | Modify | `src/components/atomic-crm/clients/clientLinking.ts` |
| 2 | Modify | `src/components/atomic-crm/suppliers/SupplierInputs.tsx` |
| 3 | Modify | `src/components/atomic-crm/projects/ProjectShow.tsx` |
| 3 | Modify | `src/components/atomic-crm/projects/ProjectKanbanView.tsx` |
| 4 | Modify | `src/components/atomic-crm/expenses/ExpenseMobileCard.tsx` |
| 5 | Modify | `src/components/atomic-crm/dashboard/DashboardKpiCards.tsx` |
| 6 | Modify | `src/components/atomic-crm/providers/supabase/dataProvider.ts` |

---

### Task 1: Type Safety Fixes (A1 + A2 + A3)

**Files:**
- Modify: `src/components/atomic-crm/types.ts:189` (Payment.client_id)
- Modify: `src/components/atomic-crm/types.ts:185` (Service.updated_at)
- Modify: `src/components/atomic-crm/types.ts:205` (Payment.updated_at)
- Modify: `src/components/atomic-crm/types.ts:343` (Expense.updated_at)
- Modify: `src/components/atomic-crm/clients/clientLinking.ts:95`

**Context:**
- `Payment.client_id` is declared as required (`Identifier`) but DB allows NULL. Pattern to follow: `project_id?: Identifier | null` at line 190.
- `Service`, `Payment`, `Expense` lack `updated_at` field that exists in DB (migration `20260227224448`). Pattern to follow: `Project` type has `updated_at: string` at line 153.
- `getClientCreateDefaultsFromSearch()` omits `tags: []`. Pattern to follow: `contactLinking.ts:52` initializes `tags: []`.

- [ ] **Step 1: Fix Payment.client_id nullability**

In `src/components/atomic-crm/types.ts`, change line 189 from:
```typescript
  client_id: Identifier;
```
to:
```typescript
  client_id?: Identifier | null;
```

- [ ] **Step 2: Add updated_at to Service type**

In `src/components/atomic-crm/types.ts`, after line 185 (`created_at: string;`), add:
```typescript
  updated_at?: string;
```

- [ ] **Step 3: Add updated_at to Payment type**

In `src/components/atomic-crm/types.ts`, after line 205 (`created_at: string;`) in the Payment type, add:
```typescript
  updated_at?: string;
```

- [ ] **Step 4: Add updated_at to Expense type**

In `src/components/atomic-crm/types.ts`, after line 343 (`created_at: string;`) in the Expense type, add:
```typescript
  updated_at?: string;
```

- [ ] **Step 5: Fix client tags default**

In `src/components/atomic-crm/clients/clientLinking.ts`, in the return object of `getClientCreateDefaultsFromSearch()` (line 95-109), add `tags: []` to the returned object. After `notes: getOptional("notes"),` add:
```typescript
    tags: [],
```

- [ ] **Step 6: Verify Payment.client_id consumers compile**

Run: `make typecheck`

Expected: If any consumer accesses `payment.client_id` without guarding for null/undefined, TypeScript will flag it. The known consumers are:
- `PaymentListContent.tsx:199` — `useGetOne("clients", { id: payment.client_id })` — safe because `useGetOne` accepts undefined and the hook has `enabled` guard pattern in ra-core
- `PaymentListContent.tsx:230` — same pattern, safe
- `DashboardDeadlineTracker.tsx:276,302` — `getClientName(clientsById, payment.client_id)` — need to verify `getClientName` accepts undefined

If typecheck fails, add optional chaining or null guards to the flagged lines.

- [ ] **Step 7: Run full validation**

Run: `make typecheck && make lint && make build`
Expected: all pass with 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/atomic-crm/types.ts src/components/atomic-crm/clients/clientLinking.ts
git commit -m "fix(types): align Payment.client_id nullability, add missing updated_at, init client tags"
```

---

### Task 2: Supplier Dropdown Fix (B1)

**Files:**
- Modify: `src/components/atomic-crm/suppliers/SupplierInputs.tsx:6-14`

**Context:**
- `SupplierInputs.tsx` duplicates expense type choices locally, missing `credito_ricevuto`.
- Canonical source: `src/components/atomic-crm/expenses/expenseTypes.ts` exports `expenseTypeChoices` (8 items including `credito_ricevuto`).
- Fix: import from canonical source instead of maintaining a duplicate list.

- [ ] **Step 1: Replace local choices with import**

In `src/components/atomic-crm/suppliers/SupplierInputs.tsx`, remove the local `supplierExpenseTypeChoices` array (lines 6-14) and add an import from the canonical source.

Remove:
```typescript
const supplierExpenseTypeChoices = [
  { id: "spostamento_km", name: "Spostamento Km" },
  { id: "pedaggio_autostradale", name: "Pedaggio autostradale" },
  { id: "vitto_alloggio", name: "Vitto e alloggio" },
  { id: "acquisto_materiale", name: "Acquisto materiale" },
  { id: "abbonamento_software", name: "Abbonamento software" },
  { id: "noleggio", name: "Noleggio" },
  { id: "altro", name: "Altro" },
];
```

Add import at top of file (after existing imports):
```typescript
import { expenseTypeChoices } from "../expenses/expenseTypes";
```

- [ ] **Step 2: Update SelectInput reference**

In the same file, find the `<SelectInput>` for `default_expense_type` and change `choices={supplierExpenseTypeChoices}` to `choices={expenseTypeChoices}`.

Note: `expenseTypeChoices` is `as const` — if TypeScript complains about readonly, cast: `choices={[...expenseTypeChoices]}`.

- [ ] **Step 3: Validate**

Run: `make typecheck && make lint`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/atomic-crm/suppliers/SupplierInputs.tsx
git commit -m "fix(suppliers): use canonical expenseTypeChoices, add missing credito_ricevuto"
```

---

### Task 3: Budget Formatting Unification (B4)

**Files:**
- Modify: `src/components/atomic-crm/projects/ProjectShow.tsx:189`
- Modify: `src/components/atomic-crm/projects/ProjectKanbanView.tsx:230`

**Context:**
- Three different budget formats exist:
  1. `ProjectShow.tsx:189` — `EUR ${record.budget.toLocaleString("it-IT", { minimumFractionDigits: 2 })}` → `EUR 1.500,00`
  2. `ProjectShow.tsx:204` — local `eur()` helper with `style: "currency"` → `1.500,00 €`
  3. `ProjectKanbanView.tsx:230` — `formatCurrency(project.budget)` → `1.500 €` (no decimals)
- Unify on `formatCurrencyPrecise` from `dashboardFormatters.ts` which produces `1.500,00 €` (standard Italian EUR format with 2 decimals).

- [ ] **Step 1: Fix ProjectShow.tsx budget format**

In `src/components/atomic-crm/projects/ProjectShow.tsx`, add import:
```typescript
import { formatCurrencyPrecise } from "../dashboard/dashboardFormatters";
```

Change line 189 from:
```typescript
          value={`EUR ${record.budget.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`}
```
to:
```typescript
          value={formatCurrencyPrecise(record.budget)}
```

- [ ] **Step 2: Fix ProjectKanbanView.tsx budget format**

In `src/components/atomic-crm/projects/ProjectKanbanView.tsx`, check imports: if it imports `formatCurrency` from `dashboardFormatters`, change that import to also include `formatCurrencyPrecise` (or replace if `formatCurrency` is only used for budget).

Change line 230 from:
```typescript
                Budget: {formatCurrency(project.budget)}
```
to:
```typescript
                Budget: {formatCurrencyPrecise(project.budget)}
```

- [ ] **Step 3: Validate**

Run: `make typecheck && make lint`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/atomic-crm/projects/ProjectShow.tsx src/components/atomic-crm/projects/ProjectKanbanView.tsx
git commit -m "fix(projects): unify budget formatting to formatCurrencyPrecise"
```

---

### Task 4: Expense Mobile Card — Add Supplier Name (B3)

**Files:**
- Modify: `src/components/atomic-crm/expenses/ExpenseMobileCard.tsx`

**Context:**
- Mobile card fetches only project name, not supplier name.
- Desktop row (`ExpenseListContent.tsx:188-196`) uses: `useGetOne("suppliers", { id: expense.supplier_id ?? undefined }, { enabled: !!expense.supplier_id })`
- Replicate the same pattern in mobile card.

- [ ] **Step 1: Add supplier fetch**

In `src/components/atomic-crm/expenses/ExpenseMobileCard.tsx`, after the existing `useGetOne("projects"...)` call (line 17-21), add:

```typescript
  const { data: supplier } = useGetOne(
    "suppliers",
    { id: expense.supplier_id ?? undefined },
    { enabled: !!expense.supplier_id },
  );
```

- [ ] **Step 2: Display supplier name**

In the same file, after the project name display (line 40-42), add the supplier name. Change:
```tsx
          <span className="text-xs text-muted-foreground">
            {project?.name ?? ""}
          </span>
```
to:
```tsx
          <span className="text-xs text-muted-foreground truncate">
            {[project?.name, supplier?.name].filter(Boolean).join(" · ")}
          </span>
```

This shows `"ProjectName · SupplierName"` when both exist, `"ProjectName"` or `"SupplierName"` when only one exists, or empty when neither.

- [ ] **Step 3: Validate**

Run: `make typecheck && make lint`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/atomic-crm/expenses/ExpenseMobileCard.tsx
git commit -m "fix(expenses): show supplier name in mobile card for desktop parity"
```

---

### Task 5: DashboardKpiCards — Fix Compact Prop + DeltaArrow (B2 + C2)

**Files:**
- Modify: `src/components/atomic-crm/dashboard/DashboardKpiCards.tsx`

**Context:**
- `compact?: boolean` prop is declared (line 32) but never destructured or used. `MobileDashboard.tsx:154` passes it.
- Decision: The grid already uses `grid-cols-1 sm:grid-cols-2 xl:grid-cols-5` which provides responsive layout. On mobile (< sm), it's already `grid-cols-1`. The `compact` prop was likely intended for tighter spacing. Implement minimal compact: reduce gap and use smaller text.
- `DeltaArrow`: when `value === 0` and no `label`, shows a lone `=` with no context. Fix: show `0%` instead.

- [ ] **Step 1: Destructure and use compact prop**

In `src/components/atomic-crm/dashboard/DashboardKpiCards.tsx`, change the component signature (lines 22-35) to destructure `compact`:

```typescript
export const DashboardKpiCards = ({
  kpis,
  meta,
  year: _year,
  compact,
  fiscalKpis = null,
  taxesPaid = 0,
}: {
  kpis: DashboardKpis;
  meta: DashboardMeta;
  year: number;
  compact?: boolean;
  fiscalKpis?: FiscalKpis | null;
  taxesPaid?: number;
}) => (
```

Then change the grid div (line 36) from:
```tsx
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
```
to:
```tsx
  <div className={`grid grid-cols-1 sm:grid-cols-2 ${compact ? "gap-3" : "xl:grid-cols-5 gap-4"}`}>
```

In compact mode: stays 2-col max on sm+, smaller gap. Non-compact (desktop): expands to 5-col on xl.

- [ ] **Step 2: Fix DeltaArrow zero without label**

In the same file, in the `DeltaArrow` component (around line 213-218), change the flat case from:
```tsx
  if (isFlat) {
    return (
      <span className="text-xs text-muted-foreground font-medium">
        = {label}
      </span>
    );
  }
```
to:
```tsx
  if (isFlat) {
    return (
      <span className="text-xs text-muted-foreground font-medium">
        0% {label}
      </span>
    );
  }
```

This shows `0%` (always meaningful) optionally followed by the label.

- [ ] **Step 3: Validate**

Run: `make typecheck && make lint`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/atomic-crm/dashboard/DashboardKpiCards.tsx
git commit -m "fix(dashboard): implement compact prop in KpiCards, fix DeltaArrow zero display"
```

---

### Task 6: JSON.parse Defensive Fix (C3)

**Files:**
- Modify: `src/components/atomic-crm/providers/supabase/dataProvider.ts:236`

**Context:**
- `JSON.parse(data.value)` can throw on corrupt data.
- Data is auto-generated by the same code (`JSON.stringify`), so corruption is unlikely but possible.
- Fix: wrap in try-catch, return null on failure.

- [ ] **Step 1: Add try-catch**

In `src/components/atomic-crm/providers/supabase/dataProvider.ts`, change line 236 from:
```typescript
    return data ? JSON.parse(data.value) : null;
```
to:
```typescript
    if (!data) return null;
    try {
      return JSON.parse(data.value);
    } catch {
      return null;
    }
```

- [ ] **Step 2: Validate**

Run: `make typecheck && make lint`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/atomic-crm/providers/supabase/dataProvider.ts
git commit -m "fix(provider): add try-catch for JSON.parse in getColumnPreferences"
```

---

### Task 7: Final Validation

- [ ] **Step 1: Full build validation**

Run: `make typecheck && make lint && make build`
Expected: all pass with 0 errors.

- [ ] **Step 2: Run tests**

Run: `make test`
Expected: all existing tests pass, none broken.

- [ ] **Step 3: Update continuity docs if needed by pre-commit hook**

The pre-commit hook runs `npm run continuity:check`. If it requires doc updates for the files touched, update the relevant docs in the same commit.

---

## Deferred (not in this plan)

| Bug | Reason |
|-----|--------|
| C1 — Budget in mobile project card | Design choice — not a bug. Discuss with user separately. |
| C4 — N+1 query client name | Performance optimization, not functional bug. react-query cache mitigates. |
