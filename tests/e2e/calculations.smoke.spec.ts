/**
 * Test E2E per verificare i calcoli finanziari
 *
 * Questi test usano dati controllati e verificano che:
 * - I totali siano corretti
 * - I pagamenti siano calcolati correttamente
 * - Le bozze fattura siano accurate
 */

import { expect, test } from "@playwright/test";
import { loginAsLocalAdmin } from "./support/auth";
import { resetAndSeedTestData } from "./support/test-data-controller";

test.describe("Financial Calculations", () => {
  test.beforeEach(() => {
    // Ogni test parte da dati puliti e controllati
    resetAndSeedTestData();
  });

  test("dashboard shows correct annual totals", async ({ page }) => {
    await loginAsLocalAdmin(page);

    // Verifica calcoli in dashboard
    await expect(page.getByText("Lavoro dell'anno")).toBeVisible();

    // Aspetta che i dati siano caricati
    await page.waitForTimeout(1000);

    // Verifica che il valore del lavoro contenga 6500 (con possibili separatori)
    const dashboardText = await page.textContent("main");
    expect(dashboardText).toMatch(/6[.,]?500/); // 6500, 6.500, 6,500
  });

  test("project financial summary is correct", async ({ page }) => {
    await loginAsLocalAdmin(page);

    // Vai ai progetti
    await page.getByRole("link", { name: "Progetti" }).click();
    await expect(page).toHaveURL(/\/projects$/);

    // Clicca sul progetto di test (sarà l'unico)
    await page.locator("table tbody tr a").first().click();
    await expect(page).toHaveURL(/\/projects\/.+\/show$/);

    // Verifica riepilogo finanziario
    await expect(page.getByText("Riepilogo finanziario")).toBeVisible();

    // Compensi: 6500€
    await expect(page.getByText("6500,00 €").first()).toBeVisible();

    // Spese: 653,50€ (500*1.25 materiale + 100*0.19 km S1 + 50*0.19 km S2)
    await expect(page.getByText("653,50 €").first()).toBeVisible();

    // Pagato: 3200€ (3500 - 300 rimborso)
    await expect(page.getByText("3200,00 €").first()).toBeVisible();

    // Da incassare: 3953,50€ (6500 + 653,50 - 3200)
    await expect(page.getByText("3953,50 €").first()).toBeVisible();
  });

  test("invoice draft calculation is correct", async ({ page }) => {
    await loginAsLocalAdmin(page);

    // Vai al progetto
    await page.getByRole("link", { name: "Progetti" }).click();
    await page.locator("table tbody tr a").first().click();

    // Apri bozza fattura
    await page.getByRole("button", { name: "Genera bozza fattura" }).click();

    // Verifica dialog
    await expect(
      page.getByRole("heading", { name: "Bozza fattura" }),
    ).toBeVisible();

    // Totale atteso: 3328,50€ (6500 + 28,50 km - 3200 pagati)
    await expect(page.getByText("3328,50 €").first()).toBeVisible();

    // Chiudi dialog
    await page.getByRole("button", { name: "Chiudi" }).click();
  });

  test("payments list shows correct amounts", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Pagamenti" }).click();
    await expect(page).toHaveURL(/\/payments$/);

    // Verifica che ci siano 5 pagamenti
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(5);

    // Verifica stati
    await expect(page.getByText("Ricevuto").first()).toBeVisible();
    await expect(page.getByText("In attesa").first()).toBeVisible();
    await expect(page.getByText("Scaduto").first()).toBeVisible();
  });

  test("services list shows correct totals", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Registro Lavori" }).click();
    await expect(page).toHaveURL(/\/services$/);

    // Verifica 3 servizi
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(3);

    // Verifica totali
    await expect(page.getByText("3000,00").first()).toBeVisible(); // Primo servizio
    await expect(page.getByText("2000,00").first()).toBeVisible(); // Secondo
    await expect(page.getByText("1500,00").first()).toBeVisible(); // Terzo
  });
});
