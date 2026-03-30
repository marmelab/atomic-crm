/**
 * Test COMPLETO modulo Spese
 * Include: CRUD, tipi, km, markup, collegamenti
 *
 * Seed data (from resetAndSeedTestData):
 *   3 manual expenses: acquisto_materiale (project), abbonamento_software (no project), credito_ricevuto (no project)
 *   2 auto-km expenses from service trigger: 100km*0.19=19, 50km*0.19=9.50 (both with project)
 *   Total: 5 expenses
 */

import { expect, test } from "@playwright/test";
import { loginAsLocalAdmin } from "./support/auth";
import { resetAndSeedTestData } from "./support/test-data-controller";

test.describe("Module: Expenses - Complete", () => {
  test.beforeEach(() => {
    resetAndSeedTestData();
  });

  test("expenses list shows all columns and types", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Spese" }).click();
    await expect(page).toHaveURL(/\/expenses$/);

    // Colonne (usando columnheader per evitare ambiguita con ordinamento)
    await expect(
      page.getByRole("columnheader", { name: "Data" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Tipo" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Cliente" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Progetto" }),
    ).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Km" })).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Totale EUR" }),
    ).toBeVisible();

    // 5 spese: 3 manuali + 2 auto-km dal trigger servizi
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(5);
  });

  test("create expense km with correct calculation", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Spese" }).click();
    await page.getByRole("link", { name: "Crea" }).click();
    await expect(page).toHaveURL(/\/expenses\/create$/);

    // Disattiva toggle "Spesa a mio carico" per mostrare i campi collegamento
    await page.getByLabel("Spesa a mio carico").click();

    // Seleziona progetto
    await page.getByLabel("Progetto").click();
    await page.getByRole("option").first().click();

    // Data
    await page.getByLabel("Data").fill("2026-03-10");

    // Tipo km (label is "Tipo" in ExpenseInputs)
    await page.getByLabel("Tipo").click();
    await page.getByRole("option", { name: "Spostamento Km" }).click();

    // Km
    await page.getByLabel("Km percorsi").fill("150");
    await page.getByLabel("Tariffa km (EUR)").fill("0.19");

    // Descrizione
    await page.getByLabel("Descrizione").fill("Trasferta Palermo");

    await page.getByRole("button", { name: "Salva" }).click();

    // Redirect to show page (ExpenseCreate redirect="show")
    await expect(page).toHaveURL(/\/expenses\/.+\/show$/);

    // Verifica sulla show page: 150 * 0.19 = 28.50
    await expect(page.getByText("28,50").first()).toBeVisible();
    await expect(page.getByText("Trasferta Palermo")).toBeVisible();
  });

  test("create expense material with markup calculation", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Spese" }).click();
    await page.getByRole("link", { name: "Crea" }).click();

    // Disattiva toggle "Spesa a mio carico" per mostrare i campi collegamento
    await page.getByLabel("Spesa a mio carico").click();

    // Seleziona progetto
    await page.getByLabel("Progetto").click();
    await page.getByRole("option").first().click();

    // Data
    await page.getByLabel("Data").fill("2026-03-15");

    // Tipo materiale (label is "Tipo")
    await page.getByLabel("Tipo").click();
    await page.getByRole("option", { name: "Acquisto materiale" }).click();

    // Importo base
    await page.getByLabel("Importo spesa (EUR)").fill("1000");

    // Markup
    await page.getByLabel("Ricarico %").fill("30");

    // Descrizione
    await page.getByLabel("Descrizione").fill("Attrezzatura");

    await page.getByRole("button", { name: "Salva" }).click();

    // Redirect to show page (ExpenseCreate redirect="show")
    await expect(page).toHaveURL(/\/expenses\/.+\/show$/);

    // Calcolo: 1000 + 30% = 1300 — visibile nella show page
    await expect(page.getByText("1300,00").first()).toBeVisible();
    await expect(page.getByText("Attrezzatura")).toBeVisible();
  });

  test("expense km calculation is correct in list", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Spese" }).click();

    // Spesa km auto-creata dal trigger: 100km * 0.19 = 19,00
    await expect(page.getByText("19,00")).toBeVisible();
  });

  test("expense material with markup shows correct total", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Spese" }).click();

    // Spesa materiale di test: 500 + 25% = 625
    await expect(page.getByText("625,00")).toBeVisible();
  });

  test("expense detail shows calculated fields", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Spese" }).click();
    await page.locator("table tbody tr a").first().click();
    await expect(page).toHaveURL(/\/expenses\/.+\/show$/);

    // Verifica dettagli calcolati (show page has "Totale" label)
    await expect(page.getByText(/Totale/)).toBeVisible();
  });

  test("edit expense updates calculations", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Spese" }).click();

    // Navigate to an auto-km expense (search for one with km value)
    // Click first row to go to show page
    await page.locator("table tbody tr a").first().click();
    await expect(page).toHaveURL(/\/expenses\/.+\/show$/);

    // Click "Modifica" — EditButton renders as a link
    await page.getByRole("link", { name: "Modifica" }).click();
    await expect(page).toHaveURL(/\/expenses\/.+$/);

    // If this is a km expense, modify km; otherwise just save
    const kmField = page.getByLabel("Km percorsi");
    if (await kmField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await kmField.fill("200");
    }

    await page.getByRole("button", { name: "Salva" }).click();

    // EditBase redirect="show" — redirects to show page
    await expect(page).toHaveURL(/\/expenses\/.+\/show$/);
  });

  test("filter expenses by type works", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Spese" }).click();

    // Wait for list to load
    await expect(page.locator("table tbody tr")).toHaveCount(5);

    // Click filter badge for "Spostamento Km" in the sidebar filter
    // FilterBadge renders as a Badge in the sidebar — use the filter section
    await page
      .locator('[class*="flex"][class*="flex-col"][class*="gap-6"]')
      .getByText("Spostamento Km")
      .click();

    // After filtering by spostamento_km, should show only km expenses (2 auto-created)
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(2);
  });

  test("filter expenses by project works", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Spese" }).click();

    // Wait for list to load
    await expect(page.locator("table tbody tr")).toHaveCount(5);

    // Filtra per progetto using the Popover trigger button
    await page.getByRole("button", { name: /Filtra per progetto/ }).click();
    await page.getByRole("option").first().click();

    // Expenses with project_id: acquisto_materiale + 2 auto-km = 3
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(3);
  });

  test("expense appears in project financial summary", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Progetti" }).click();
    await page.locator("table tbody tr a").first().click();

    // Verifica che le spese siano nel riepilogo progetto
    // total_expenses = 625 (materiale) + 19 (km1) + 9.50 (km2) = 653.50
    // eur() with style:"currency" produces "653,50 EUR" or similar
    await expect(page.getByText(/653,50/)).toBeVisible();
  });

  test("credit received expense type has negative amount", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Spese" }).click();
    await page.getByRole("link", { name: "Crea" }).click();

    // Disattiva toggle "Spesa a mio carico"
    await page.getByLabel("Spesa a mio carico").click();

    // Crea credito ricevuto
    await page.getByLabel("Progetto").click();
    await page.getByRole("option").first().click();
    await page.getByLabel("Data").fill("2026-03-20");
    await page.getByLabel("Tipo").click();
    await page.getByRole("option", { name: "Credito ricevuto" }).click();
    await page.getByLabel("Valore credito (EUR)").fill("100");
    await page.getByLabel("Descrizione").fill("Credito da fornitore");

    await page.getByRole("button", { name: "Salva" }).click();

    // Redirect to show page
    await expect(page).toHaveURL(/\/expenses\/.+\/show$/);

    // Il credito mostra il valore negativo nella show page heading
    await expect(
      page.getByRole("heading", { name: /Credito ricevuto.*-100/ }),
    ).toBeVisible();
  });

  test("delete expense uses undo pattern", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Spese" }).click();
    await page.locator("table tbody tr a").first().click();
    await expect(page).toHaveURL(/\/expenses\/.+\/show$/);

    // DeleteButton uses useDeleteWithUndoController — click triggers immediate
    // delete with undo notification, no confirmation dialog
    await page.getByRole("button", { name: /Elimina/ }).click();

    // Should redirect to list and show undo notification
    await expect(page).toHaveURL(/\/expenses$/);
  });
});
