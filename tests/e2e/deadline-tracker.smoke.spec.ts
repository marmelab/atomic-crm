import { expect, test } from "@playwright/test";

import { loginAsLocalAdmin } from "./support/auth";
import { resetAndSeedTestData } from "./support/test-data-controller";

test.beforeEach(() => {
  resetAndSeedTestData();
});

test("annual dashboard renders the operational deadline tracker with test data", async ({
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

  // Con i dati di test, ci deve essere almeno 1 pagamento scaduto (500€)
  const markAsReceivedButtons = page.getByRole("button", {
    name: "Segna come incassato",
  });
  await expect(markAsReceivedButtons.first()).toBeVisible();
});
