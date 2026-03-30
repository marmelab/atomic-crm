# E2E Expenses + Payments Alignment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 18 failing E2E tests in expenses.complete and payments.complete by aligning selectors to the current UI.

**Architecture:** Pure test maintenance. Read actual UI, update selectors. No production code changes.

**Tech Stack:** Playwright, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-30-e2e-expenses-payments-design.md`

---

## File Map

| Task | Action | File |
|------|--------|------|
| 1 | Modify | `tests/e2e/expenses.complete.spec.ts` |
| 2 | Modify | `tests/e2e/payments.complete.spec.ts` |

---

### Task 1: Fix expenses.complete (9 tests)

**Files:**
- Modify: `tests/e2e/expenses.complete.spec.ts`

**Reference (do NOT modify):**
- `src/components/atomic-crm/expenses/ExpenseCreate.tsx:40` — redirect="show"
- `src/components/atomic-crm/expenses/ExpenseListContent.tsx:80-136` — column headers
- `src/components/atomic-crm/expenses/ExpenseInputs.tsx` — form labels
- `src/components/atomic-crm/expenses/ExpenseShow.tsx:122` — DeleteButton (undo)
- `src/components/atomic-crm/expenses/ExpenseListFilter.tsx:311` — project filter

**Key facts from seed data:**
- resetAndSeedTestData() creates 3 manual expenses + the DB trigger `sync_service_km_expense` auto-creates 2 km expenses from services with km_distance > 0
- Total expenses in list: **5** (not 2)
- The column header for total is "Totale EUR" (not "Totale")

- [ ] **Step 1: Fix test ":15 expenses list shows all columns and types"**

Change line 34 — column header "Totale" doesn't exist, actual is "Totale EUR":
```typescript
    await expect(page.getByRole("columnheader", { name: "Totale EUR" })).toBeVisible();
```

Change line 41 — count from 2 to 5:
```typescript
    await expect(rows).toHaveCount(5);
```

Also update the comment on line 39 from "2 spese di test" to "5 spese di test (3 manuali + 2 auto-km)".

- [ ] **Step 2: Fix test ":44 create expense km" and ":78 create expense material"**

Both tests assert `toHaveURL(/\/expenses$/)` after save. The redirect is "show".

Change line 72 and line 107:
```typescript
    await expect(page).toHaveURL(/\/expenses\/.+\/show$/);
```

Also remove the assertions that check the list for the new value (lines 75 and 110) — after redirect to show, the list isn't visible. Replace with show page assertion:
- For :44 (km): after redirect to show, verify the description text is visible:
```typescript
    await expect(page.getByText("Trasferta Palermo")).toBeVisible();
```
- For :78 (material): similarly:
```typescript
    await expect(page.getByText("Attrezzatura")).toBeVisible();
```

- [ ] **Step 3: Fix test ":142 edit expense updates calculations"**

The test navigates to the first expense in the list and tries to edit "Km percorsi". But the first expense by date order may not be a km expense. The implementer must:

1. Instead of clicking the first row, navigate to a known km expense. Use the filter to show only km expenses first, or click a row that has "Spostamento" text.
2. After edit, the redirect goes to show (not list), so fix the URL assertion.

Replace lines 145-156 with:
```typescript
    // Trova una spesa km e cliccaci
    const kmRow = page.locator("table tbody tr", { hasText: "Spostamento" }).first();
    await kmRow.locator("a").first().click();
    await expect(page).toHaveURL(/\/expenses\/.+\/show$/);

    await page.getByRole("button", { name: "Modifica" }).click();

    // Modifica km
    await page.getByLabel("Km percorsi").fill("200");

    await page.getByRole("button", { name: "Salva" }).click();

    // Redirect to show after save
    await expect(page).toHaveURL(/\/expenses\/.+\/show$/);
```

Note: the test previously clicked "Modifica" as a link (`getByRole("link")`). Check if it's actually a link or button in ExpenseShow.tsx and use the correct role.

- [ ] **Step 4: Fix test ":159 filter expenses by type"**

The click on "Spostamento Km" might match multiple elements (filter badge + table cells). The filter badges in the sidebar are the correct click target.

Read `ExpenseListFilter.tsx` to find exact structure. The type filter uses `FilterBadge` components. The test should click the filter badge specifically.

- [ ] **Step 5: Fix test ":171 filter expenses by project"**

The filter button has `aria-label="Filtra per progetto"`. After filtering, the count should match expenses for that project. With auto-km expenses, the project has 5 expenses (3 manual + 2 auto-km). But some manual expenses have `project_id = NULL` (abbonamento_software and credito_ricevuto). So filtering by project shows: acquisto_materiale(1) + 2 auto-km = **3 expenses**.

Change line 182:
```typescript
    await expect(rows).toHaveCount(3);
```

Actually, the implementer MUST verify this by running the filter in the app or querying the seed data. The exact count depends on which expenses have `project_id` set.

- [ ] **Step 6: Fix test ":185 expense appears in project financial summary"**

The expected value 644,00 is wrong. With seed data:
- acquisto_materiale: 500 * 1.25 = 625,00
- auto-km service 1: 100 * 0.19 = 19,00
- auto-km service 2: 50 * 0.19 = 9,50
- Total: 653,50

Change line 192:
```typescript
    await expect(page.getByText("653,50")).toBeVisible();
