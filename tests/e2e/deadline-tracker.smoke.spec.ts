import { expect, test } from "@playwright/test";

import { ensureLocalE2eState, loginAsLocalAdmin } from "./support/auth";

test.beforeAll(() => {
  ensureLocalE2eState();
});

test("annual dashboard renders the operational deadline tracker", async ({
  page,
}) => {
  await loginAsLocalAdmin(page);

  await expect(page.getByText("Scadenzario operativo")).toBeVisible({
    timeout: 15000,
  });
  await expect(
    page.getByText("Pagamenti scaduti", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Pagamenti in scadenza", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Promemoria in scadenza", { exact: true }),
  ).toBeVisible();

  const markAsReceivedButtons = page.getByRole("button", {
    name: "Segna come incassato",
  });

  if ((await markAsReceivedButtons.count()) > 0) {
    await expect(markAsReceivedButtons.first()).toBeVisible();
  }
});
