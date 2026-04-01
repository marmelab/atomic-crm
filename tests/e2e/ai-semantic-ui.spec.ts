/**
 * Test UX semantica AI - Pareto Validation
 * Verifica che l'AI launcher mostri categorie, domande e stati di caricamento
 */

import { expect, test } from "@playwright/test";
import { loginAsLocalAdmin } from "./support/auth";

test.describe("AI Semantic UI", () => {
  test("AI launcher shows categorized questions with tab navigation", async ({
    page,
  }) => {
    await loginAsLocalAdmin(page);

    // Apri AI launcher
    await page.getByRole("button", { name: "Apri chat AI unificata" }).click();

    // Verifica categorie (pill tabs) — use role selectors to avoid strict mode
    await expect(
      page.getByRole("button", { name: "Panoramica" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Fatturazione" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Incassi" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Lavoro svolto" }),
    ).toBeVisible();

    // Verifica domande della categoria attiva (Panoramica di default)
    await expect(
      page.getByText("Come sta andando il business questo mese?"),
    ).toBeVisible();
    await expect(
      page.getByText("Dammi un riepilogo operativo rapido del CRM."),
    ).toBeVisible();

    // Verifica hint text
    await expect(
      page.getByText("Scegli un tema o scrivi una domanda libera."),
    ).toBeVisible();
  });

  test("AI category tabs switch displayed questions", async ({ page }) => {
    await loginAsLocalAdmin(page);

    // Apri AI launcher
    await page.getByRole("button", { name: "Apri chat AI unificata" }).click();

    // Panoramica è attiva di default — verifica una domanda Panoramica
    await expect(
      page.getByText("Come sta andando il business questo mese?"),
    ).toBeVisible();

    // Clicca su Incassi (tab button)
    await page.getByRole("button", { name: "Incassi" }).click();

    // Verifica domande Incassi
    await expect(
      page.getByText("Chi mi deve dei soldi e quanto?"),
    ).toBeVisible();

    // Clicca su Preventivi (tab button)
    await page.getByRole("button", { name: "Preventivi" }).click();

    // Verifica domande Preventivi
    await expect(
      page.getByText("Ci sono preventivi aperti che richiedono attenzione?"),
    ).toBeVisible();
  });

  test("AI shows loading state after asking a question", async ({ page }) => {
    await loginAsLocalAdmin(page);

    // Apri AI launcher
    await page.getByRole("button", { name: "Apri chat AI unificata" }).click();

    // Clicca su una domanda suggerita
    await page.getByText("Come sta andando il business questo mese?").click();

    // Verifica stato di caricamento
    await expect(
      page.getByText("Sto preparando una risposta grounded sul CRM..."),
    ).toBeVisible({ timeout: 5000 });
  });

  test("AI launcher has multiple category tabs available", async ({ page }) => {
    await loginAsLocalAdmin(page);

    // Apri AI launcher
    await page.getByRole("button", { name: "Apri chat AI unificata" }).click();

    // Verifica che ci siano almeno 5 categorie visibili
    const categoryTabs = page.getByText(
      /Panoramica|Fatturazione|Incassi|Lavoro svolto|Spese e km|Preventivi|Clienti|Promemoria|Automazioni/,
    );
    expect(await categoryTabs.count()).toBeGreaterThanOrEqual(5);

    // Verifica che le domande siano cliccabili (button elements)
    const questionButtons = page.locator('button:has-text("Come sta andando")');
    await expect(questionButtons.first()).toBeVisible();
  });
});
