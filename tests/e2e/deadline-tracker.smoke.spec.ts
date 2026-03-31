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

  await expect(page.getByText("Cosa devi fare")).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText("Scaduti", { exact: true })).toBeVisible();
  await expect(page.getByText("Prossimi 7g", { exact: true })).toBeVisible();
  await expect(page.getByText("Da fare", { exact: true })).toBeVisible();

  // Con i dati di test, ci deve essere almeno 1 pagamento scaduto
  const markAsReceivedButtons = page.getByRole("button", {
    name: "Incassato",
  });
  await expect(markAsReceivedButtons.first()).toBeVisible();
});
