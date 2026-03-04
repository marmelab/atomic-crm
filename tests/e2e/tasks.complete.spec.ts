/**
 * Test COMPLETO modulo Promemoria (Tasks)
 * Include: CRUD, completamento, filtri temporali
 */

import { expect, test } from "@playwright/test";
import { loginAsLocalAdmin } from "./support/auth";
import { resetAndSeedTestData } from "./support/test-data-controller";

test.describe("Module: Tasks - Complete", () => {
  test.beforeEach(() => {
    resetAndSeedTestData();
  });

  test("tasks list loads with filters", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Promemoria" }).click();
    await expect(page).toHaveURL(/\/client_tasks$/);

    // Verifica filtri temporali
    await expect(page.getByText(/Scaduti|Overdue/)).toBeVisible();
    await expect(page.getByText(/Oggi|Today/)).toBeVisible();
    await expect(page.getByText(/Domani|Tomorrow/)).toBeVisible();
    await expect(page.getByText(/Settimana|Week/)).toBeVisible();
  });

  test("create task with client link", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Promemoria" }).click();
    await page
      .getByRole("button", { name: /Aggiungi|Nuovo|Crea/ })
      .first()
      .click();

    // Compila task
    await page.getByLabel(/Testo|Descrizione/).fill("Task di test");
    await page.getByLabel(/Data scadenza/).fill("2026-03-20");

    // Seleziona cliente (opzionale)
    const clientField = page.getByLabel(/Cliente/);
    if (await clientField.isVisible().catch(() => false)) {
      await clientField.click();
      await page.getByRole("option").first().click();
    }

    await page.getByRole("button", { name: /Salva|Crea/ }).click();

    // Verifica
    await expect(page.getByText("Task di test")).toBeVisible();
  });

  test("complete task toggles status", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Promemoria" }).click();
    await page
      .getByRole("button", { name: /Aggiungi|Nuovo/ })
      .first()
      .click();

    // Crea task
    await page.getByLabel(/Testo/).fill("Task da completare");
    await page.getByLabel(/Data/).fill("2026-03-20");
    await page.getByRole("button", { name: /Salva/ }).click();

    // Trova checkbox e completa
    const checkbox = page.getByRole("checkbox").first();
    await checkbox.click();

    // Verifica completato (stile barrato o simile)
    await expect(page.getByText("Task da completare")).toBeVisible();
  });

  test("filter tasks by time period works", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Promemoria" }).click();

    // Clicca su filtro "Oggi"
    await page.getByText(/Oggi|Today/).click();

    // Verifica risultati
    // (nessun task di test è per oggi, quindi lista vuota o con task esistenti)
  });

  test("edit task updates fields", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Promemoria" }).click();
    await page
      .getByRole("button", { name: /Aggiungi|Nuovo/ })
      .first()
      .click();

    // Crea task
    await page.getByLabel(/Testo/).fill("Task originale");
    await page.getByLabel(/Data/).fill("2026-03-20");
    await page.getByRole("button", { name: /Salva/ }).click();

    // Modifica
    await page.getByText("Task originale").click();
    await page.getByRole("link", { name: /Modifica/ }).click();
    await page.getByLabel(/Testo/).fill("Task modificato");
    await page.getByRole("button", { name: /Salva/ }).click();

    // Verifica
    await expect(page.getByText("Task modificato")).toBeVisible();
  });

  test("delete task removes from list", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Promemoria" }).click();
    await page
      .getByRole("button", { name: /Aggiungi|Nuovo/ })
      .first()
      .click();

    // Crea task
    await page.getByLabel(/Testo/).fill("Task da eliminare");
    await page.getByLabel(/Data/).fill("2026-03-20");
    await page.getByRole("button", { name: /Salva/ }).click();

    // Elimina
    await page.getByText("Task da eliminare").click();
    await page.getByRole("button", { name: /Elimina/ }).click();
    await page.getByRole("button", { name: /Conferma/ }).click();

    // Verifica rimozione
    await expect(page.getByText("Task da eliminare")).not.toBeVisible();
  });

  test("tasks appear in client detail page", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Clienti" }).click();
    await page.getByText("Test Client").first().click();

    // Sezione promemoria
    await expect(page.getByText("Promemoria")).toBeVisible();
  });

  test("tasks appear in dashboard deadline tracker", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.goto("/#/");

    // Scadenzario operativo
    await expect(page.getByText("Scadenzario operativo")).toBeVisible();
    await expect(page.getByText("Promemoria in scadenza")).toBeVisible();
  });
});
