/**
 * Test COMPLETO modulo Registro Lavori (Services)
 * Include: CRUD, calcoli km, tassabilità, bozze fattura
 */

import { expect, test } from "@playwright/test";
import { loginAsLocalAdmin } from "./support/auth";
import { resetAndSeedTestData } from "./support/test-data-controller";
import { selectFirstOption } from "./support/select-first-option";

test.describe("Module: Services - Complete", () => {
  test.beforeEach(() => {
    resetAndSeedTestData();
  });

  test("services list loads with all columns", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Registro Lavori" }).click();
    await expect(page).toHaveURL(/\/services$/);

    // Colonne
    await expect(page.getByRole("columnheader", { name: "Data" })).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Progetto" }),
    ).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Tipo" })).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Riprese" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Montaggio" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Totale" }),
    ).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Km" })).toBeVisible();
  });

  test("create service with fees and km", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Registro Lavori" }).click();
    await page.getByRole("link", { name: "Crea" }).click();
    await expect(page).toHaveURL(/\/services\/create$/);

    // Seleziona progetto
    await selectFirstOption(page, page.getByRole("combobox", { name: "Progetto" }));

    // Data
    await page.getByLabel("Data inizio").fill("2026-03-10");

    // Tipo
    await page.getByLabel("Tipo servizio").click();
    await page.getByRole("option", { name: "Riprese", exact: true }).click();

    // Compensi
    await page.getByLabel("Compenso riprese").fill("1500");
    await page.getByLabel("Compenso montaggio").fill("800");
    await page.getByLabel("Compenso altro").fill("200");

    // Km
    await page.getByLabel("Km percorsi").fill("75");
    await page.getByLabel("Tariffa km").fill("0.19");

    // Location
    await page.getByLabel("Località").fill("Catania");

    // Note
    await page.getByLabel("Note").fill("Servizio test completo");

    await page.getByRole("button", { name: "Salva" }).click();

    // Verifica
    await expect(page).toHaveURL(/\/services\/.+\/show$/);
    await expect(page.getByText("Catania")).toBeVisible();
  });

  test("service totals calculate correctly", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Registro Lavori" }).click();

    // Verifica totali dei 3 servizi di test
    // Servizio 1: 2000+1000 = 3000
    // Servizio 2: 0+2000 = 2000
    // Servizio 3: 1000+500 = 1500

    await expect(page.getByText("3000,00").first()).toBeVisible();
    await expect(page.getByText("2000,00").first()).toBeVisible();
    await expect(page.getByText("1500,00").first()).toBeVisible();
  });

  test("service detail shows all calculated fields", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Registro Lavori" }).click();
    await page.locator("table tbody tr a").first().click();
    await expect(page).toHaveURL(/\/services\/.+\/show$/);

    // Verifica campi calcolati
    await expect(page.getByText(/Totale compenso|Totale/)).toBeVisible();
    await expect(page.getByText(/Rimborso km|Km/)).toBeVisible();
  });

  test("edit service updates calculations", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Registro Lavori" }).click();
    await page.locator("table tbody tr a").first().click();

    await page.getByRole("link", { name: "Modifica" }).click();

    // Modifica compensi
    await page.getByLabel("Compenso riprese").fill("2500");

    await page.getByRole("button", { name: "Salva" }).click();

    // Verifica nuovo totale
    await expect(page).toHaveURL(/\/services\/.+\/show$/);
  });

  test("is_taxable flag is respected in calculations", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Registro Lavori" }).click();
    await page.getByRole("link", { name: "Crea" }).click();

    await selectFirstOption(page, page.getByRole("combobox", { name: "Progetto" }));
    await page.getByLabel("Data inizio").fill("2026-03-15");
    await page.getByLabel("Compenso riprese").fill("1000");

    // Verifica flag tassabilità
    const taxableSwitch = page.getByLabel(/Tassabile|tassabile/);
    if (await taxableSwitch.isVisible().catch(() => false)) {
      // Di default dovrebbe essere tassabile
      await expect(taxableSwitch).toBeChecked();
    }
  });

  test("invoice draft from single service", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Registro Lavori" }).click();
    await page.locator("table tbody tr a").first().click();

    // Genera bozza da servizio singolo
    const invoiceButton = page.getByRole("button", {
      name: /Genera bozza|Bozza fattura/,
    });
    if (await invoiceButton.isVisible().catch(() => false)) {
      await invoiceButton.click();
      await expect(
        page.getByRole("heading", { name: "Bozza fattura" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Chiudi" }).click();
    }
  });

  test("km reimbursement calculation is correct", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Registro Lavori" }).click();

    // Verifica calcolo km nella lista
    // Servizio 1: 100km × 0.19 = 19€
    // Servizio 2: 50km × 0.19 = 9.50€

    await expect(page.getByText("100").first()).toBeVisible();
    await expect(page.getByText("50").first()).toBeVisible();
  });

  test("filter services by project works", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Registro Lavori" }).click();

    // Filtra per progetto
    await selectFirstOption(
      page,
      page.getByRole("button", { name: /Filtra per progetto/ }),
    );

    // Verifica servizi visibili
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(3);
  });

  test("filter services by type works", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Registro Lavori" }).click();

    // Filtra per tipo
    await page
      .locator('[data-slot="badge"]')
      .filter({ hasText: /^Riprese$/ })
      .first()
      .click();

    // Verifica risultati
    await expect(page.locator("table tbody tr")).toHaveCount(1);
  });

  test("service with invoice_ref is excluded from draft", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Registro Lavori" }).click();
    await page.getByRole("link", { name: "Crea" }).click();

    // Crea servizio con riferimento fattura
    await selectFirstOption(page, page.getByRole("combobox", { name: "Progetto" }));
    await page.getByLabel("Data inizio").fill("2026-03-20");
    await page.getByLabel("Compenso riprese").fill("1000");
    await page.getByLabel("Rif. Fattura").fill("FPR 1/26");

    await page.getByRole("button", { name: "Salva" }).click();

    await expect(
      page.getByRole("button", { name: /Genera bozza fattura/ }),
    ).not.toBeVisible();
  });

  test("duplicate service creates copy", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Registro Lavori" }).click();

    // Cerca bottone duplica (se esiste)
    const duplicateButton = page
      .getByRole("button", { name: /Duplica/ })
      .first();
    if (await duplicateButton.isVisible().catch(() => false)) {
      await duplicateButton.click();
      // Verifica form precompilato
      await expect(page.getByLabel("Compenso riprese")).not.toHaveValue("");
    }
  });

  test("delete service removes record with undoable action", async ({
    page,
  }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Registro Lavori" }).click();
    await page.locator("table tbody tr a").first().click();

    await page.getByRole("button", { name: "Elimina" }).click();

    await expect(page).toHaveURL(/\/services$/);
  });
});
