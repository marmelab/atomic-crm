# Error Handling Audit — Design Spec

**Date:** 2026-04-01
**Scope:** Fix verified error handling bugs (HIGH + MEDIUM)
**Approach:** Pattern-based — one fix pattern per group of related issues

---

## Methodology

Every finding was verified by reading actual code. Agent-generated reports
were used as starting points, then each hit was confirmed or rejected by
reading the source. False positives (e.g., react-admin providers that throw
on error, incorrectly flagged as "unchecked `.data`") were eliminated.

---

## Findings — HIGH (must fix)

### H1. google_calendar_sync: silent Supabase mutation failures

**Files:**
- `supabase/functions/google_calendar_sync/index.ts:176-179` (create)
- `supabase/functions/google_calendar_sync/index.ts:241-244` (delete)

**Problem:** After successfully creating/deleting a Google Calendar event,
the function writes back `google_event_id` / `google_event_link` to the
`services` table via `.update()`. The Supabase response `{ data, error }`
is not checked. If the update fails (RLS, network, constraint), the
function returns success to the caller, but the DB is out of sync.

**Fix:** Destructure `{ error }` from both `.update()` calls. If error,
log it and return `{ error: "..." }` so the outer handler returns 502.

**Note:** This fix prevents silent success but does not guarantee
cross-system atomicity. Orphaned Google Calendar events (created but not
linked in DB) may still exist from past runs. A future reconciliation
job could detect and clean these up, but that is out of scope for this
batch.

### H2. DashboardDeadlineTracker: fire-and-forget mutations

**File:** `src/components/atomic-crm/dashboard/DashboardDeadlineTracker.tsx:64-80`

**Problem:** `markPaymentAsReceived` and `markTaskAsDone` call `update()`
without `onError` or `onSuccess` callbacks. If the server rejects the
mutation, the user sees no feedback and thinks the action succeeded.

**Fix:** Add `onError` with `notify("...", { type: "error" })` and
`onSuccess` with `notify("...", { type: "success" })` to both calls.
Use the existing `useNotify` hook (already available via ra-core).

**UI behavior after fix:**

- ra-core's `useUpdate` already performs optimistic updates with
  automatic rollback on failure — so the UI state self-corrects.
- `isUpdating` is already passed to the UI, preventing double-clicks.
- The `onSuccess` toast confirms the action landed on the server.
- The `onError` toast makes failures visible (previously silent).
- No additional cache invalidation needed: ra-core handles it.

### H3. googleCalendarAuth: unvalidated OAuth response

**File:** `supabase/functions/_shared/googleCalendarAuth.ts:52-56`

**Problem:** After `res.json()`, the code accesses `data.access_token` and
`data.expires_in` without validation. If Google returns a 200 with
unexpected JSON shape (e.g., error wrapper), the cache stores
`{ access_token: undefined, expires_at: NaN }`. All subsequent Calendar
API calls fail with bad bearer token. `Date.now() < NaN` is always false,
so the token is never refreshed — the function retries the exchange on
every call.

**Fix:** Extract a validation function `validateTokenResponse(data)` that
checks `data` is an object, `access_token` is a non-empty string, and
`expires_in` is a positive number. If any check fails, throw with the
raw response body (JSON.stringify, truncated) for debugging. This
function is small enough to unit test directly.

---

## Findings — MEDIUM (fix in same batch)

### M1. 6 AI Edge Functions: generic error on JSON.parse failure

**Files:**
- `supabase/functions/annual_operations_summary/index.ts:128`
- `supabase/functions/annual_operations_answer/index.ts:150`
- `supabase/functions/historical_analytics_summary/index.ts:105`
- `supabase/functions/historical_analytics_answer/index.ts:116`
- `supabase/functions/historical_cash_inflow_summary/index.ts:106`
- `supabase/functions/historical_cash_inflow_answer/index.ts:117`

