import { expect, test } from "@playwright/test";

import { ensureLocalE2eState, loginAsLocalAdmin } from "./support/auth";

test.beforeAll(() => {
  ensureLocalE2eState();
});

test("project show and AI snapshot expose the Diego/Gustare relationship", async ({
  page,
}) => {
  await loginAsLocalAdmin(page);

  await page.getByRole("link", { name: "Progetti" }).click();
  await expect(page).toHaveURL(/\/projects$/);

  await page
    .getByRole("link", { name: "Gustare Sicilia", exact: true })
    .click();

  await expect(page).toHaveURL(/\/projects\/.+\/show$/);
  await expect(
    page.getByRole("heading", {
      name: "Gustare Sicilia",
    }),
  ).toBeVisible();
  await expect(page.getByText("Referenti progetto")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Diego Caltabiano", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Primario progetto")).toBeVisible();

  await page.getByRole("button", { name: "Apri chat AI unificata" }).click();
  await page.getByRole("button", { name: "Apri altre viste AI" }).click();
  await page.getByRole("menuitem", { name: "Snapshot CRM" }).click();

  const snapshot = page.getByLabel("Snapshot CRM");
  const diegoSnapshotCard = snapshot
    .locator("div.rounded-xl")
    .filter({ hasText: "Diego Caltabiano" })
    .filter({ hasText: "ASSOCIAZIONE CULTURALE GUSTARE SICILIA" })
    .first();

  await expect(snapshot.getByText("Referenti recenti")).toBeVisible();
  await expect(diegoSnapshotCard).toBeVisible();
  await expect(diegoSnapshotCard.getByText("Diego Caltabiano")).toBeVisible();
  await expect(
    diegoSnapshotCard.getByText("ASSOCIAZIONE CULTURALE GUSTARE SICILIA"),
  ).toBeVisible();
});
