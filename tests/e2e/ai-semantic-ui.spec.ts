/**
 * Test UX semantica AI - Pareto Validation
 * Verifica che l'AI abbia colori semantici, icone e categorie
 */

import { expect, test } from "@playwright/test";
import { loginAsLocalAdmin } from "./support/auth";

test.describe("AI Semantic UI", () => {
  test("AI launcher shows categorized questions with visual grouping", async ({
    page,
  }) => {
    await loginAsLocalAdmin(page);

    // Apri AI launcher
    await page.getByRole("button", { name: "Apri chat AI unificata" }).click();

    // Verifica header delle categorie
    await expect(page.getByText("Panoramica")).toBeVisible();
    await expect(page.getByText("Urgenti")).toBeVisible();
    await expect(page.getByText("Entrate")).toBeVisible();
    await expect(page.getByText("Lavoro")).toBeVisible();

    // Verifica domande principali
    await expect(
      page.getByText("Dammi un riepilogo operativo rapido"),
    ).toBeVisible();
    await expect(
      page.getByText("Dove vedi attenzione immediata"),
    ).toBeVisible();

    // Verifica descrizioni helper
    await expect(page.getByText("Panoramica generale di tutto")).toBeVisible();
  });

  test("AI semantic categories have distinct background colors", async ({
    page,
  }) => {
    await loginAsLocalAdmin(page);

    // Apri AI launcher
    await page.getByRole("button", { name: "Apri chat AI unificata" }).click();

    // Verifica colori distinti per categoria (gradienti di sfondo)
    // Panoramica: grigio/slate
    const overviewSection = page.locator('div[class*="from-slate-50"]').first();
    await expect(overviewSection).toBeVisible();

    // Urgenti: rosso
    const urgentSection = page.locator('div[class*="from-red-50"]').first();
    await expect(urgentSection).toBeVisible();

    // Entrate: verde/emerald
    const revenueSection = page
      .locator('div[class*="from-emerald-50"]')
      .first();
    await expect(revenueSection).toBeVisible();

    // Lavoro: blu
    const workSection = page.locator('div[class*="from-blue-50"]').first();
    await expect(workSection).toBeVisible();
  });

  test("AI shows enhanced loading state with pulse animation", async ({
    page,
  }) => {
    await loginAsLocalAdmin(page);

    // Apri AI launcher
    await page.getByRole("button", { name: "Apri chat AI unificata" }).click();

    // Clicca su una domanda
    await page.getByText("Dammi un riepilogo operativo rapido").click();

    // Verifica stato di caricamento migliorato
    await expect(page.getByText("Sto analizzando il CRM...")).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByText("Leggo clienti, progetti, pagamenti"),
    ).toBeVisible();

    // Verifica che ci sia un elemento con animazione pulse
    const animatedElement = page
      .locator(".animate-pulse, .animate-ping")
      .first();
    await expect(animatedElement).toBeVisible();
  });

  test("AI questions have icons and visual hierarchy", async ({ page }) => {
    await loginAsLocalAdmin(page);

    // Apri AI launcher
    await page.getByRole("button", { name: "Apri chat AI unificata" }).click();

    // Verifica che le domande siano raggruppate in sezioni
    const categoryHeaders = page.getByText(
      /Panoramica|Urgenti|Entrate|Lavoro|Insights/,
    );
    expect(await categoryHeaders.count()).toBeGreaterThanOrEqual(3);

    // Verifica che ci siano icone (svg) nelle domande
    const questionIcons = page
      .locator("button svg, [class*='icon'] svg")
      .first();
    await expect(questionIcons).toBeVisible();

    // Verifica badge di conteggio domande
    await expect(page.getByText(/\d+ domande?/).first()).toBeVisible();
  });
});
