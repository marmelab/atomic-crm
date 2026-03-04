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
      name: /Spiegami Annuale|Rigenera spiegazione/i,
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

test("dashboard keeps selected mode and reading guide dismissal after navigation", async ({
  page,
}) => {
  await loginAsLocalAdmin(page);

  // Testo attuale della guida
  const annualGuideText = page.getByText(
    "Qui vedi tutto il lavoro svolto nell'anno scelto, inclusi servizi diretti",
  );
  await expect(annualGuideText).toBeVisible();

  await page
    .getByRole("button", { name: "Chiudi guida lettura annuale" })
    .click();
  await expect(annualGuideText).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Come leggere Annuale" }),
  ).toBeVisible();

  await page.getByRole("radio", { name: "Vista storica" }).click();
  const historicalMode = page.getByRole("radio", { name: "Vista storica" });
  await expect(historicalMode).toBeChecked();

  await page.getByRole("link", { name: "Clienti" }).click();
  await expect(page).toHaveURL(/\/clients$/);
  await page.getByRole("link", { name: "Bacheca" }).click();

  await expect(historicalMode).toBeChecked();

  await page.getByRole("radio", { name: "Vista annuale" }).click();
  await expect(
    page.getByRole("button", { name: "Come leggere Annuale" }),
  ).toBeVisible();
});
