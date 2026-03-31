import { expect, test } from "@playwright/test";

import { loginAsLocalAdmin } from "./support/auth";
import { resetAndSeedTestData } from "./support/test-data-controller";

test.beforeEach(() => {
  resetAndSeedTestData();
});

test("local admin can sign in and access dashboard and clients", async ({
  page,
}) => {
  await loginAsLocalAdmin(page);

  await expect(page.getByRole("link", { name: "Bacheca" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Clienti" })).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Spiegami l'anno \d{4}/i,
    }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Clienti" }).click();
  await expect(page).toHaveURL(/\/clients$/);
  await expect(
    page.getByRole("button", {
      name: "Ordina per Nome / Ragione sociale crescente",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Crea", exact: true }),
  ).toBeVisible();

  // Verifica che il cliente di test sia visibile
  await expect(page.getByText("Test Client")).toBeVisible();
});

test("dashboard keeps selected mode after navigation", async ({ page }) => {
  await loginAsLocalAdmin(page);

  // Subtitle shown beneath mode toggle
  await expect(
    page.getByText("Annuale: numeri operativi dell'anno scelto."),
  ).toBeVisible();

  await page.getByRole("radio", { name: "Vista storica" }).click();
  const historicalMode = page.getByRole("radio", { name: "Vista storica" });
  await expect(historicalMode).toBeChecked();

  await page.getByRole("link", { name: "Clienti" }).click();
  await expect(page).toHaveURL(/\/clients$/);
  await page.getByRole("link", { name: "Bacheca" }).click();

  await expect(historicalMode).toBeChecked();
});
