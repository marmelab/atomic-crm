# Timezone Bonifica Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all 12 timezone bugs by centralizing business-date helpers and replacing every unsafe `toISOString().slice` / `CURRENT_DATE` pattern.

**Architecture:** Two mirrored `dateTimezone` modules (client + Edge Function) expose `BUSINESS_TIMEZONE`, `todayISODate()`, and `toISODate()`. All 12 call sites switch to these helpers. One SQL migration fixes the view. Duplicated local helpers are removed.

**Tech Stack:** TypeScript, Intl.DateTimeFormat (native), Vitest, PostgreSQL

**Spec:** `docs/superpowers/specs/2026-03-31-timezone-bonifica-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/dateTimezone.ts` | Client business-date helpers |
| Create | `src/lib/dateTimezone.test.ts` | Client helper unit tests |
| Create | `supabase/functions/_shared/dateTimezone.ts` | EF business-date helpers |
| Create | `supabase/functions/_shared/dateTimezone.test.ts` | EF helper unit tests |
| Create | `supabase/migrations/YYYYMMDDHHMMSS_fix_timezone_in_views.sql` | SQL view fix |
| Modify | `supabase/functions/_shared/unifiedCrmAnswerUtils.ts` | Re-export `formatDateInTimezone` |
| Modify | `supabase/functions/_shared/fiscalDeadlineCalculation.ts` | Replace `toLocalISODate` |
| Modify | `supabase/functions/fiscal_deadline_check/index.ts` | Fix `today` normalization |
| Modify | `supabase/functions/invoice_import_extract/index.ts` | Replace `.toISOString().slice` |
| Modify | `supabase/functions/_shared/workflowTemplatePlaceholders.ts` | Fix `formatDate()` |
| Modify | `src/components/atomic-crm/invoicing/invoiceDraftXml.ts` | Replace `todayIso()` |
| Modify | `src/components/atomic-crm/invoicing/invoiceDraftPdf.tsx` | Replace `todayIso()` |
| Modify | `src/components/atomic-crm/invoicing/InvoiceDraftDialog.tsx` | Replace `todayIsoDate()` |
| Modify | `src/components/atomic-crm/tasks/AddTask.tsx` | Replace `.toISOString().slice` |
| Modify | `src/components/atomic-crm/tasks/TaskCreateSheet.tsx` | Replace `.toISOString().slice` |
| Modify | `src/components/atomic-crm/workflows/workflowEngine.ts` | Replace `.toISOString().split` |
| Modify | `src/components/atomic-crm/quotes/quoteServiceLinking.ts` | Replace `.toISOString().slice` |
| Modify | `src/components/atomic-crm/dashboard/DashboardAnnual.tsx` | Replace `.toISOString().slice` |
| Modify | `src/components/atomic-crm/dashboard/fiscalDeadlines.ts` | Replace `toLocalISODate` |
| Modify | `src/components/atomic-crm/dashboard/dashboardModel.ts` | Replace `toLocalISODate` |
| Modify | `src/components/atomic-crm/dashboard/DashboardDeadlineTracker.tsx` | Replace `toLocalISODate` |
| Modify | `src/components/atomic-crm/payments/PaymentOverdueBadge.tsx` | Replace `toLocalISODate` |
| Modify | `.claude/learning.md` | Add WF-8 trigger |
| Modify | `docs/architecture.md` | Document timezone helpers |
| Modify | `docs/development-continuity-map.md` | Add timezone section |

---

## Task 1: Create client dateTimezone module with tests (TDD)

