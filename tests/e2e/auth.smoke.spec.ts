import { expect, test } from "@playwright/test";

import { ensureLocalE2eState, loginAsLocalAdmin } from "./support/auth";

test.beforeAll(() => {
  ensureLocalE2eState();
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
});

test("dashboard keeps selected mode and reading guide dismissal after navigation", async ({
  page,
}) => {
  await loginAsLocalAdmin(page);

  const annualGuideText = page.getByText(
    "Qui vedi il valore del lavoro dell'anno scelto al netto degli sconti, non gli incassi.",
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
