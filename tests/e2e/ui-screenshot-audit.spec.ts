import { test } from "@playwright/test";
import { loginAsLocalAdmin } from "./support/auth";

test.describe("UI Screenshot Audit", () => {
  test("Dashboard screenshot", async ({ page }) => {
    await loginAsLocalAdmin(page);
    // Aspetta caricamento dati dashboard
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: "test-results/audit-dashboard.png",
      fullPage: true,
    });
  });

  test("Clients list screenshot", async ({ page }) => {
    await loginAsLocalAdmin(page);
    await page.goto("#/clients");
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "test-results/audit-clients.png",
      fullPage: true,
    });
  });

  test("Projects screenshot", async ({ page }) => {
    await loginAsLocalAdmin(page);
    await page.goto("#/projects");
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "test-results/audit-projects.png",
      fullPage: true,
    });
  });

  test("Services screenshot", async ({ page }) => {
    await loginAsLocalAdmin(page);
    await page.goto("#/services");
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "test-results/audit-services.png",
      fullPage: true,
    });
  });

  test("Payments screenshot", async ({ page }) => {
    await loginAsLocalAdmin(page);
    await page.goto("#/payments");
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "test-results/audit-payments.png",
      fullPage: true,
    });
  });

  test("Expenses screenshot", async ({ page }) => {
    await loginAsLocalAdmin(page);
    await page.goto("#/expenses");
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "test-results/audit-expenses.png",
      fullPage: true,
    });
  });

  test("Settings screenshot", async ({ page }) => {
    await loginAsLocalAdmin(page);
    await page.goto("#/settings");
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "test-results/audit-settings.png",
      fullPage: true,
    });
  });

  test("AI Chat screenshot", async ({ page }) => {
    await loginAsLocalAdmin(page);
    await page.getByRole("button", { name: "Apri chat AI unificata" }).click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "test-results/audit-ai-chat.png",
      fullPage: true,
    });
  });
});
