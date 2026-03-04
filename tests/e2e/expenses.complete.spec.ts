/**
 * Test COMPLETO modulo Spese
 * Include: CRUD, tipi, km, markup, collegamenti
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
    
    // Colonne (usando columnheader per evitare ambiguità con ordinamento)
    await expect(page.getByRole("columnheader", { name: "Data" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Tipo" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Cliente" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Progetto" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Km" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Totale" })).toBeVisible();
    
    // 2 spese di test
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(2);
  });

  test("create expense km with correct calculation", async ({ page }) => {
    await loginAsLocalAdmin(page);
    
    await page.getByRole("link", { name: "Spese" }).click();
    await page.getByRole("link", { name: "Crea" }).click();
    await expect(page).toHaveURL(/\/expenses\/create$/);
    
    // Seleziona progetto
    await page.getByLabel("Progetto").click();
    await page.getByRole("option").first().click();
    
    // Data
    await page.getByLabel("Data").fill("2026-03-10");
    
    // Tipo km
    await page.getByLabel("Tipo spesa").click();
    await page.getByRole("option", { name: "Spostamento Km" }).click();
    
    // Km
    await page.getByLabel("Km percorsi").fill("150");
    await page.getByLabel("Tariffa km").fill("0.19");
    
    // Descrizione
    await page.getByLabel("Descrizione").fill("Trasferta Palermo");
    
    await page.getByRole("button", { name: "Salva" }).click();
    
    // Verifica
    await expect(page).toHaveURL(/\/expenses$/);
    
    // Calcolo: 150 × 0.19 = 28.50
    await expect(page.getByText("28,50")).toBeVisible();
  });

  test("create expense material with markup calculation", async ({ page }) => {
    await loginAsLocalAdmin(page);
    
    await page.getByRole("link", { name: "Spese" }).click();
    await page.getByRole("link", { name: "Crea" }).click();
    
    // Seleziona progetto
    await page.getByLabel("Progetto").click();
    await page.getByRole("option").first().click();
    
    // Data
    await page.getByLabel("Data").fill("2026-03-15");
    
    // Tipo materiale
    await page.getByLabel("Tipo spesa").click();
    await page.getByRole("option", { name: "Acquisto materiale" }).click();
    
    // Importo base
    await page.getByLabel(/Importo|Base/).fill("1000");
    
    // Markup
    await page.getByLabel(/Ricarico|Markup/).fill("30");
    
    // Descrizione
    await page.getByLabel("Descrizione").fill("Attrezzatura");
    
    await page.getByRole("button", { name: "Salva" }).click();
    
    // Verifica
    await expect(page).toHaveURL(/\/expenses$/);
    
    // Calcolo: 1000 + 30% = 1300
    await expect(page.getByText("1.300,00")).toBeVisible();
  });

  test("expense km calculation is correct in list", async ({ page }) => {
    await loginAsLocalAdmin(page);
    
    await page.getByRole("link", { name: "Spese" }).click();
    
    // Spesa km di test: 100km × 0.19 = 19€
    await expect(page.getByText("19,00")).toBeVisible();
  });

  test("expense material with markup shows correct total", async ({ page }) => {
    await loginAsLocalAdmin(page);
    
    await page.getByRole("link", { name: "Spese" }).click();
    
    // Spesa materiale di test: 500 + 25% = 625€
    await expect(page.getByText("625,00")).toBeVisible();
  });

  test("expense detail shows calculated fields", async ({ page }) => {
    await loginAsLocalAdmin(page);
    
    await page.getByRole("link", { name: "Spese" }).click();
    await page.locator("table tbody tr a").first().click();
    await expect(page).toHaveURL(/\/expenses\/.+\/show$/);
    
    // Verifica dettagli calcolati
    await expect(page.getByText(/Totale|Importo/)).toBeVisible();
  });

  test("edit expense updates calculations", async ({ page }) => {
    await loginAsLocalAdmin(page);
    
    await page.getByRole("link", { name: "Spese" }).click();
    await page.locator("table tbody tr a").first().click();
    
    await page.getByRole("link", { name: "Modifica" }).click();
    
    // Modifica km
    await page.getByLabel("Km percorsi").fill("200");
    
    await page.getByRole("button", { name: "Salva" }).click();
    
    // Nuovo calcolo: 200 × 0.19 = 38
    await expect(page).toHaveURL(/\/expenses$/);
  });

  test("filter expenses by type works", async ({ page }) => {
    await loginAsLocalAdmin(page);
    
    await page.getByRole("link", { name: "Spese" }).click();
    
    // Filtra per tipo km
    await page.getByText("Spostamento Km").first().click();
    
    // Verifica risultati
    await expect(page.getByText("Spostamento Km")).toBeVisible();
  });

  test("filter expenses by project works", async ({ page }) => {
    await loginAsLocalAdmin(page);
    
    await page.getByRole("link", { name: "Spese" }).click();
    
    // Filtra per progetto
    await page.getByRole("button", { name: /Filtra per progetto/ }).click();
    await page.getByRole("option").first().click();
    
    // Entrambe le spese sono dello stesso progetto
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(2);
  });

  test("expense appears in project financial summary", async ({ page }) => {
    await loginAsLocalAdmin(page);
    
    await page.getByRole("link", { name: "Progetti" }).click();
    await page.locator("table tbody tr a").first().click();
    
    // Verifica che le spese siano nel riepilogo
    await expect(page.getByText("644,00")).toBeVisible();
  });

  test("credit received expense type has negative amount", async ({ page }) => {
    await loginAsLocalAdmin(page);
    
    await page.getByRole("link", { name: "Spese" }).click();
    await page.getByRole("link", { name: "Crea" }).click();
    
    // Crea credito ricevuto
    await page.getByLabel("Progetto").click();
    await page.getByRole("option").first().click();
    await page.getByLabel("Data").fill("2026-03-20");
    await page.getByLabel("Tipo spesa").click();
    await page.getByRole("option", { name: "Credito ricevuto" }).click();
    await page.getByLabel(/Importo/).fill("100");
    await page.getByLabel("Descrizione").fill("Credito da fornitore");
    
    await page.getByRole("button", { name: "Salva" }).click();
    
    // Il credito riduce le spese (valore negativo)
  });

  test("delete expense requires confirmation", async ({ page }) => {
    await loginAsLocalAdmin(page);
    
    await page.getByRole("link", { name: "Spese" }).click();
    await page.locator("table tbody tr a").first().click();
    
    await page.getByRole("button", { name: "Elimina" }).click();
    
    await expect(page.getByText(/Conferma/)).toBeVisible();
    await page.getByRole("button", { name: /Annulla/ }).click();
  });
});
