# Error Handling Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 verified error handling bugs (3 HIGH + 3 MEDIUM) across Edge Functions, shared utils, React components, and providers.

**Architecture:** Pattern-based fixes — one shared helper for AI visual JSON parsing (with custom error class for catch discrimination), one validation function for OAuth tokens (in its own file for testability), and targeted edits in 11 existing files. No new dependencies, no happy-path behavior changes.

**Tech Stack:** Deno (Edge Functions), TypeScript, React, ra-core (`useUpdate`, `useNotify`), Vitest

**Spec:** `docs/superpowers/specs/2026-04-01-error-handling-audit-design.md`

**Files touched:** 11 existing files modified, 5 new files created (2 helpers + 3 test files).

---

### Task 1: M1 — Create `parseAiVisualBlocks` shared helper + tests

**Files:**
- Create: `supabase/functions/_shared/parseAiVisualBlocks.ts`
- Create: `supabase/functions/_shared/parseAiVisualBlocks.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// supabase/functions/_shared/parseAiVisualBlocks.test.ts
import { describe, it, expect } from "vitest";
import {
  parseAiVisualBlocks,
  InvalidAiOutputError,
} from "./parseAiVisualBlocks.ts";

describe("parseAiVisualBlocks", () => {
  it("parses a valid JSON array", () => {
    const input = JSON.stringify([{ type: "heading", text: "Hello" }]);
    expect(parseAiVisualBlocks(input)).toEqual([
      { type: "heading", text: "Hello" },
    ]);
  });

  it("parses a valid JSON object", () => {
    const input = JSON.stringify({ type: "heading", text: "Hello" });
    expect(parseAiVisualBlocks(input)).toEqual({
      type: "heading",
      text: "Hello",
    });
  });

  it("throws InvalidAiOutputError on malformed JSON", () => {
    expect(() => parseAiVisualBlocks("{not valid json")).toThrow(
      InvalidAiOutputError,
    );
  });

  it("throws InvalidAiOutputError on empty string", () => {
    expect(() => parseAiVisualBlocks("")).toThrow(InvalidAiOutputError);
  });

  it("throws with a user-facing message", () => {
    expect(() =>
      parseAiVisualBlocks("Ecco il riepilogo dell'anno"),
    ).toThrow("L'AI ha generato una risposta non valida. Riprova.");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run supabase/functions/_shared/parseAiVisualBlocks.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// supabase/functions/_shared/parseAiVisualBlocks.ts

/**
 * Distinguishable error class for AI visual-mode parse failures.
 * Allows EF catch blocks to return 502 with a specific message
 * instead of the generic 500 "impossibile generare...".
 */
export class InvalidAiOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAiOutputError";
  }
}

/**
 * Parse AI visual-mode output as JSON blocks.
 * Returns `any` to match `JSON.parse` signature and avoid
 * type-level changes at call sites.
 *
 * @throws {InvalidAiOutputError} on malformed output
 */
// deno-lint-ignore no-explicit-any
export function parseAiVisualBlocks(outputText: string): any {
  try {
    return JSON.parse(outputText);
  } catch {
    console.error(
      "parseAiVisualBlocks.invalid_json",
      outputText.slice(0, 500),
    );
    throw new InvalidAiOutputError(
      "L'AI ha generato una risposta non valida. Riprova.",
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/parseAiVisualBlocks.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/parseAiVisualBlocks.ts supabase/functions/_shared/parseAiVisualBlocks.test.ts
git commit -m "feat: add parseAiVisualBlocks shared helper with tests (M1)"
```

---

### Task 2: M1 — Replace raw `JSON.parse` in 6 AI Edge Functions + catch `InvalidAiOutputError`

**Files:**
- Modify: `supabase/functions/annual_operations_summary/index.ts`
- Modify: `supabase/functions/annual_operations_answer/index.ts`
- Modify: `supabase/functions/historical_analytics_summary/index.ts`
- Modify: `supabase/functions/historical_analytics_answer/index.ts`
- Modify: `supabase/functions/historical_cash_inflow_summary/index.ts`
- Modify: `supabase/functions/historical_cash_inflow_answer/index.ts`

