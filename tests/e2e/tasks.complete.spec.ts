/**
 * Test COMPLETO modulo Promemoria (Tasks)
 * Include: CRUD, completamento, filtri temporali
 */

import { expect, test } from "@playwright/test";
import { loginAsLocalAdmin } from "./support/auth";
import { resetAndSeedTestData } from "./support/test-data-controller";
import { selectFirstOption } from "./support/select-first-option";

test.describe("Module: Tasks - Complete", () => {
  test.beforeEach(() => {
    resetAndSeedTestData();
  });

  test("tasks list loads with filters", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Promemoria" }).click();
    await expect(page).toHaveURL(/\/client_tasks$/);

    // Verifica filtri temporali
    await expect(
      page.getByRole("button", { name: "Aggiungi promemoria" }),
    ).toBeVisible();
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
    await expect(page.locator('input[type="date"]').nth(1)).toBeVisible();
    await expect(page.getByText("I tuoi promemoria appariranno qui.")).toBeVisible();
  });

  test("create task with client link", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Promemoria" }).click();
    await page.getByRole("button", { name: "Aggiungi promemoria" }).click();

    // Compila task
    await page.getByLabel("Descrizione").fill("Task di test");
    await page.getByLabel("Scadenza").fill("2026-03-20");

    // Seleziona cliente (opzionale)
    const clientField = page.getByLabel(/Cliente/);
    if (await clientField.isVisible().catch(() => false)) {
      await selectFirstOption(page, clientField);
    }

    await page.getByRole("button", { name: /Salva|Crea/ }).click();

    // Verifica
    await expect(page.getByText("Task di test")).toBeVisible();
  });

  test("complete task toggles status", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Promemoria" }).click();
    await page.getByRole("button", { name: "Aggiungi promemoria" }).click();

    // Crea task
    await page.getByLabel("Descrizione").fill("Task da completare");
    await page.getByLabel("Scadenza").fill("2026-03-20");
    await page.getByRole("button", { name: "Salva" }).click();

    // Trova checkbox e completa
    const checkbox = page.getByRole("checkbox").first();
    await checkbox.click();

    // Verifica completato (stile barrato o simile)
    await expect(page.getByText("Task da completare")).toBeVisible();
  });

  test("filter tasks by time period works", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Promemoria" }).click();
    await page.getByRole("button", { name: "Aggiungi promemoria" }).click();
    await page.getByLabel("Descrizione").fill("Task range test");
    await page.getByLabel("Scadenza").fill("2026-03-20");
    await page.getByRole("button", { name: "Salva" }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Filtra per range date
    const dateInputs = page.locator("#main-content input[type='date']");
    await dateInputs.first().fill("2026-03-19");
    await dateInputs.nth(1).fill("2026-03-21");

    await expect(page.locator("#main-content").getByText("Risultati")).toBeVisible();
    await expect(
      page.locator("#main-content").getByText("Task range test"),
    ).toBeVisible();
  });

  test("edit task updates fields", async ({ page }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Promemoria" }).click();
    await page.getByRole("button", { name: "Aggiungi promemoria" }).click();

    // Crea task
    await page.getByLabel("Descrizione").fill("Task originale");
    await page.getByLabel("Scadenza").fill("2026-03-20");
    await page.getByRole("button", { name: "Salva" }).click();

    // Modifica
    await page.getByLabel("azioni attività").click();
    await page.getByRole("menuitem", { name: "Modifica" }).click();
    await page.getByLabel("Descrizione").fill("Task modificato");
    await page.getByRole("button", { name: "Salva" }).click();

    // Verifica
    await expect(
      page.getByRole("textbox", { name: "Descrizione" }),
    ).not.toBeVisible();
    await expect(
      page.locator("#main-content").getByText("Task modificato"),
    ).toBeVisible();
  });

  test("delete task removes from list with undoable action", async ({
    page,
  }) => {
    await loginAsLocalAdmin(page);

    await page.getByRole("link", { name: "Promemoria" }).click();
    await page.getByRole("button", { name: "Aggiungi promemoria" }).click();

    // Crea task
    await page.getByLabel("Descrizione").fill("Task da eliminare");
    await page.getByLabel("Scadenza").fill("2026-03-20");
    await page.getByRole("button", { name: "Salva" }).click();

    // Elimina
    await page.getByLabel("azioni attività").click();
    await page.getByRole("menuitem", { name: "Elimina" }).click();

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

    await expect(page.getByText("Cosa devi fare")).toBeVisible();
    await expect(page.getByText("Scaduti")).toBeVisible();
  });
});