```

The implementer MUST verify by navigating to the project show page and reading the actual rendered value.

- [ ] **Step 7: Fix test ":195 credit received expense"**

The redirect after save goes to show. Fix URL assertion. The rest of the test (create flow) should work — verify form labels match ExpenseInputs.tsx.

Also note: `getByLabel(/Importo/)` — actual label is "Importo spesa (EUR)". The regex should still match but verify.

- [ ] **Step 8: Fix test ":215 delete expense"**

DeleteButton uses undo pattern. Rewrite like the project delete test:
```typescript
  test("delete expense uses undo notification", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Spese" }).click();
    await page.locator("table tbody tr a").first().click();

    await page.getByRole("button", { name: "Elimina" }).click();

    // DeleteButton uses undo pattern
    await expect(page.getByText(/eliminat|undo|annulla/i)).toBeVisible({ timeout: 5000 });
  });
```

The implementer MUST verify the exact notification text from the running app.

- [ ] **Step 9: Run all expense tests**

Run: `npx playwright test tests/e2e/expenses.complete.spec.ts --reporter=line`
Expected: 9/9 passed

- [ ] **Step 10: Commit**

```bash
git add tests/e2e/expenses.complete.spec.ts
git commit -m "test(e2e): align expenses selectors to redesigned UI and undo-delete"
```

---

### Task 2: Fix payments.complete (9 tests)

**Files:**
- Modify: `tests/e2e/payments.complete.spec.ts`

**Reference (do NOT modify):**
- `src/components/atomic-crm/payments/PaymentCreate.tsx:51` — redirect="show"
- `src/components/atomic-crm/payments/PaymentListContent.tsx:112-168` — column headers in ResizableHead
- `src/components/atomic-crm/payments/PaymentInputs.tsx` — form labels
- `src/components/atomic-crm/payments/PaymentShow.tsx:83` — DeleteButton (undo)
- `src/components/atomic-crm/payments/PaymentListFilter.tsx:126-141` — status FilterBadge
- `src/components/atomic-crm/dashboard/DashboardDeadlineTracker.tsx:247` — "Scaduti"

- [ ] **Step 1: Fix test ":15 payments list shows all columns and statuses"**

Scope column assertions to table to avoid ambiguity:
```typescript
    const table = page.locator("table");
    await expect(table.getByText("Data")).toBeVisible();
    await expect(table.getByText("Cliente")).toBeVisible();
    await expect(table.getByText("Progetto")).toBeVisible();
    await expect(table.getByText("Tipo")).toBeVisible();
    await expect(table.getByText("Importo")).toBeVisible();
    await expect(table.getByText("Stato")).toBeVisible();
```

- [ ] **Step 2: Fix test ":34 create payment"**

Change redirect URL assertion from `/payments$/` to `/payments/.+/show$/`.

Also verify form labels match PaymentInputs.tsx:
- "Data pagamento" (not "Data")
- "Importo (EUR)" (not "Importo")
- "Metodo pagamento" (not "Metodo")

Update `getByLabel` selectors to match.

- [ ] **Step 3: Fix tests ":72 payment statuses" and ":88 payment types"**

These tests look for text like "Ricevuto", "Acconto" etc. in the list. These might match both the filter sidebar and table cells. Scope to table:
```typescript
    const table = page.locator("table");
    await expect(table.getByText("Ricevuto").first()).toBeVisible();
    await expect(table.getByText("In attesa").first()).toBeVisible();
    await expect(table.getByText("Scaduto").first()).toBeVisible();
```

Same for payment types.

- [ ] **Step 4: Fix test ":139 mark payment as received from deadline tracker"**

Change "Scadenzario operativo" to "Cosa devi fare":
```typescript
    await expect(page.getByText("Cosa devi fare")).toBeVisible();
```

Also "Segna come incassato" — check the actual button text in DashboardDeadlineTracker.tsx. The button is labeled "Incassato" (line ~268):
```typescript
    const markButton = page.getByRole("button", { name: "Incassato" }).first();
```

- [ ] **Step 5: Fix test ":160 filter payments by status"**

The filter uses FilterBadge components in the sidebar. When clicking "Ricevuto" the test clicks the first match which might be in the table. Use the sidebar scope:

Read PaymentListFilter.tsx to find the filter section structure and use a scoped locator.

- [ ] **Step 6: Fix test ":199 overdue payments appear in dashboard alerts"**

Change "Pagamenti scaduti" to "Scaduti":
```typescript
    await expect(page.getByText("Scaduti")).toBeVisible();
```

- [ ] **Step 7: Fix test ":233 delete payment"**

Rewrite for undo pattern (same as expenses and projects):
```typescript
  test("delete payment uses undo notification", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Pagamenti" }).click();
    await page.locator("table tbody tr a").first().click();

    await page.getByRole("button", { name: "Elimina" }).click();

    await expect(page.getByText(/eliminat|undo|annulla/i)).toBeVisible({ timeout: 5000 });
  });
```

- [ ] **Step 8: Run all payment tests**

Run: `npx playwright test tests/e2e/payments.complete.spec.ts --reporter=line`
Expected: 9/9 passed

- [ ] **Step 9: Commit**

```bash
git add tests/e2e/payments.complete.spec.ts
git commit -m "test(e2e): align payments selectors to redesigned UI and undo-delete"
```

---

### Task 3: Final validation

- [ ] **Step 1: Run ALL E2E suites together**

Run: `npx playwright test tests/e2e/expenses.complete.spec.ts tests/e2e/payments.complete.spec.ts tests/e2e/dashboard-annual.smoke.spec.ts tests/e2e/calculations.smoke.spec.ts tests/e2e/projects.complete.spec.ts tests/e2e/navigation.smoke.spec.ts --reporter=line`

Expected: All pass.

- [ ] **Step 2: Unit tests**

Run: `make test`
Expected: 316/316

- [ ] **Step 3: Typecheck**

Run: `make typecheck`
Expected: 0 errors
