# Timezone Bonifica — Design Spec

**Date**: 2026-03-31
**Status**: Approved
**Scope**: Fix all 12 timezone-related bugs identified in the audit

## Problem

The codebase has two runtimes with different timezones:

- **Browser (client)**: device local timezone (variable — depends on user location)
- **Edge Functions (server)**: UTC (Deno runtime)
- **Business timezone**: `Europe/Rome` (UTC+1 winter, UTC+2 summer) — used by
  application logic regardless of runtime or device timezone

12 code locations use patterns that extract the date portion after converting to
UTC (`toISOString().slice(0,10)`, `toISOString().split("T")[0]`), producing the
wrong calendar day between 00:00 and 02:00 CEST (01:00 CET winter). This
affects legal documents (FatturaPA XML), fiscal deadline calculations, task
defaults, and SQL views.

## Canonical Business Timezone

All business-calendar dates in this application are defined in `Europe/Rome`,
regardless of the timezone of the device or the runtime.

This is not "the user's local timezone" — it is the timezone of the Italian
fiscal and business domain. If the user is traveling abroad, the application
still operates on Italian calendar dates. If an Edge Function runs in UTC, it
still resolves "today" as the Italian calendar day.

This distinction prevents future confusion about whether to use "local time" or
"business time". The answer is always: business time = `Europe/Rome`.

## Risk Window

- **Winter (CET, UTC+1)**: 00:00–01:00 Italian time
- **Summer (CEST, UTC+2)**: 00:00–02:00 Italian time

During this window, `new Date().toISOString()` returns the previous UTC day.

## Two Kinds of Dates

The codebase handles two distinct concepts:

1. **Business date strings** (`YYYY-MM-DD`) — fiscal deadlines, invoice dates,
   task due dates, service dates, payment dates. These represent a calendar day
   in the Italian business domain, not a point in time. They should always be
   produced via `toISODate()` / `todayISODate()`, never via `toISOString()`.

2. **Instant timestamps** (full ISO with `T` and `Z`) — `created_at`,
   `updated_at`, `generatedAt`, `done_date`. These represent a precise moment
   in time and are correctly stored as UTC. No change needed for these.

Rule: if a value answers "which calendar day?", it is a business date string.
If it answers "when exactly did this happen?", it is an instant timestamp.

**A `YYYY-MM-DD` business date must not be converted to `Date` unless the
target semantics are explicitly documented.** `new Date(dateOnlyString)` is
forbidden for business dates — it silently interprets the string as UTC
midnight, which is a different calendar day in `Europe/Rome` during the risk
window. The only exception is the normalized UTC anchor in Fix #1, which is
documented and intentional.

## Forbidden / Allowed Patterns

### Forbidden for business dates

```typescript
// These all extract UTC date, not business date
new Date().toISOString().slice(0, 10)
new Date().toISOString().split("T")[0]
new Date("2026-06-30")        // parses as UTC midnight
Date.parse("2026-06-30")      // same problem
date.getDate()                // returns day in runtime timezone, not business tz
date.getMonth()               // same problem — runtime tz, not business tz
date.getFullYear()            // same problem at year boundaries
```

### Allowed

```typescript
// Business date generation
todayISODate()                 // → "2026-06-30" in Europe/Rome
toISODate(someDate)            // → "2026-06-30" in Europe/Rome

// Display formatting (presentation only, not for logic)
new Intl.DateTimeFormat("it-IT", { timeZone: BUSINESS_TIMEZONE, ... })

// Instant timestamps (not business dates)
new Date().toISOString()       // → "2026-06-30T22:30:00.000Z" — fine for created_at etc.
```

## Solution: Centralized Timezone-Aware Helpers

### Constants

A single `BUSINESS_TIMEZONE = "Europe/Rome"` constant defined in each module,
importable from one place.

### Helper roles

- `todayISODate()` / `toISODate(date)` — **business date generation**: produce
  `YYYY-MM-DD` strings for storage, comparisons, and business logic
- `Intl.DateTimeFormat("it-IT", { timeZone: BUSINESS_TIMEZONE })` — **display
  formatting**: produce human-readable strings for UI presentation only

These must not be mixed: display formatters must not be used to generate dates
for storage or logic, and business date helpers must not be used for UI labels.

### Client Module — `src/lib/dateTimezone.ts`

```typescript
export const BUSINESS_TIMEZONE = "Europe/Rome";

const BUSINESS_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Current calendar date as YYYY-MM-DD in business timezone */
export const todayISODate = (): string => toISODate(new Date());

/** Date object → YYYY-MM-DD in business timezone */
export const toISODate = (date: Date): string => {
  const parts = BUSINESS_DATE_FORMATTER.formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
};
```

No `toStartOfCalendarDay()` helper is provided. Converting a business date
string back to a `Date` object is inherently ambiguous (midnight in which
timezone?) and the 12 fixes identified do not require it. If a future use case
needs day-boundary comparisons, it should be designed explicitly for that
context with clear semantics.