Each file needs three changes: (a) add import, (b) replace `JSON.parse`, (c) add `instanceof InvalidAiOutputError` check inside the existing catch block (before the generic error path).

- [ ] **Step 1: Edit `annual_operations_summary/index.ts`**

Add import after the other `_shared` imports:
```typescript
import { parseAiVisualBlocks, InvalidAiOutputError } from "../_shared/parseAiVisualBlocks.ts";
```

Replace `blocks: JSON.parse(outputText),` (line 128) with:
```typescript
          blocks: parseAiVisualBlocks(outputText),
```

Add `instanceof InvalidAiOutputError` check inside the existing catch (line 139). Replace:
```typescript
  } catch (error) {
    console.error("annual_operations_summary.error", error);
    return createErrorResponse(
      500,
      "Impossibile generare l'analisi AI della vista Annuale",
    );
  }
```
With:
```typescript
  } catch (error) {
    if (error instanceof InvalidAiOutputError) {
      return createErrorResponse(502, error.message);
    }
    console.error("annual_operations_summary.error", error);
    return createErrorResponse(
      500,
      "Impossibile generare l'analisi AI della vista Annuale",
    );
  }
```

- [ ] **Step 2: Edit `annual_operations_answer/index.ts`**

Add import after the other `_shared` imports:
```typescript
import { parseAiVisualBlocks, InvalidAiOutputError } from "../_shared/parseAiVisualBlocks.ts";
```

Replace `blocks: JSON.parse(outputText),` (line 150) with:
```typescript
          blocks: parseAiVisualBlocks(outputText),
```

Replace the catch block (line 162):
```typescript
  } catch (error) {
    if (error instanceof InvalidAiOutputError) {
      return createErrorResponse(502, error.message);
    }
    console.error("annual_operations_answer.error", error);
    return createErrorResponse(
      500,
      "Impossibile ottenere una risposta AI sulla vista Annuale",
    );
  }
```

- [ ] **Step 3: Edit `historical_analytics_summary/index.ts`**

Add import after the other `_shared` imports:
```typescript
import { parseAiVisualBlocks, InvalidAiOutputError } from "../_shared/parseAiVisualBlocks.ts";
```

Replace `blocks: JSON.parse(outputText),` (line 105) with:
```typescript
          blocks: parseAiVisualBlocks(outputText),
```

Replace the catch block (line 116):
```typescript
  } catch (error) {
    if (error instanceof InvalidAiOutputError) {
      return createErrorResponse(502, error.message);
    }
    console.error("historical_analytics_summary.error", error);
    return createErrorResponse(
      500,
      "Impossibile generare l'analisi AI dello storico",
    );
  }
```

- [ ] **Step 4: Edit `historical_analytics_answer/index.ts`**

Add import after the other `_shared` imports:
```typescript
import { parseAiVisualBlocks, InvalidAiOutputError } from "../_shared/parseAiVisualBlocks.ts";
```

Replace `blocks: JSON.parse(outputText),` (line 116) with:
```typescript
          blocks: parseAiVisualBlocks(outputText),
```

Replace the catch block (line 128):
```typescript
  } catch (error) {
    if (error instanceof InvalidAiOutputError) {
      return createErrorResponse(502, error.message);
    }
    console.error("historical_analytics_answer.error", error);
    return createErrorResponse(
      500,
      "Impossibile ottenere una risposta AI sullo storico",
    );
  }
```

- [ ] **Step 5: Edit `historical_cash_inflow_summary/index.ts`**

Add import after the other `_shared` imports:
```typescript
import { parseAiVisualBlocks, InvalidAiOutputError } from "../_shared/parseAiVisualBlocks.ts";
```

Replace `blocks: JSON.parse(outputText),` (line 106) with:
```typescript
          blocks: parseAiVisualBlocks(outputText),
```

