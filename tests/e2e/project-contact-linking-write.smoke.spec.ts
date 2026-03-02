import { expect, test } from "@playwright/test";

import { ensureLocalE2eState, loginAsLocalAdmin } from "./support/auth";

test.beforeAll(() => {
  ensureLocalE2eState();
});

test("project contact row can promote Diego to primary on Bella tra i Fornelli", async ({
  page,
}) => {
  await loginAsLocalAdmin(page);

  await page.getByRole("link", { name: "Progetti" }).click();
  await expect(page).toHaveURL(/\/projects$/);

  await page
    .getByRole("link", { name: "Bella tra i Fornelli", exact: true })
    .click();

  await expect(page).toHaveURL(/\/projects\/.+\/show$/);

  const diegoRow = page
    .locator("div.rounded-lg.border")
    .filter({ hasText: "Diego Caltabiano" })
    .first();

  await expect(diegoRow).toBeVisible();
  await expect(
    diegoRow.getByRole("button", { name: "Rendi primario" }),
  ).toBeVisible();

  await diegoRow.getByRole("button", { name: "Rendi primario" }).click();

  await expect(diegoRow.getByText("Primario progetto")).toBeVisible();
  await expect(
    diegoRow.getByRole("button", { name: "Primario" }),
  ).toBeVisible();
});