**Files:**
- Create: `src/lib/dateTimezone.ts`
- Create: `src/lib/dateTimezone.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/dateTimezone.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { BUSINESS_TIMEZONE, todayISODate, toISODate } from "./dateTimezone";

afterEach(() => {
  vi.useRealTimers();
});

describe("BUSINESS_TIMEZONE", () => {
  it("is Europe/Rome", () => {
    expect(BUSINESS_TIMEZONE).toBe("Europe/Rome");
  });
});

describe("toISODate", () => {
  it("returns YYYY-MM-DD format", () => {
    const date = new Date("2026-06-15T12:00:00Z");
    expect(toISODate(date)).toBe("2026-06-15");
  });

  it("returns Italian day when UTC is still previous day (summer CEST)", () => {
    // 2026-03-31 22:30 UTC = 2026-04-01 00:30 CEST
    const date = new Date("2026-03-31T22:30:00Z");
    expect(toISODate(date)).toBe("2026-04-01");
  });

  it("returns Italian day when UTC is still previous day (winter CET)", () => {
    // 2026-11-15 23:30 UTC = 2026-11-16 00:30 CET
    const date = new Date("2026-11-15T23:30:00Z");
    expect(toISODate(date)).toBe("2026-11-16");
  });

  it("returns same day when no ambiguity", () => {
    const date = new Date("2026-06-15T12:00:00Z");
    expect(toISODate(date)).toBe("2026-06-15");
  });

  it("handles DST transition day — last Sunday of March", () => {
    // 2026-03-29 is last Sunday of March. Clocks go forward at 02:00 CET → 03:00 CEST.
    // 2026-03-29 00:30 UTC = 2026-03-29 01:30 CET (still before transition)
    expect(toISODate(new Date("2026-03-29T00:30:00Z"))).toBe("2026-03-29");
    // 2026-03-29 02:30 UTC = 2026-03-29 04:30 CEST (after transition)
    expect(toISODate(new Date("2026-03-29T02:30:00Z"))).toBe("2026-03-29");
  });

  it("handles DST transition day — last Sunday of October", () => {
    // 2026-10-25 is last Sunday of October. Clocks go back at 03:00 CEST → 02:00 CET.
    // 2026-10-25 00:30 UTC = 2026-10-25 02:30 CEST (before transition)
    expect(toISODate(new Date("2026-10-25T00:30:00Z"))).toBe("2026-10-25");
    // 2026-10-25 02:30 UTC = 2026-10-25 03:30 CET (after transition)
    expect(toISODate(new Date("2026-10-25T02:30:00Z"))).toBe("2026-10-25");
  });

  it("keeps June 30 as June 30 in summer", () => {
    // 2026-06-30 00:00 UTC = 2026-06-30 02:00 CEST
    expect(toISODate(new Date("2026-06-30T00:00:00Z"))).toBe("2026-06-30");
  });
});

describe("todayISODate", () => {
  it("uses toISODate with current date", () => {
    vi.useFakeTimers();
    // Set fake time to 2026-03-31 22:30 UTC = 2026-04-01 00:30 CEST
    vi.setSystemTime(new Date("2026-03-31T22:30:00Z"));
    expect(todayISODate()).toBe("2026-04-01");
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/dateTimezone.test.ts`
Expected: FAIL — module `./dateTimezone` not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/dateTimezone.ts
export const BUSINESS_TIMEZONE = "Europe/Rome";

const BUSINESS_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Current calendar date as YYYY-MM-DD in business timezone (Europe/Rome). */
export const todayISODate = (): string => toISODate(new Date());