### Edge Functions Module — `supabase/functions/_shared/dateTimezone.ts`

Same API and implementation as the client module. The duplication is intentional:
client and Edge Function code live in separate runtimes with different module
systems (Vite/TS vs Deno). Sharing a single file across these boundaries would
require build-time tricks that add complexity without benefit. Both modules must
maintain identical API and test coverage to stay in sync.

```typescript
export const BUSINESS_TIMEZONE = "Europe/Rome";

const BUSINESS_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const todayISODate = (): string => toISODate(new Date());

export const toISODate = (date: Date): string => {
  const parts = BUSINESS_DATE_FORMATTER.formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
};

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

### Migration — `formatDateInTimezone` consolidation

`unifiedCrmAnswerUtils.ts` currently owns `formatDateInTimezone`. After the new
module is created:

1. Move the function to `_shared/dateTimezone.ts`
2. Re-export from `unifiedCrmAnswerUtils.ts` for backward compatibility
3. Update direct importers over time

## Fix Map — All 12 Points

### Edge Functions (UTC runtime)

| # | Sev  | File                                 | Line | Current Pattern                         | Fix                                                             |
|---|------|--------------------------------------|------|-----------------------------------------|-----------------------------------------------------------------|
| 1 | HIGH | `fiscal_deadline_check/index.ts`     | 135  | `const today = new Date()`              | Import `todayISODate` + normalized UTC Date for comparisons     |
| 2 | MED  | `invoice_import_extract/index.ts`    | 52   | `new Date().toISOString().slice(0, 10)` | `todayISODate()`                                                |
| 3 | MED  | `workflowTemplatePlaceholders.ts`    | 41   | `toLocaleDateString("it-IT")` no tz     | `Intl.DateTimeFormat("it-IT", { timeZone: BUSINESS_TIMEZONE })` |

#### Fix #1 Detail — fiscal_deadline_check

The `today` Date object is passed to `buildFiscalDeadlines` and used for:

- `isPast: opts.date < opts.today` — Date comparison in UTC
- `daysUntil: diffDays(opts.today, opts.date)` — uses `getDate()` in UTC

The existing comparison logic operates on UTC `Date` objects using `getDate()`.
The deadline dates (e.g., June 30) are constructed as `new Date(year, 5, 30)`,
which in the Edge Function runtime produces June 30 00:00 UTC. The problem is
that `today` is also `new Date()` in UTC, which may be the previous calendar
day from Italy's perspective.

The fix normalizes `today` to a UTC Date anchored to the correct Europe/Rome
business date, so the existing UTC-based day comparisons operate on the intended
Italian calendar day:

```typescript
const todayStr = todayISODate(); // "2026-06-30" in Europe/Rome
const today = new Date(`${todayStr}T00:00:00Z`);
```

**This UTC-midnight anchor is an internal normalization strategy for comparison
compatibility, not a semantic representation of the start of the Rome business
day.** It works because both `today` and all deadline dates are constructed as
UTC midnight, making relative comparisons (`isPast`, `daysUntil`) produce
correct results. This pattern must not be copied elsewhere as a general-purpose
"business date to Date" conversion — it is safe only because both sides of the
comparison are normalized the same way.

In `fiscalDeadlineCalculation.ts`: replace the local `toLocalISODate` with an
import from `dateTimezone.ts`.

### Client-side (browser)

| # | Sev  | File                     | Line    | Current Pattern                         | Fix                                     |
|---|------|--------------------------|---------|-----------------------------------------|-----------------------------------------|
| 4 | HIGH | `invoiceDraftXml.ts`     | 43      | `new Date().toISOString().slice(0, 10)` | `todayISODate()`                        |
| 5 | HIGH | `invoiceDraftPdf.tsx`    | 252     | `new Date().toISOString().slice(0, 10)` | `todayISODate()`                        |
| 6 | MED  | `InvoiceDraftDialog.tsx` | 36      | `new Date().toISOString().slice(0, 10)` | `todayISODate()`                        |
| 7 | MED  | `AddTask.tsx`            | 59, 65  | `new Date().toISOString().slice(0, 10)` | `todayISODate()`                        |
| 8 | MED  | `TaskCreateSheet.tsx`    | 55      | `new Date().toISOString().slice(0, 10)` | `todayISODate()`                        |
| 9 | MED  | `workflowEngine.ts`     | 181,204 | `.toISOString().split("T")[0]`          | `toISODate(dueDate)` / `todayISODate()` |
| 10| LOW  | `quoteServiceLinking.ts` | 69      | `new Date().toISOString().slice(0, 10)` | `todayISODate()`                        |
| 11| LOW  | `DashboardAnnual.tsx`    | 185     | `new Date().toISOString().slice(0, 10)` | `todayISODate()`                        |

### SQL

| # | Sev | File                                          | Line | Current        | Fix                                        |
|---|-----|-----------------------------------------------|------|----------------|--------------------------------------------|
| 12| MED | `financial_documents_foundation.sql` (2 views)| 180  | `CURRENT_DATE` | `(NOW() AT TIME ZONE 'Europe/Rome')::date` |

New migration to recreate both views with the timezone-aware comparison.

`CURRENT_DATE` in PostgreSQL returns the date in the session's timezone setting.
On Supabase-hosted PostgreSQL this is UTC. This means documents are marked
"overdue" when midnight passes in UTC, not in Italy — up to 2 hours too early
in summer. `(NOW() AT TIME ZONE 'Europe/Rome')::date` explicitly resolves
"today" in the business timezone regardless of the session's timezone setting.

## Duplicate Elimination

### 5 copies of `toLocalISODate` → removed

| File                           | Action                                   |
|--------------------------------|------------------------------------------|
| `fiscalDeadlineCalculation.ts` | Replace with import from EF dateTimezone |
| `fiscalDeadlines.ts`           | Replace with import from client dateTimezone |
| `dashboardModel.ts`            | Replace with import from client dateTimezone |
| `DashboardDeadlineTracker.tsx` | Replace with import from client dateTimezone |
| `PaymentOverdueBadge.tsx`      | Replace with import from client dateTimezone |

### 3 copies of `todayIso`/`todayIsoDate` → removed

| File                     | Action                             |
|--------------------------|------------------------------------|
| `invoiceDraftXml.ts`     | Replace with import `todayISODate` |
| `invoiceDraftPdf.tsx`    | Replace with import `todayISODate` |
| `InvoiceDraftDialog.tsx` | Replace with import `todayISODate` |

## Testing

### Unit tests for dateTimezone modules

- `src/lib/dateTimezone.test.ts`
- `supabase/functions/_shared/dateTimezone.test.ts`

Both test suites must mirror each other to guarantee identical behavior across
runtimes.

Test cases:

1. At 23:30 UTC (01:30 CEST summer) → `todayISODate()` returns the next UTC
   calendar day (which is the current Italian day)
2. At 23:30 UTC (00:30 CET winter) → `todayISODate()` returns the next UTC
   calendar day (which is the current Italian day)
3. At 12:00 UTC → returns same day (no ambiguity between UTC and Italian day)
4. DST transition boundary (last Sunday of March, last Sunday of October)
5. `toISODate(new Date("2026-06-30T00:00:00Z"))` → `"2026-06-30"` (summer,
   UTC+2: June 30 02:00 CEST → still June 30)
6. `toISODate(new Date("2026-03-31T22:30:00Z"))` → `"2026-04-01"` (summer,
   UTC+2: April 1 00:30 CEST — verifies the exact boundary that caused the
   real bugs)
7. Static safeguard: grep/lint assertion that fails if `new Date("YYYY-MM-DD")`
   or `new Date(dateOnlyVar)` appears in the audited modules — prevents
   business date strings from being accidentally parsed as instants

### Existing tests

No existing tests should break — the behavioral change only manifests in the
00:00–02:00 window, and existing tests don't mock dates in that range.

## Not In Scope

These patterns were audited and confirmed correct:

- `generatedAt: new Date().toISOString()` — instant timestamps (UTC), not
  business dates
- `contactRecord.ts` created_at/updated_at — instant timestamps (TIMESTAMPTZ)
- `dataProvider.ts` updated_at — instant timestamp
- `Task.tsx` done_date — instant timestamp (TIMESTAMPTZ)
- `date-field.tsx` — already forces `timeZone: "UTC"` for date-only strings
- `google_calendar_sync` — already specifies `timeZone: "Europe/Rome"`
- `unifiedCrmAnswerIntents.ts` — already uses `formatDateInTimezone`

## Learning Trigger

New trigger `WF-8` in `.claude/learning.md`:

> **Quando**: scrivo `new Date().toISOString().slice(0,10)` o
> `.toISOString().split("T")[0]` per ottenere una data di business, oppure
> `new Date("YYYY-MM-DD")` per parsare una data di business
> **Fare**: usare `todayISODate()` o `toISODate(date)` dal modulo
> `dateTimezone`. Mai convertire una business date string in `Date` senza
> semantica esplicita documentata.
> **Perché**: `toISOString()` converte in UTC prima di estrarre — data
> sbagliata tra 00:00 e 02:00 CEST. `new Date("YYYY-MM-DD")` interpreta come
> UTC midnight — giorno sbagliato in `Europe/Rome` nella stessa finestra. Le
> date di business sono sempre `Europe/Rome`, gli istanti temporali sono sempre
> UTC ISO completi.

## Continuity

- Update `docs/architecture.md` — new shared modules section
- Update `docs/development-continuity-map.md` — timezone helpers
- Update `.claude/learning.md` — WF-8 trigger
