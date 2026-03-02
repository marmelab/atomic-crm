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
    page.getByRole("link", {
      name: "ASSOCIAZIONE CULTURALE GUSTARE SICILIA",
      exact: true,
    }),
  ).toBeVisible();
});