**Problem:** `JSON.parse(outputText)` is inside the outer try/catch, so
no crash. But the catch returns "Impossibile generare l'analisi AI..."
regardless of whether the API call failed or the AI returned malformed
JSON. The user can't distinguish "API down" from "bad AI output".

**Fix:** Extract a shared helper `parseAiVisualBlocks(outputText)` in
`supabase/functions/_shared/parseAiVisualBlocks.ts`. The helper wraps
`JSON.parse` in a try/catch: on failure it logs `outputText` (truncated
to 500 chars) and throws a descriptive error. Each EF calls the helper
instead of raw `JSON.parse`. This avoids duplicating the same 5-line
try/catch in 6 files and centralizes the error message and log format.

### M2. getUserSale: DB error masked as 401

**File:** `supabase/functions/_shared/getUserSale.ts:7-14`

**Problem:** `(await supabaseAdmin.from("sales")...single())?.data` — if
the query errors, `.data` is null, the function returns null, and every
caller treats it as "unauthorized" (401). A database failure should
return 500, not 401.

**Fix:** Destructure `{ data, error }`. If `error`, throw with the
Supabase error message. Callers already have outer try/catch that
converts unhandled exceptions to 500.

### M3. storageBucket: silent fetch failure

**File:** `src/components/atomic-crm/providers/supabase/storageBucket.ts:63`

**Problem:** `.catch(() => null)` on `fetch(fi.src).then(r => r.blob())`.
The next line (`if (dataContent == null)`) returns the original `fi`
without upload, which is the correct fallback. But error context is lost
for debugging.

**Fix:** `.catch((err) => { console.warn("storageBucket.fetch_error", fi.src, err); return null; })`.
Behavior unchanged, but errors are visible in dev console.

---

## Backlog — LOW (documented, not fixed now)

- **L1.** `google_calendar_sync:170` — `res.data as { id, htmlLink }`
  type assertion without runtime validation. Mitigated by `res.ok` check
  at line 165. Risk: Google API shape change (very unlikely).
- **L2.** `users/index.ts:8-12` — `updateSaleDisabled` returns raw
  Supabase response without checking error. Callers may or may not check.

---

## Implementation strategy

5 patterns, 11 file edits:

| Pattern | Files | Estimated edits |
|---------|-------|-----------------|
| H1: check Supabase mutation errors | 1 file, 2 locations | 2 |
| H2: add onError/onSuccess to update calls | 1 file, 2 locations | 2 |
| H3: validate OAuth response | 1 file, 1 location | 1 |
| M1: shared `parseAiVisualBlocks` helper | 1 new + 6 files import | 7 |
| M2: check .error in getUserSale | 1 file | 1 |
| M3: log fetch error in storageBucket | 1 file | 1 |

New files: `supabase/functions/_shared/parseAiVisualBlocks.ts` (shared
helper). No new dependencies. No behavior changes for happy paths —
only error paths are affected.

## Testing strategy

**Unit tests (new):**

- **H3:** `validateTokenResponse` — test with valid response, missing
  `access_token`, missing `expires_in`, non-object body, empty string
  token. Pure function, no mocks needed.
- **M1:** `parseAiVisualBlocks` — test with valid JSON array, malformed
  JSON string, empty string. Pure function, no mocks needed.
- **M2:** `getUserSale` — test that it throws when Supabase returns
  `{ data: null, error: {...} }`. Requires mocking `supabaseAdmin`,
  but the mock is trivial (single `.from().select().eq().single()`
  chain).

**Manual verification:**

- H1: code review + typecheck. Verify error path by temporarily
  breaking the `.eq("id", ...)` filter in local dev.
- H2: verify `onError` fires with React DevTools or by temporarily
  returning 500 from local Supabase. Confirm optimistic rollback works.
- M3: verify `console.warn` appears in dev tools on fetch failure.

**Gate:** `make typecheck && make lint && make build` must pass.