Replace the catch block (line 117):
```typescript
  } catch (error) {
    if (error instanceof InvalidAiOutputError) {
      return createErrorResponse(502, error.message);
    }
    console.error("historical_cash_inflow_summary.error", error);
    return createErrorResponse(
      500,
      "Impossibile generare l'analisi AI degli incassi storici",
    );
  }
```

- [ ] **Step 6: Edit `historical_cash_inflow_answer/index.ts`**

Add import after the other `_shared` imports:
```typescript
import { parseAiVisualBlocks, InvalidAiOutputError } from "../_shared/parseAiVisualBlocks.ts";
```

Replace `blocks: JSON.parse(outputText),` (line 117) with:
```typescript
          blocks: parseAiVisualBlocks(outputText),
```

Replace the catch block (line 129):
```typescript
  } catch (error) {
    if (error instanceof InvalidAiOutputError) {
      return createErrorResponse(502, error.message);
    }
    console.error("historical_cash_inflow_answer.error", error);
    return createErrorResponse(
      500,
      "Impossibile ottenere una risposta AI sugli incassi storici",
    );
  }
```

- [ ] **Step 7: Run typecheck**

Run: `make typecheck`
Expected: PASS — `parseAiVisualBlocks` returns `any` like `JSON.parse`, no type-level changes at call sites.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/annual_operations_summary/index.ts \
  supabase/functions/annual_operations_answer/index.ts \
  supabase/functions/historical_analytics_summary/index.ts \
  supabase/functions/historical_analytics_answer/index.ts \
  supabase/functions/historical_cash_inflow_summary/index.ts \
  supabase/functions/historical_cash_inflow_answer/index.ts
git commit -m "fix: replace raw JSON.parse with parseAiVisualBlocks in 6 AI EFs (M1)"
```

---

### Task 3: H3 — Validate OAuth token response + tests

**Files:**
- Create: `supabase/functions/_shared/validateGoogleTokenResponse.ts`
- Create: `supabase/functions/_shared/validateGoogleTokenResponse.test.ts`
- Modify: `supabase/functions/_shared/googleCalendarAuth.ts` (import + usage)

The validator is extracted to its own file to avoid test failures from `jsr:@panva/jose@6` imports in `googleCalendarAuth.ts`.

- [ ] **Step 1: Write the failing tests**

```typescript
// supabase/functions/_shared/validateGoogleTokenResponse.test.ts
import { describe, it, expect } from "vitest";
import { validateGoogleTokenResponse } from "./validateGoogleTokenResponse.ts";

