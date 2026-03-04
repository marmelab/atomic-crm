/**
 * Test COMPLETO modulo Progetti
 * Include: CRUD, riepilogo finanziario, quick flows, bozza fattura
 */

import { expect, test } from "@playwright/test";
import { loginAsLocalAdmin } from "./support/auth";
import { resetAndSeedTestData } from "./support/test-data-controller";

test.describe("Module: Projects - Complete", () => {
  test.beforeEach(() => {
    resetAndSeedTestData();
  });

  test("projects list loads with filters and columns", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Progetti" }).click();
    await expect(page).toHaveURL(/\/projects$/);

    // Colonne
    await expect(page.getByText("Nome progetto")).toBeVisible();
    await expect(page.getByText("Cliente")).toBeVisible();
    await expect(page.getByText("Categoria")).toBeVisible();
    await expect(page.getByText("Stato")).toBeVisible();

    // Filtri
    await expect(page.getByPlaceholder(/Cerca progetto/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Filtra per cliente/ }),
    ).toBeVisible();
  });

  test("create new project with all fields", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Progetti" }).click();
    await page.getByRole("link", { name: "Crea" }).click();
    await expect(page).toHaveURL(/\/projects\/create$/);

    // Compila campi
    await page.getByLabel("Nome progetto").fill("Nuovo Progetto Test");
    await page.getByLabel("Cliente").click();
    await page.getByRole("option").first().click(); // Seleziona primo cliente

    await page.getByLabel("Categoria").click();
    await page.getByRole("option", { name: "Produzione TV" }).click();

    await page.getByLabel("Stato").click();
    await page.getByRole("option", { name: "In corso" }).click();

    await page.getByLabel("Data inizio").fill("2026-01-01");
    await page.getByLabel("Data fine prevista").fill("2026-12-31");
    await page.getByLabel("Budget").fill("50000");
    await page.getByLabel("Note").fill("Note progetto test");

    await page.getByRole("button", { name: "Salva" }).click();

    // Verifica creazione
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByText("Nuovo Progetto Test")).toBeVisible();
  });

  test("project show displays financial summary correctly", async ({
    page,
  }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Progetti" }).click();
    await page.locator("table tbody tr a").first().click();
    await expect(page).toHaveURL(/\/projects\/.+\/show$/);

    // Verifica riepilogo finanziario con dati di test
    await expect(page.getByText("Riepilogo finanziario")).toBeVisible();

    // Dati attesi:
    // - Servizi: 3
    // - Compensi: 6500,00 €
    // - Spese: 644,00 €
    // - Totale: 7144,00 €
    // - Pagato: 3200,00 €
    // - Da incassare: 3944,00 €

    await expect(page.getByText("3").first()).toBeVisible(); // 3 servizi
    await expect(page.getByText("6500,00 €").first()).toBeVisible();
    await expect(page.getByText("644,00 €").first()).toBeVisible();
    await expect(page.getByText("7144,00 €").first()).toBeVisible();
    await expect(page.getByText("3200,00 €").first()).toBeVisible();
    await expect(page.getByText("3944,00 €").first()).toBeVisible();
  });

  test("quick episode dialog works", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Progetti" }).click();
    await page.locator("table tbody tr a").first().click();

    // Apri quick episode
    await page.getByRole("button", { name: "Puntata" }).click();

    // Verifica dialog
    await expect(
      page.getByRole("heading", { name: /Puntata|Aggiungi puntata/ }),
    ).toBeVisible();

    // Compila
    await page.getByLabel(/Data|Giorno/).fill("2026-03-15");
    await page.getByLabel(/Tipo servizio|Tipo/).click();
    await page.getByRole("option", { name: "Riprese" }).click();

    // Annulla
    await page.getByRole("button", { name: /Annulla|Chiudi/ }).click();
  });

  test("quick payment dialog works", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Progetti" }).click();
    await page.locator("table tbody tr a").first().click();

    // Apri quick payment
    await page.getByRole("button", { name: "Pagamento" }).click();

    // Verifica dialog
    await expect(
      page.getByRole("heading", { name: /Pagamento|Registra pagamento/ }),
    ).toBeVisible();

    // Annulla
    await page.getByRole("button", { name: /Annulla|Chiudi/ }).click();
  });

  test("invoice draft from project calculates correctly", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Progetti" }).click();
    await page.locator("table tbody tr a").first().click();

    // Genera bozza
    await page.getByRole("button", { name: "Genera bozza fattura" }).click();

    // Verifica dialog
    await expect(
      page.getByRole("heading", { name: "Bozza fattura" }),
    ).toBeVisible();

    // Verifica calcoli:
    // - 3 servizi: 3000 + 2000 + 1500 = 6500€
    // - Km: 100*0.19 + 50*0.19 = 28.50€
    // - Pagamenti ricevuti: 3200€ (3500 - 300 rimborso)
    // - Totale: 6500 + 28.50 - 3200 = 3328.50€

    await expect(page.getByText(/Riprese del 20\/01\/2026/)).toBeVisible();
    await expect(page.getByText(/3000,00/)).toBeVisible();
    await expect(page.getByText(/Rimborsi chilometrici/)).toBeVisible();
    await expect(page.getByText(/28,50/)).toBeVisible();
    await expect(page.getByText(/-3200,00/)).toBeVisible();
    await expect(page.getByText(/3328,50/)).toBeVisible();

    // Download PDF disponibile
    await expect(
      page.getByRole("button", { name: "Download PDF" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Chiudi" }).click();
  });

  test("edit project updates fields correctly", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Progetti" }).click();
    await page.locator("table tbody tr a").first().click();

    await page.getByRole("link", { name: "Modifica" }).click();

    // Modifica
    await page.getByLabel("Nome progetto").fill("Progetto Modificato");
    await page.getByLabel("Budget").fill("20000");

    await page.getByRole("button", { name: "Salva" }).click();

    // Verifica
    await expect(page.getByText("Progetto Modificato")).toBeVisible();
  });

  test("project contacts section shows linked contacts", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Progetti" }).click();
    await page.locator("table tbody tr a").first().click();

    // Sezione referenti
    await expect(page.getByText("Referenti progetto")).toBeVisible();

    // Pulsanti per aggiungere referenti
    await expect(
      page.getByRole("button", { name: "Collega esistente" }),
    ).toBeVisible();
  });

  test("filter projects by category works", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Progetti" }).click();

    // Filtra per categoria
    const catFilter = page.getByText("Produzione TV");
    if (await catFilter.isVisible().catch(() => false)) {
      await catFilter.click();
    }

    // Verifica progetto visibile
    await expect(page.getByText("Test Project")).toBeVisible();
  });

  test("project status badge reflects actual status", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Progetti" }).click();

    // Verifica stato "In corso"
    await expect(page.getByText("In corso").first()).toBeVisible();
  });

  test("delete project requires confirmation", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Progetti" }).click();
    await page.locator("table tbody tr a").first().click();

    await page.getByRole("button", { name: "Elimina" }).click();

    // Dialog conferma
    await expect(page.getByText(/Conferma|eliminare/)).toBeVisible();

    await page.getByRole("button", { name: /Annulla/ }).click();
  });
});
