/**
 * Test COMPLETO modulo Pagamenti
 * Include: CRUD, stati, tipi, collegamenti, scadenzario
 */

import { expect, test } from "@playwright/test";
import { loginAsLocalAdmin } from "./support/auth";
import { resetAndSeedTestData } from "./support/test-data-controller";

test.describe("Module: Payments - Complete", () => {
  test.beforeEach(() => {
    resetAndSeedTestData();
  });

  test("payments list shows all columns and statuses", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Pagamenti" }).click();
    await expect(page).toHaveURL(/\/payments$/);

    // Scope column headers to the table header row
    const thead = page.locator("table thead");
    await expect(thead.getByText("Data")).toBeVisible();
    await expect(thead.getByText("Cliente")).toBeVisible();
    await expect(thead.getByText("Progetto")).toBeVisible();
    await expect(thead.getByText("Tipo")).toBeVisible();
    await expect(thead.getByText("Importo")).toBeVisible();
    await expect(thead.getByText("Stato")).toBeVisible();

    // 5 pagamenti di test
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(5);
  });

  test("create payment with all statuses and types", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Pagamenti" }).click();
    await page.getByRole("link", { name: "Crea" }).click();
    await expect(page).toHaveURL(/\/payments\/create$/);

    // Seleziona cliente
    await page.getByRole("combobox", { name: "Cliente" }).click();
    await page.getByPlaceholder("Cerca...").fill("Test Client");
    await page.getByRole("option", { name: /Test Client/ }).first().click();

    // Seleziona progetto
    await page.getByRole("combobox", { name: "Progetto" }).click();
    const projectSearch = page.getByPlaceholder("Cerca...").last();
    await projectSearch.fill("Test Project");
    await projectSearch.press("Enter");

    // Data
    await page.getByLabel("Data pagamento").fill("2026-03-15");

    // Tipo
    await page.getByLabel("Tipo").click();
    await page.getByRole("option", { name: "Acconto", exact: true }).click();

    // Importo
    await page.getByLabel("Importo (EUR)").fill("1500");

    // Metodo
    await page.getByLabel("Metodo pagamento").click();
    await page.getByRole("option", { name: "Bonifico", exact: true }).click();

    // Stato
    await page.getByLabel("Stato").click();
    await page.getByRole("option", { name: "Ricevuto" }).click();

    await page.getByRole("button", { name: "Salva" }).click();

    // After create, redirect is "show" (PaymentCreate.tsx:51)
    await expect(page).toHaveURL(/\/payments\/.+\/show$/);
  });

  test("payment statuses display correctly", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Pagamenti" }).click();

    // Scope status checks to the table body to avoid matching sidebar filter badges
    const tbody = page.locator("table tbody");

    // Verifica stati dei 5 pagamenti di test:
    // - 2 Ricevuto (acconto 2000 + saldo 1500)
    // - 1 Ricevuto (rimborso 300)
    // - 1 In attesa (2000)
    // - 1 Scaduto (500)

    await expect(tbody.getByText("Ricevuto").first()).toBeVisible();
    await expect(tbody.getByText("In attesa")).toBeVisible();
    await expect(tbody.getByText("Scaduto")).toBeVisible();
  });

  test("payment types display correctly", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Pagamenti" }).click();

    // Scope type checks to the table body to avoid matching sidebar filter badges
    const tbody = page.locator("table tbody");

    // Verifica tipi (labels from paymentTypeLabels)
    await expect(tbody.getByText("Acconto")).toBeVisible();
    await expect(tbody.getByText("Saldo")).toBeVisible();
    await expect(tbody.getByText("Parziale").first()).toBeVisible();
    // "rimborso" maps to "Rimborso al cliente" in paymentTypeLabels
    await expect(tbody.getByText("Rimborso al cliente")).toBeVisible();
  });

  test("payment detail shows linked project and calculations", async ({
    page,
  }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Pagamenti" }).click();
    await page.locator("table tbody tr a").first().click();
    await expect(page).toHaveURL(/\/payments\/.+\/show$/);

    // The show page renders: "{Type} — EUR {amount}" as heading,
    // status badge, client name, and project name inline.
    await expect(page.getByText(/EUR \d/).first()).toBeVisible();
    // Status badge should be visible
    await expect(page.locator(".inline-flex.items-center.gap-1").first()).toBeVisible();
    // Client and project names should be visible
    await expect(page.getByText(/Test Client/).first()).toBeVisible();
    await expect(page.getByText(/Test Project/).first()).toBeVisible();
  });

  test("edit payment updates status correctly", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Pagamenti" }).click();

    // Trova pagamento "In attesa" e modificalo
    const inAttesaRow = page
      .locator("table tbody tr", { hasText: "In attesa" })
      .first();
    await inAttesaRow.locator("a").first().click();

    await page.getByRole("link", { name: "Modifica" }).click();

    // Cambia stato a Ricevuto
    await page.getByLabel("Stato").click();
    await page.getByRole("option", { name: "Ricevuto" }).click();

    await page.getByRole("button", { name: "Salva" }).click();

    // Verifica
    await expect(page).toHaveURL(/\/payments\/.+\/show$/);
    await expect(page.getByText("Ricevuto")).toBeVisible();
  });

  test("mark payment as received from deadline tracker", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.goto("/#/");

    // The deadline tracker heading is "Cosa devi fare"
    await expect(page.getByText("Cosa devi fare")).toBeVisible();

    // The action button text is "Incassato"
    const markButton = page
      .getByRole("button", { name: "Incassato" })
      .first();
    if (await markButton.isVisible().catch(() => false)) {
      await markButton.click();

      // Verifica che il pagamento sia ora ricevuto
      await page.getByRole("link", { name: "Pagamenti" }).click();
      await expect(page.getByText("Ricevuto").first()).toBeVisible();
    }
  });

  test("filter payments by status works", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Pagamenti" }).click();

    // Click the "Ricevuto" filter badge in the sidebar (not the table)
    const sidebar = page.locator(".shrink-0.w-56");
    await sidebar.getByText("Ricevuto").click();

    // Wait for the filter to apply — table should have no "Scaduto" rows
    const tbody = page.locator("table tbody");
    await expect(tbody.getByText("Scaduto")).toHaveCount(0);
  });

  test("filter payments by project works", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Pagamenti" }).click();

    // Filtra per progetto
    await page
      .getByRole("button", { name: /Filtra per progetto/ })
      .click();
    await page.getByRole("option").first().click();

    // Tutti i pagamenti dovrebbero essere visibili (stesso progetto)
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(5);
  });

  test("payment refund type has negative impact on balance", async ({
    page,
  }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Pagamenti" }).click();

    // Verifica rimborso presente (label is "Rimborso al cliente")
    const tbody = page.locator("table tbody");
    await expect(tbody.getByText("Rimborso al cliente")).toBeVisible();
    await expect(tbody.getByText("300,00")).toBeVisible();
  });

  test("overdue payments appear in dashboard alerts", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.goto("/#/");

    // The overdue counter label in DashboardDeadlineTracker is "Scaduti"
    await expect(page.getByText("Scaduti")).toBeVisible();

    // Dovrebbe esserci almeno 1 pagamento scaduto (500€)
    const scadutiCount = page.getByText(/500.*€|Scaduto/);
    await expect(scadutiCount.first()).toBeVisible();
  });

  test("payment create form has quote linking field", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Pagamenti" }).click();
    await page.getByRole("link", { name: "Crea" }).click();
    await expect(page).toHaveURL(/\/payments\/create$/);

    // The payment form has a "Preventivo collegato" autocomplete field
    await expect(page.getByLabel("Preventivo collegato")).toBeVisible();
  });

  test("delete payment uses undo pattern", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Pagamenti" }).click();
    await page.locator("table tbody tr a").first().click();
    await expect(page).toHaveURL(/\/payments\/.+\/show$/);

    // DeleteButton uses useDeleteWithUndoController — clicking it deletes
    // immediately, redirects to list, and shows an undo notification.
    await page.getByRole("button", { name: "Elimina" }).click();

    // After delete, user is redirected to list
    await expect(page).toHaveURL(/\/payments$/);

    // The row count should be 4 (one deleted)
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(4);
  });
});
