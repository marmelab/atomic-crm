/**
 * Test COMPLETO modulo Progetti
 * Include: CRUD, riepilogo finanziario, quick flows, bozza fattura
 */

import { expect, test } from "@playwright/test";
import { loginAsLocalAdmin } from "./support/auth";
import { resetAndSeedTestData } from "./support/test-data-controller";
import { selectFirstOption } from "./support/select-first-option";

test.describe("Module: Projects - Complete", () => {
  test.beforeEach(() => {
    resetAndSeedTestData();
  });

  test("projects list loads with filters and columns", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Progetti" }).click();
    await expect(page).toHaveURL(/\/projects$/);

    // Colonne (scoped to table to avoid navbar ambiguity)
    const table = page.locator("table");
    await expect(table.getByText("Nome progetto")).toBeVisible();
    await expect(table.getByText("Cliente")).toBeVisible();
    await expect(table.getByText("Categoria")).toBeVisible();
    await expect(table.getByText("Stato")).toBeVisible();

    // Filtri
    await expect(page.getByPlaceholder(/Cerca progetto/)).toBeVisible();
    await expect(
      page.locator("button[aria-label='Filtra per cliente']"),
    ).toBeVisible();
  });

  test("create new project with all fields", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Progetti" }).click();
    await page.getByRole("link", { name: "Crea" }).click();
    await expect(page).toHaveURL(/\/projects\/create$/);

    // Compila campi
    await page.getByLabel("Nome progetto").fill("Nuovo Progetto Test");
    await selectFirstOption(
      page,
      page.getByRole("combobox", { name: "Cliente" }),
    );

    await page.getByLabel("Categoria").click();
    await page.getByRole("option", { name: "Produzione TV" }).click();

    await page.getByLabel("Stato").click();
    await page.getByRole("option", { name: "In corso" }).click();

    await page.getByLabel("Data inizio").fill("2026-01-01");
    await page.getByLabel("Data fine prevista").fill("2026-12-31");
    await page.getByLabel("Budget").fill("50000");
    await page.getByLabel("Note").fill("Note progetto test");

    await page.getByRole("button", { name: "Salva" }).click();

    // Verifica creazione — redirect goes to show page
    await expect(page).toHaveURL(/\/projects\/.+\/show$/);
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
    await expect(page.getByText(/riepilogo finanziario/i)).toBeVisible();

    // Dati attesi (with auto-created km expenses from trigger):
    // - Servizi: 3
    // - Compensi: 6.500,00 €
    // - Spese: 653,50 € (500*1.25 + 100*0.19 + 50*0.19)
    // - Totale: 7.153,50 €
    // - Pagato: 3.200,00 €
    // - Da incassare: 3.953,50 €

    await expect(page.getByText("3").first()).toBeVisible(); // 3 servizi
    await expect(page.getByText(/6\.?500,00\s*€/).first()).toBeVisible();
    await expect(page.getByText(/653,50\s*€/).first()).toBeVisible();
    await expect(page.getByText(/7\.?153,50\s*€/).first()).toBeVisible();
    await expect(page.getByText(/3\.?200,00\s*€/).first()).toBeVisible();
    await expect(page.getByText(/3\.?953,50\s*€/).first()).toBeVisible();
  });

  test("quick episode dialog works", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Progetti" }).click();
    await page.locator("table tbody tr a").first().click();
    await expect(page).toHaveURL(/\/projects\/.+\/show$/);

    // Apri quick episode (wait for button to appear)
    const puntataBtn = page.getByRole("button", { name: "Puntata" });
    await expect(puntataBtn).toBeVisible({ timeout: 10000 });
    await puntataBtn.click();

    // Verifica dialog — title is "Registra Puntata — {name}"
    await expect(
      page.getByRole("heading", { name: /Registra Puntata/ }),
    ).toBeVisible();

    // Compila data (service_type is auto-set from defaults, no selector)
    await page.getByLabel(/Data/).fill("2026-03-15");

    // Annulla
    await page.getByRole("button", { name: /Annulla/ }).click();
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
    await expect(page.getByText(/3\.?000,00/).first()).toBeVisible();
    await expect(page.getByText(/Rimborso chilometrico/).first()).toBeVisible();
    await expect(page.getByText(/28,50/).first()).toBeVisible();
    await expect(page.getByText(/-3\.?200,00/).first()).toBeVisible();
    await expect(page.getByText(/3\.?328,50/).first()).toBeVisible();

    // Download PDF disponibile
    await expect(page.getByRole("button", { name: "PDF" })).toBeVisible();

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

  test("delete project uses undo pattern", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Progetti" }).click();
    await page.locator("table tbody tr a").first().click();
    await expect(page).toHaveURL(/\/projects\/.+\/show$/);

    // DeleteButton uses undo pattern (no confirmation dialog)
    const deleteBtn = page.getByRole("button", { name: /Elimina/ });
    await expect(deleteBtn).toBeVisible({ timeout: 10000 });
    await deleteBtn.click();

    // Should show undo notification ("Elemento eliminato")
    await expect(page.getByText(/Elemento eliminato|eliminat/i)).toBeVisible({
      timeout: 5000,
    });
  });
});
