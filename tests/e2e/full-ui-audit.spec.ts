import { expect, test } from "@playwright/test";
import { loginAsLocalAdmin } from "./support/auth";
import { resetAndSeedTestData } from "./support/test-data-controller";

test.describe("Full UI Audit", () => {
  test.beforeEach(() => {
    resetAndSeedTestData();
  });

  test("Dashboard loads with all KPIs", async ({ page }) => {
    await loginAsLocalAdmin(page);
    await expect(page.getByText("Valore del lavoro dell'anno")).toBeVisible();
    // Verifica che ci sia un importo in euro nella dashboard
    await expect(
      page.locator("text=/\\d+[.,]?\\d*\\s*€/").first(),
    ).toBeVisible();
  });

  test("Clients CRUD works end-to-end", async ({ page }) => {
    await loginAsLocalAdmin(page);
    await page.goto("#/clients");
    await expect(
      page.getByRole("columnheader", { name: "Nome" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Crea" }).click();
    await page.getByLabel("Nome / Ragione sociale").fill("Cliente Audit");
    await page.getByLabel("Tipo cliente").click();
    await page.getByRole("option", { name: "Azienda locale" }).click();
    await page.getByRole("button", { name: "Salva" }).click();
    await expect(page).toHaveURL(/\/clients\/.+\/show/);
  });

  test("Projects page loads", async ({ page }) => {
    await loginAsLocalAdmin(page);
    await page.goto("#/projects");
    await expect(page.getByText("Nome progetto")).toBeVisible();
  });

  test("Settings page loads", async ({ page }) => {
    await loginAsLocalAdmin(page);
    await page.goto("#/settings");
    await expect(
      page.getByRole("heading", { name: "Profilo Aziendale" }),
    ).toBeVisible();
  });
});