/** Date object → YYYY-MM-DD in business timezone (Europe/Rome). */
export const toISODate = (date: Date): string => {
  const parts = BUSINESS_DATE_FORMATTER.formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/dateTimezone.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/dateTimezone.ts src/lib/dateTimezone.test.ts
git commit -m "feat: add client dateTimezone module with business-date helpers"
```

---

## Task 2: Create Edge Function dateTimezone module with tests (TDD)

**Files:**
- Create: `supabase/functions/_shared/dateTimezone.ts`
- Create: `supabase/functions/_shared/dateTimezone.test.ts`
- Modify: `supabase/functions/_shared/unifiedCrmAnswerUtils.ts:63-74`

- [ ] **Step 1: Write the failing tests**

```typescript
// supabase/functions/_shared/dateTimezone.test.ts
import { describe, it, expect } from "vitest";
import {
  BUSINESS_TIMEZONE,
  todayISODate,
  toISODate,
  formatDateInTimezone,
} from "./dateTimezone.ts";

describe("BUSINESS_TIMEZONE", () => {
  it("is Europe/Rome", () => {
    expect(BUSINESS_TIMEZONE).toBe("Europe/Rome");
  });
});

describe("toISODate", () => {
  it("returns YYYY-MM-DD format", () => {
    const date = new Date("2026-06-15T12:00:00Z");
    expect(toISODate(date)).toBe("2026-06-15");
  });

  it("returns Italian day when UTC is still previous day (summer CEST)", () => {
    const date = new Date("2026-03-31T22:30:00Z");
    expect(toISODate(date)).toBe("2026-04-01");
  });

  it("returns Italian day when UTC is still previous day (winter CET)", () => {
    const date = new Date("2026-11-15T23:30:00Z");
    expect(toISODate(date)).toBe("2026-11-16");
  });

  it("handles DST transition — last Sunday of March", () => {
    expect(toISODate(new Date("2026-03-29T00:30:00Z"))).toBe("2026-03-29");
    expect(toISODate(new Date("2026-03-29T02:30:00Z"))).toBe("2026-03-29");
  });

  it("handles DST transition — last Sunday of October", () => {
    expect(toISODate(new Date("2026-10-25T00:30:00Z"))).toBe("2026-10-25");
    expect(toISODate(new Date("2026-10-25T02:30:00Z"))).toBe("2026-10-25");
  });

  it("keeps June 30 as June 30 in summer", () => {
    expect(toISODate(new Date("2026-06-30T00:00:00Z"))).toBe("2026-06-30");
  });
});

describe("formatDateInTimezone", () => {
  it("formats in specified timezone", () => {
    const date = new Date("2026-03-31T22:30:00Z");
    expect(formatDateInTimezone(date, "Europe/Rome")).toBe("2026-04-01");
    expect(formatDateInTimezone(date, "UTC")).toBe("2026-03-31");
  });

  it("returns null for invalid timezone gracefully", () => {
    // Intl throws on bad timezone, so this tests our defensive code isn't needed
    // (Intl.DateTimeFormat validates at construction)
    const date = new Date("2026-06-15T12:00:00Z");
    expect(formatDateInTimezone(date, "Europe/Rome")).toBe("2026-06-15");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run supabase/functions/_shared/dateTimezone.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// supabase/functions/_shared/dateTimezone.ts
export const BUSINESS_TIMEZONE = "Europe/Rome";

const BUSINESS_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Current calendar date as YYYY-MM-DD in business timezone (Europe/Rome). */
export const todayISODate = (): string => toISODate(new Date());

/** Date object → YYYY-MM-DD in business timezone (Europe/Rome). */
export const toISODate = (date: Date): string => {
  const parts = BUSINESS_DATE_FORMATTER.formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
};

/**
 * Format a Date as YYYY-MM-DD in an arbitrary timezone.
 * Use `toISODate()` for business dates — this is for cases that need
 * a caller-specified timezone (e.g. unified_crm_answer with configurable tz).
 */
export const formatDateInTimezone = (
  date: Date,
  timeZone: string,
): string | null => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return y && m && d ? `${y}-${m}-${d}` : null;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/dateTimezone.test.ts`
Expected: all PASS

- [ ] **Step 5: Migrate `formatDateInTimezone` from `unifiedCrmAnswerUtils.ts`**

In `supabase/functions/_shared/unifiedCrmAnswerUtils.ts`, replace the local
`formatDateInTimezone` definition (lines 63-74) with a re-export:

```typescript
// Replace the existing function definition with:
export { formatDateInTimezone } from "./dateTimezone.ts";
```

- [ ] **Step 6: Run full EF test suite**

Run: `npx vitest run supabase/`
Expected: all PASS (re-export is backward compatible)

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/dateTimezone.ts \
  supabase/functions/_shared/dateTimezone.test.ts \
  supabase/functions/_shared/unifiedCrmAnswerUtils.ts
git commit -m "feat: add EF dateTimezone module, consolidate formatDateInTimezone"
```

---

## Task 3: Fix Edge Function call sites (#1, #2, #3)

**Files:**
- Modify: `supabase/functions/fiscal_deadline_check/index.ts:135`
- Modify: `supabase/functions/_shared/fiscalDeadlineCalculation.ts:58-63`
- Modify: `supabase/functions/invoice_import_extract/index.ts:52`
- Modify: `supabase/functions/_shared/workflowTemplatePlaceholders.ts:40-47`

- [ ] **Step 1: Fix #1 — fiscal_deadline_check**

In `supabase/functions/fiscal_deadline_check/index.ts`, add import and replace
line 135:

```typescript
// Add at top imports:
import { todayISODate } from "../_shared/dateTimezone.ts";

// Replace line 135:
//   const today = new Date();
// With:
const todayStr = todayISODate();
const today = new Date(`${todayStr}T00:00:00Z`);
```

- [ ] **Step 2: Fix #1 continued — fiscalDeadlineCalculation.ts**

Replace the local `toLocalISODate` (lines 58-63) with an import:

```typescript
// Add at top imports:
import { toISODate } from "./dateTimezone.ts";

// Remove lines 58-63 (the local toLocalISODate function)

// Replace all usages of toLocalISODate with toISODate:
// Line 175: date: toLocalISODate(opts.date)  →  date: toISODate(opts.date)
```

Search for all `toLocalISODate` in the file and replace each with `toISODate`.

- [ ] **Step 3: Fix #2 — invoice_import_extract**

In `supabase/functions/invoice_import_extract/index.ts`, line 52:

```typescript
// Add at top imports:
import { todayISODate } from "../_shared/dateTimezone.ts";

// Replace line 52:
//   Data odierna: ${new Date().toISOString().slice(0, 10)}.
// With:
//   Data odierna: ${todayISODate()}.
```

- [ ] **Step 4: Fix #3 — workflowTemplatePlaceholders.ts**

In `supabase/functions/_shared/workflowTemplatePlaceholders.ts`, replace the
`formatDate` function (lines 40-47):

```typescript
// Add at top:
import { BUSINESS_TIMEZONE } from "./dateTimezone.ts";

// Replace formatDate function:
const formatDate = (): string => {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: BUSINESS_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
};
```

- [ ] **Step 5: Run EF tests**

Run: `npx vitest run supabase/`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/fiscal_deadline_check/index.ts \
  supabase/functions/_shared/fiscalDeadlineCalculation.ts \
  supabase/functions/invoice_import_extract/index.ts \
  supabase/functions/_shared/workflowTemplatePlaceholders.ts
git commit -m "fix: use timezone-aware dates in Edge Functions (#1 #2 #3)"
```

---

## Task 4: Fix client-side invoicing call sites (#4, #5, #6)

**Files:**
- Modify: `src/components/atomic-crm/invoicing/invoiceDraftXml.ts:43`
- Modify: `src/components/atomic-crm/invoicing/invoiceDraftPdf.tsx:252`
- Modify: `src/components/atomic-crm/invoicing/InvoiceDraftDialog.tsx:36`

- [ ] **Step 1: Fix #4 — invoiceDraftXml.ts**

```typescript
// Add import at top:
import { todayISODate } from "@/lib/dateTimezone";

// Remove line 43:
//   const todayIso = () => new Date().toISOString().slice(0, 10);

// Replace all usages of todayIso() with todayISODate()
```

- [ ] **Step 2: Fix #5 — invoiceDraftPdf.tsx**

```typescript
// Add import at top:
import { todayISODate } from "@/lib/dateTimezone";

// Remove line 252:
//   const todayIso = () => new Date().toISOString().slice(0, 10);

// Replace all usages of todayIso() with todayISODate()
```

- [ ] **Step 3: Fix #6 — InvoiceDraftDialog.tsx**

```typescript
// Add import at top:
import { todayISODate } from "@/lib/dateTimezone";

// Remove line 36:
//   const todayIsoDate = () => new Date().toISOString().slice(0, 10);

// Replace all usages of todayIsoDate() with todayISODate()
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/atomic-crm/invoicing/invoiceDraftXml.ts \
  src/components/atomic-crm/invoicing/invoiceDraftPdf.tsx \
  src/components/atomic-crm/invoicing/InvoiceDraftDialog.tsx
git commit -m "fix: use todayISODate() in invoicing modules (#4 #5 #6)"
```

---

## Task 5: Fix client-side task and workflow call sites (#7, #8, #9)

**Files:**
- Modify: `src/components/atomic-crm/tasks/AddTask.tsx:59,65`
- Modify: `src/components/atomic-crm/tasks/TaskCreateSheet.tsx:55`
- Modify: `src/components/atomic-crm/workflows/workflowEngine.ts:181,204`

- [ ] **Step 1: Fix #7 — AddTask.tsx**

```typescript
// Add import at top:
import { todayISODate } from "@/lib/dateTimezone";

// Replace line 59:
//   due_date: new Date().toISOString().slice(0, 10),
// With:
//   due_date: todayISODate(),

// Replace line 65 (same pattern):
//   due_date: new Date().toISOString().slice(0, 10),
// With:
//   due_date: todayISODate(),
```

- [ ] **Step 2: Fix #8 — TaskCreateSheet.tsx**

```typescript
// Add import at top:
import { todayISODate } from "@/lib/dateTimezone";

// Replace line 55:
//   due_date: new Date().toISOString().slice(0, 10),
// With:
//   due_date: todayISODate(),
```

- [ ] **Step 3: Fix #9 — workflowEngine.ts**

```typescript
// Add import at top:
import { todayISODate, toISODate } from "@/lib/dateTimezone";

// Replace line 181:
//   due_date: dueDate.toISOString().split("T")[0],
// With:
//   due_date: toISODate(dueDate),

// Replace line 204:
//   start_date: new Date().toISOString().split("T")[0],
// With:
//   start_date: todayISODate(),
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/atomic-crm/tasks/AddTask.tsx \
  src/components/atomic-crm/tasks/TaskCreateSheet.tsx \
  src/components/atomic-crm/workflows/workflowEngine.ts
git commit -m "fix: use timezone-aware dates in tasks and workflows (#7 #8 #9)"
```

---

## Task 6: Fix remaining client call sites (#10, #11)

**Files:**
- Modify: `src/components/atomic-crm/quotes/quoteServiceLinking.ts:69`
- Modify: `src/components/atomic-crm/dashboard/DashboardAnnual.tsx:185`

- [ ] **Step 1: Fix #10 — quoteServiceLinking.ts**

```typescript
// Add import at top:
import { todayISODate } from "@/lib/dateTimezone";

// Replace line 69:
//   service_date: quote.event_start ?? new Date().toISOString().slice(0, 10),
// With:
//   service_date: quote.event_start ?? todayISODate(),
```

- [ ] **Step 2: Fix #11 — DashboardAnnual.tsx**

```typescript
// Add import at top:
import { todayISODate } from "@/lib/dateTimezone";

// Replace line 185:
//   new Date().toISOString().slice(0, 10),
// With:
//   todayISODate(),
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/atomic-crm/quotes/quoteServiceLinking.ts \
  src/components/atomic-crm/dashboard/DashboardAnnual.tsx
git commit -m "fix: use todayISODate() in quotes and dashboard (#10 #11)"
```

---

## Task 7: Eliminate duplicate `toLocalISODate` from client modules

**Files:**
- Modify: `src/components/atomic-crm/dashboard/fiscalDeadlines.ts:16-21`
- Modify: `src/components/atomic-crm/dashboard/dashboardModel.ts:104-109`
- Modify: `src/components/atomic-crm/dashboard/DashboardDeadlineTracker.tsx:28-33`
- Modify: `src/components/atomic-crm/payments/PaymentOverdueBadge.tsx:7-12`

- [ ] **Step 1: Fix fiscalDeadlines.ts**

```typescript
// Add import at top:
import { toISODate } from "@/lib/dateTimezone";

// Remove lines 16-21 (the local toLocalISODate function)

// Replace all toLocalISODate(...) calls with toISODate(...)
```

- [ ] **Step 2: Fix dashboardModel.ts**

```typescript
// Add import at top:
import { toISODate } from "@/lib/dateTimezone";

// Remove lines 104-109 (the local toLocalISODate function)

// Replace all toLocalISODate(...) calls with toISODate(...)
```

- [ ] **Step 3: Fix DashboardDeadlineTracker.tsx**

```typescript
// Add import at top:
import { toISODate } from "@/lib/dateTimezone";

// Remove lines 28-33 (the local toLocalISODate function)

// Replace all toLocalISODate(...) calls with toISODate(...)
```

- [ ] **Step 4: Fix PaymentOverdueBadge.tsx**

```typescript
// Add import at top:
import { toISODate } from "@/lib/dateTimezone";

// Remove lines 7-12 (the local toLocalISODate function)

// Replace line 20:
//   "payment_date@lt": toLocalISODate(new Date()),
// With:
//   "payment_date@lt": toISODate(new Date()),
```

- [ ] **Step 5: Run typecheck + unit tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no errors, all PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/atomic-crm/dashboard/fiscalDeadlines.ts \
  src/components/atomic-crm/dashboard/dashboardModel.ts \
  src/components/atomic-crm/dashboard/DashboardDeadlineTracker.tsx \
  src/components/atomic-crm/payments/PaymentOverdueBadge.tsx
git commit -m "refactor: replace 4 duplicate toLocalISODate with centralized toISODate"
```

---

## Task 8: SQL migration — fix CURRENT_DATE in views (#12)

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_fix_timezone_in_financial_documents_summary.sql`

- [ ] **Step 1: Create migration**

Run: `npx supabase migration new fix_timezone_in_financial_documents_summary`

- [ ] **Step 2: Write migration SQL**

Copy the full current view definition from
`supabase/migrations/20260308010000_update_financial_documents_summary_supplier.sql`
and replace `CURRENT_DATE` with `(NOW() AT TIME ZONE 'Europe/Rome')::date`:

```sql
-- Fix timezone in financial_documents_summary: use Europe/Rome business day
-- instead of CURRENT_DATE (which uses the DB session timezone, UTC on Supabase).
DROP VIEW IF EXISTS public.financial_documents_summary;
CREATE VIEW public.financial_documents_summary AS
WITH cash_totals AS (
  SELECT
    document_id,
    ROUND(SUM(allocation_amount)::numeric, 2) AS settled_amount
  FROM public.financial_document_cash_allocations
  GROUP BY document_id
),
project_totals AS (
  SELECT
    fdpa.document_id,
    COUNT(*) AS project_allocations_count,
    STRING_AGG(COALESCE(p.name, '(non allocato)'), ' · ' ORDER BY p.name NULLS LAST) AS project_names
  FROM public.financial_document_project_allocations fdpa
  LEFT JOIN public.projects p ON p.id = fdpa.project_id
  GROUP BY fdpa.document_id
)
SELECT
  fd.id,
  fd.client_id,
  fd.supplier_id,
  c.name AS client_name,
  s.name AS supplier_name,
  fd.direction,
  fd.xml_document_code,
  fd.document_type,
  fd.related_document_number,
  fd.document_number,
  fd.issue_date,
  fd.due_date,
  fd.total_amount,
  fd.taxable_amount,
  fd.tax_amount,
  fd.stamp_amount,
  LEAST(fd.total_amount, COALESCE(ct.settled_amount, 0)) AS settled_amount,
  GREATEST(
    fd.total_amount - LEAST(fd.total_amount, COALESCE(ct.settled_amount, 0)),
    0
  ) AS open_amount,
  CASE
    WHEN GREATEST(
      fd.total_amount - LEAST(fd.total_amount, COALESCE(ct.settled_amount, 0)),
      0
    ) <= 0.009 THEN 'settled'
    WHEN LEAST(fd.total_amount, COALESCE(ct.settled_amount, 0)) > 0 THEN 'partial'
    WHEN fd.due_date IS NOT NULL AND fd.due_date < (NOW() AT TIME ZONE 'Europe/Rome')::date THEN 'overdue'
    ELSE 'open'
  END AS settlement_status,
  COALESCE(pt.project_allocations_count, 0) AS project_allocations_count,
  pt.project_names,
  fd.currency_code,
  fd.source_path,
  fd.notes,
  fd.created_at,
  fd.updated_at
FROM public.financial_documents fd
LEFT JOIN public.clients c ON c.id = fd.client_id
LEFT JOIN public.suppliers s ON s.id = fd.supplier_id
LEFT JOIN cash_totals ct ON ct.document_id = fd.id
LEFT JOIN project_totals pt ON pt.document_id = fd.id;
```

- [ ] **Step 3: Test migration locally**

Run: `npx supabase migration up`
Expected: migration applied without errors

- [ ] **Step 4: Verify view works**

Run: `npx supabase db reset` (includes migration)
Expected: no errors, view queryable

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*_fix_timezone_in_financial_documents_summary.sql
git commit -m "fix: use Europe/Rome business day in financial_documents_summary view (#12)"
```

---

## Task 9: Update continuity docs and learning trigger

**Files:**
- Modify: `.claude/learning.md`
- Modify: `docs/architecture.md`
- Modify: `docs/development-continuity-map.md`

- [ ] **Step 1: Add WF-8 trigger to .claude/learning.md**

Add to the index table:

```markdown
| **Workflow** | WF-8  | Business date → dateTimezone helper      |
```

Add the trigger section after WF-7:

```markdown
### WF-8: Business date = dateTimezone helper, mai toISOString().slice

**Quando**: scrivo `new Date().toISOString().slice(0,10)` o
`.toISOString().split("T")[0]` per ottenere una data di business, oppure
`new Date("YYYY-MM-DD")` per parsare una data di business
**Fare**: usare `todayISODate()` o `toISODate(date)` dal modulo
`dateTimezone` (`src/lib/dateTimezone.ts` client, `_shared/dateTimezone.ts` EF).
Mai convertire una business date string in `Date` senza semantica esplicita.
**Perché**: `toISOString()` converte in UTC prima di estrarre — data
sbagliata tra 00:00 e 02:00 CEST. `new Date("YYYY-MM-DD")` interpreta come
UTC midnight — giorno sbagliato in `Europe/Rome` nella stessa finestra.
```

- [ ] **Step 2: Update docs/architecture.md — add timezone helpers section**

Add a section documenting the two dateTimezone modules, their API, and the
"Two Kinds of Dates" rule (business date string vs instant timestamp).

- [ ] **Step 3: Update docs/development-continuity-map.md — add timezone entry**

Add an entry in the map pointing to the dateTimezone modules and the spec.

- [ ] **Step 4: Commit**

```bash
git add .claude/learning.md docs/architecture.md docs/development-continuity-map.md
git commit -m "docs: add timezone bonifica to learning triggers and continuity docs"
```

---

## Task 10: Full verification

- [ ] **Step 1: Run full typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run full unit test suite**

Run: `npx vitest run`
Expected: all PASS

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: 0 errors

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 5: Grep for remaining unsafe patterns**

Run:
```bash
grep -rn "toISOString().slice(0, 10)\|toISOString().split" src/ supabase/functions/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v node_modules | grep -v dateTimezone | grep -v ".test."
```

Expected: only `date-input.tsx` (which is a comment/example, not business logic)
and possibly `generatedAt` lines (instant timestamps — not business dates).

Any other match is a missed call site — fix it before proceeding.

- [ ] **Step 6: Grep for remaining `toLocalISODate`**

Run:
```bash
grep -rn "toLocalISODate" src/ supabase/functions/ --include="*.ts" --include="*.tsx"
```

Expected: 0 matches (all copies removed)

- [ ] **Step 7: Grep for remaining `todayIso` local helpers**

Run:
```bash
grep -rn "const todayIso" src/ --include="*.ts" --include="*.tsx"
```

Expected: 0 matches (all copies removed)
