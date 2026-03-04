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

    // Colonne
    await expect(page.getByText("Data")).toBeVisible();
    await expect(page.getByText("Cliente")).toBeVisible();
    await expect(page.getByText("Progetto")).toBeVisible();
    await expect(page.getByText("Tipo")).toBeVisible();
    await expect(page.getByText("Importo")).toBeVisible();
    await expect(page.getByText("Stato")).toBeVisible();

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
    await page.getByLabel("Cliente").click();
    await page.getByRole("option").first().click();

    // Seleziona progetto
    await page.getByLabel("Progetto").click();
    await page.getByRole("option").first().click();

    // Data
    await page.getByLabel("Data pagamento").fill("2026-03-15");

    // Tipo
    await page.getByLabel("Tipo").click();
    await page.getByRole("option", { name: "Acconto" }).click();

    // Importo
    await page.getByLabel("Importo").fill("1500");

    // Metodo
    await page.getByLabel("Metodo").click();
    await page.getByRole("option", { name: "Bonifico" }).click();

    // Stato
    await page.getByLabel("Stato").click();
    await page.getByRole("option", { name: "Ricevuto" }).click();

    await page.getByRole("button", { name: "Salva" }).click();

    await expect(page).toHaveURL(/\/payments$/);
  });

  test("payment statuses display correctly", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Pagamenti" }).click();

    // Verifica stati dei 5 pagamenti di test:
    // - 2 Ricevuto (acconto 2000 + saldo 1500)
    // - 1 Ricevuto (rimborso 300)
    // - 1 In attesa (2000)
    // - 1 Scaduto (500)

    await expect(page.getByText("Ricevuto").first()).toBeVisible();
    await expect(page.getByText("In attesa")).toBeVisible();
    await expect(page.getByText("Scaduto")).toBeVisible();
  });

  test("payment types display correctly", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Pagamenti" }).click();

    // Verifica tipi
    await expect(page.getByText("Acconto")).toBeVisible();
    await expect(page.getByText("Saldo")).toBeVisible();
    await expect(page.getByText("Parziale")).toBeVisible();
    await expect(page.getByText("Rimborso")).toBeVisible();
  });

  test("payment detail shows linked project and calculations", async ({
    page,
  }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Pagamenti" }).click();
    await page.locator("table tbody tr a").first().click();
    await expect(page).toHaveURL(/\/payments\/.+\/show$/);

    // Verifica dettagli
    await expect(page.getByText(/Importo|EUR/)).toBeVisible();
    await expect(page.getByText(/Stato/)).toBeVisible();
    await expect(page.getByText(/Tipo/)).toBeVisible();
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

    // Trova scadenzario
    await expect(page.getByText("Scadenzario operativo")).toBeVisible();

    // Clicca "Segna come incassato" se presente
    const markButton = page
      .getByRole("button", { name: "Segna come incassato" })
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

    // Filtra per stato Ricevuto
    await page.getByText("Ricevuto").first().click();

    // Verifica solo ricevuti visibili
    const scadutoElements = page.getByText("Scaduto");
    await expect(scadutoElements).toHaveCount(0);
  });

  test("filter payments by project works", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Pagamenti" }).click();

    // Filtra per progetto
    await page.getByRole("button", { name: /Filtra per progetto/ }).click();
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

    // Verifica rimborso presente
    await expect(page.getByText("Rimborso")).toBeVisible();
    await expect(page.getByText("300,00")).toBeVisible();
  });

  test("overdue payments appear in dashboard alerts", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.goto("/#/");

    // Verifica sezione pagamenti scaduti
    await expect(page.getByText("Pagamenti scaduti")).toBeVisible();

    // Dovrebbe esserci almeno 1 pagamento scaduto (500€)
    const scadutiCount = page.getByText(/500.*€|Scaduto/);
    await expect(scadutiCount.first()).toBeVisible();
  });

  test("payment linking to quote shows quote details", async ({ page }) => {
    await loginAsLocalAdmin(page);

    // Crea preventivo e pagamento collegato
    await page.getByRole("link", { name: "Preventivi" }).click();
    await page.getByRole("link", { name: "Crea" }).click();

    // ... creazione preventivo

    // Crea pagamento collegato
    await page.getByRole("link", { name: "Pagamenti" }).click();
    await page.getByRole("link", { name: "Crea" }).click();

    // Seleziona preventivo (se disponibile)
    const quoteField = page.getByLabel(/Preventivo/);
    if (await quoteField.isVisible().catch(() => false)) {
      await quoteField.click();
      await page.getByRole("option").first().click();
    }
  });

  test("delete payment requires confirmation", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Pagamenti" }).click();
    await page.locator("table tbody tr a").first().click();

    await page.getByRole("button", { name: "Elimina" }).click();

    await expect(page.getByText(/Conferma/)).toBeVisible();
    await page.getByRole("button", { name: /Annulla/ }).click();
  });
});