describe("validateGoogleTokenResponse", () => {
  it("returns validated fields from a valid response", () => {
    const result = validateGoogleTokenResponse({
      access_token: "ya29.abc123",
      expires_in: 3600,
      token_type: "Bearer",
    });
    expect(result).toEqual({
      access_token: "ya29.abc123",
      expires_in: 3600,
    });
  });

  it("throws when access_token is missing", () => {
    expect(() =>
      validateGoogleTokenResponse({ expires_in: 3600 }),
    ).toThrow("Invalid Google token response");
  });

  it("throws when access_token is empty string", () => {
    expect(() =>
      validateGoogleTokenResponse({ access_token: "", expires_in: 3600 }),
    ).toThrow("Invalid Google token response");
  });

  it("throws when expires_in is missing", () => {
    expect(() =>
      validateGoogleTokenResponse({ access_token: "ya29.abc" }),
    ).toThrow("Invalid Google token response");
  });

  it("throws when expires_in is zero", () => {
    expect(() =>
      validateGoogleTokenResponse({
        access_token: "ya29.abc",
        expires_in: 0,
      }),
    ).toThrow("Invalid Google token response");
  });

  it("throws when expires_in is negative", () => {
    expect(() =>
      validateGoogleTokenResponse({
        access_token: "ya29.abc",
        expires_in: -1,
      }),
    ).toThrow("Invalid Google token response");
  });

  it("throws when body is not an object", () => {
    expect(() =>
      validateGoogleTokenResponse("not an object"),
    ).toThrow("Invalid Google token response");
  });

  it("throws when body is null", () => {
    expect(() => validateGoogleTokenResponse(null)).toThrow(
      "Invalid Google token response",
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run supabase/functions/_shared/validateGoogleTokenResponse.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the validator**

```typescript
// supabase/functions/_shared/validateGoogleTokenResponse.ts

/**
 * Validate that a Google OAuth token exchange response has the expected shape.
 * Throws with a truncated body dump for debugging if validation fails.
 *
 * Extracted to its own file (no jsr: imports) so it can be tested
 * directly with Vitest without Deno module resolution issues.
 */
export function validateGoogleTokenResponse(
  data: unknown,
): { access_token: string; expires_in: number } {
  if (
    data == null ||
    typeof data !== "object" ||
    !("access_token" in data) ||
    typeof (data as Record<string, unknown>).access_token !== "string" ||
    !(data as Record<string, unknown>).access_token ||
    !("expires_in" in data) ||
    typeof (data as Record<string, unknown>).expires_in !== "number" ||
    !Number.isFinite((data as Record<string, unknown>).expires_in) ||
    ((data as Record<string, unknown>).expires_in as number) <= 0
  ) {
    const preview = JSON.stringify(data)?.slice(0, 200) ?? String(data);
    throw new Error(`Invalid Google token response: ${preview}`);
  }
  return {
    access_token: (data as Record<string, unknown>).access_token as string,
    expires_in: (data as Record<string, unknown>).expires_in as number,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/validateGoogleTokenResponse.test.ts`
Expected: 8 tests PASS

- [ ] **Step 5: Update `googleCalendarAuth.ts` to use the validator**

Add import at top of `supabase/functions/_shared/googleCalendarAuth.ts`:
```typescript
import { validateGoogleTokenResponse } from "./validateGoogleTokenResponse.ts";
```

Replace the unvalidated token caching block (lines 52-56):
```typescript
  const data = await res.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };
```

With:
```typescript
  const rawData = await res.json();
  const { access_token, expires_in } = validateGoogleTokenResponse(rawData);
  cachedToken = {
    access_token,
    expires_at: Date.now() + (expires_in - 60) * 1000,
  };
```

- [ ] **Step 6: Run typecheck**

Run: `make typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/validateGoogleTokenResponse.ts \
  supabase/functions/_shared/validateGoogleTokenResponse.test.ts \
  supabase/functions/_shared/googleCalendarAuth.ts
git commit -m "fix: validate Google OAuth token response before caching (H3)"
```

---

### Task 4: H1 — Check Supabase mutation errors in `google_calendar_sync`

**Files:**
- Modify: `supabase/functions/google_calendar_sync/index.ts` (2 locations)

- [ ] **Step 1: Fix `createEvent` — check the update error (lines 175-181)**

Replace:
```typescript
  // Save the event ID and link back to the service
  await supabaseAdmin
    .from("services")
    .update({ google_event_id: googleEventId, google_event_link: htmlLink })
    .eq("id", serviceId);

  return { google_event_id: googleEventId, google_event_link: htmlLink };
```

With:
```typescript
  // Save the event ID and link back to the service
  const { error: updateError } = await supabaseAdmin
    .from("services")
    .update({ google_event_id: googleEventId, google_event_link: htmlLink })
    .eq("id", serviceId);

  if (updateError) {
    console.error("google_calendar_sync.db_update_error", {
      serviceId,
      googleEventId,
      error: updateError,
    });
    return { error: "Calendar event created but failed to save link in DB" };
  }

  return { google_event_id: googleEventId, google_event_link: htmlLink };
```

- [ ] **Step 2: Fix `deleteEvent` — check the update error (lines 240-246)**

Replace:
```typescript
  // Clear the event ID and link from the service
  await supabaseAdmin
    .from("services")
    .update({ google_event_id: null, google_event_link: null })
    .eq("id", serviceId);

  return { deleted: eventId };
```

With:
```typescript
  // Clear the event ID and link from the service
  const { error: updateError } = await supabaseAdmin
    .from("services")
    .update({ google_event_id: null, google_event_link: null })
    .eq("id", serviceId);

  if (updateError) {
    console.error("google_calendar_sync.db_clear_error", {
      serviceId,
      eventId,
      error: updateError,
    });
    return { error: "Calendar event deleted but failed to clear link in DB" };
  }

  return { deleted: eventId };
```

- [ ] **Step 3: Run typecheck**

Run: `make typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/google_calendar_sync/index.ts
git commit -m "fix: check Supabase mutation errors in google_calendar_sync (H1)"
```

---

### Task 5: M2 — Check `.error` in `getUserSale` + tests

**Files:**
- Modify: `supabase/functions/_shared/getUserSale.ts`
- Create: `supabase/functions/_shared/getUserSale.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// supabase/functions/_shared/getUserSale.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("./supabaseAdmin.ts", () => ({
  supabaseAdmin: { from: mockFrom },
}));

const { getUserSale } = await import("./getUserSale.ts");

describe("getUserSale", () => {
  const fakeUser = { id: "user-123" } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
  });

  it("returns data when query succeeds", async () => {
    const sale = { id: "sale-1", user_id: "user-123" };
    mockSingle.mockResolvedValue({ data: sale, error: null });

    const result = await getUserSale(fakeUser);
    expect(result).toEqual(sale);
  });

  it("returns null when user has no sale record", async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });

    const result = await getUserSale(fakeUser);
    expect(result).toBeNull();
  });

  it("throws when Supabase returns an error", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "relation does not exist" },
    });

    await expect(getUserSale(fakeUser)).rejects.toThrow(
      "getUserSale failed: relation does not exist",
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run supabase/functions/_shared/getUserSale.test.ts`
Expected: FAIL — the current implementation never throws (it returns `?.data`)

- [ ] **Step 3: Update `getUserSale.ts` — destructure `{ data, error }` and throw on error**

Replace lines 7-15 (the function body only):
```typescript
export const getUserSale = async (user: User) => {
  return (
    await supabaseAdmin
      .from("sales")
      .select("*")
      .eq("user_id", user.id)
      .single()
  )?.data;
};
```

With:
```typescript
export const getUserSale = async (user: User) => {
  const { data, error } = await supabaseAdmin
    .from("sales")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error) {
    throw new Error(`getUserSale failed: ${error.message}`);
  }

  return data;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/getUserSale.test.ts`
Expected: 3 tests PASS

- [ ] **Step 5: Run typecheck**

Run: `make typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/getUserSale.ts supabase/functions/_shared/getUserSale.test.ts
git commit -m "fix: throw on DB error in getUserSale instead of returning null (M2)"
```

---

### Task 6: H2 — Add `onError`/`onSuccess` to `DashboardDeadlineTracker`

**Files:**
- Modify: `src/components/atomic-crm/dashboard/DashboardDeadlineTracker.tsx`

- [ ] **Step 1: Add `useNotify` to the import on line 3**

Replace:
```typescript
import { useCreatePath, useGetList, useUpdate } from "ra-core";
```

With:
```typescript
import { useCreatePath, useGetList, useNotify, useUpdate } from "ra-core";
```

- [ ] **Step 2: Add `useNotify` hook and mutation callbacks in `useDeadlineTrackerActions`**

Replace the `useDeadlineTrackerActions` function (lines 61-84):
```typescript
const useDeadlineTrackerActions = (todayIso: string) => {
  const [update, { isPending: isUpdating }] = useUpdate();

  const markPaymentAsReceived = (payment: Payment) => {
    update("payments", {
      id: payment.id,
      data: {
        status: "ricevuto",
        payment_date: payment.payment_date ?? todayIso,
      },
      previousData: payment,
    });
  };

  const markTaskAsDone = (task: ClientTask) => {
    update("client_tasks", {
      id: task.id,
      data: { done_date: new Date().toISOString() },
      previousData: task,
    });
  };

  return { isUpdating, markPaymentAsReceived, markTaskAsDone };
};
```

With:
```typescript
const useDeadlineTrackerActions = (todayIso: string) => {
  const [update, { isPending: isUpdating }] = useUpdate();
  const notify = useNotify();

  const markPaymentAsReceived = (payment: Payment) => {
    update(
      "payments",
      {
        id: payment.id,
        data: {
          status: "ricevuto",
          payment_date: payment.payment_date ?? todayIso,
        },
        previousData: payment,
      },
      {
        onSuccess: () =>
          notify("Pagamento segnato come ricevuto", { type: "success" }),
        onError: () =>
          notify("Errore nel segnare il pagamento come ricevuto", {
            type: "error",
          }),
      },
    );
  };

  const markTaskAsDone = (task: ClientTask) => {
    update(
      "client_tasks",
      {
        id: task.id,
        data: { done_date: new Date().toISOString() },
        previousData: task,
      },
      {
        onSuccess: () =>
          notify("Attività completata", { type: "success" }),
        onError: () =>
          notify("Errore nel completare l'attività", { type: "error" }),
      },
    );
  };

  return { isUpdating, markPaymentAsReceived, markTaskAsDone };
};
```

- [ ] **Step 3: Run typecheck**

Run: `make typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/atomic-crm/dashboard/DashboardDeadlineTracker.tsx
git commit -m "fix: add onError/onSuccess to deadline tracker mutations (H2)"
```

---

### Task 7: M3 — Log fetch error in `storageBucket`

**Files:**
- Modify: `src/components/atomic-crm/providers/supabase/storageBucket.ts`

- [ ] **Step 1: Replace the silent `.catch` on line 63**

Replace:
```typescript
        .catch(() => null)
```

With:
```typescript
        .catch((err: unknown) => {
          console.warn("storageBucket.fetch_error", fi.src, err);
          return null;
        })
```

- [ ] **Step 2: Run typecheck**

Run: `make typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/atomic-crm/providers/supabase/storageBucket.ts
git commit -m "fix: log fetch error in storageBucket instead of swallowing (M3)"
```

---

### Task 8: Final verification gate

- [ ] **Step 1: Run full typecheck**

Run: `make typecheck`
Expected: PASS

- [ ] **Step 2: Run lint**

Run: `make lint`
Expected: PASS

- [ ] **Step 3: Run build**

Run: `make build`
Expected: PASS

- [ ] **Step 4: Run unit tests**

Run: `make test`
Expected: PASS (includes the new tests from Tasks 1, 3, and 5)

- [ ] **Step 5: Run prettier on all changed files**

Run: `npx prettier --check supabase/functions/_shared/parseAiVisualBlocks.ts supabase/functions/_shared/parseAiVisualBlocks.test.ts supabase/functions/_shared/validateGoogleTokenResponse.ts supabase/functions/_shared/validateGoogleTokenResponse.test.ts supabase/functions/_shared/googleCalendarAuth.ts supabase/functions/_shared/getUserSale.ts supabase/functions/_shared/getUserSale.test.ts supabase/functions/google_calendar_sync/index.ts supabase/functions/annual_operations_summary/index.ts supabase/functions/annual_operations_answer/index.ts supabase/functions/historical_analytics_summary/index.ts supabase/functions/historical_analytics_answer/index.ts supabase/functions/historical_cash_inflow_summary/index.ts supabase/functions/historical_cash_inflow_answer/index.ts src/components/atomic-crm/dashboard/DashboardDeadlineTracker.tsx src/components/atomic-crm/providers/supabase/storageBucket.ts`
Expected: All files pass. If not, run `npx prettier --write` on failing files and amend the relevant commit.
