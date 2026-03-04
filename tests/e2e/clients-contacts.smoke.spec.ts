import { expect, test } from "@playwright/test";

import { ensureLocalE2eState, loginAsLocalAdmin } from "./support/auth";

test.beforeAll(() => {
  ensureLocalE2eState();
});

test("client show exposes the linked Diego contact", async ({ page }) => {
  await loginAsLocalAdmin(page);

  await page.getByRole("link", { name: "Progetti", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page
    .getByRole("link", { name: "Bella tra i Fornelli", exact: true })
    .click();
  await expect(page).toHaveURL(/\/projects\/.+\/show$/);
  await page
    .getByRole("link", {
      name: "ASSOCIAZIONE CULTURALE GUSTARE SICILIA",
      exact: true,
    })
    .click();

  await expect(page).toHaveURL(/\/clients\/.+\/show$/);
  await expect(
    page.getByRole("heading", {
      name: "ASSOCIAZIONE CULTURALE GUSTARE SICILIA",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Referenti", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Diego Caltabiano", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Principale cliente")).toBeVisible();
  const linkedProjects = page
    .locator("div.rounded-lg.border")
    .filter({
      has: page.getByRole("link", {
        name: "Diego Caltabiano",
        exact: true,
      }),
    })
    .first()
    .getByText(/Progetti:\s+/);
  await expect(linkedProjects).toContainText("Gustare Sicilia");
  await expect(linkedProjects).toContainText("Bella tra i Fornelli");
});
