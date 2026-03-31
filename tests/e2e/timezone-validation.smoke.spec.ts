import { expect, test, type Page } from "@playwright/test";

import { loginAsLocalAdmin } from "./support/auth";
import { resetAndSeedTestData } from "./support/test-data-controller";

const FIXED_NOW = "2026-03-05T12:00:00.000Z";

const freezeBrowserDate = async (page: Page) => {
  await page.addInitScript((isoString: string) => {
    const fixedTime = new Date(isoString).valueOf();
    const RealDate = Date;

    class MockDate extends RealDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        if (args.length === 0) {
          super(fixedTime);
          return;
        }
        super(...args);
      }

      static now() {
        return fixedTime;
      }
    }

    Object.setPrototypeOf(MockDate, RealDate);
    // @ts-expect-error test-only override
    window.Date = MockDate;
  }, FIXED_NOW);
};

for (const timezoneId of ["Europe/Rome", "America/New_York"] as const) {
  test.describe(`Timezone validation (${timezoneId})`, () => {
    test.use({ timezoneId });

    test.beforeEach(async ({ page }) => {
      resetAndSeedTestData();
      await freezeBrowserDate(page);
    });

    test("deadline tracker keeps business dates stable", async ({ page }) => {
      await loginAsLocalAdmin(page);

      const tracker = page
        .locator('[data-slot="card"]')
        .filter({ hasText: "Cosa devi fare" })
        .first();

      await expect(tracker).toBeVisible({ timeout: 15000 });
      await expect(tracker.getByText("Scaduti", { exact: true })).toBeVisible();
      await expect(
        tracker.getByText("Prossimi 7g", { exact: true }),
      ).toBeVisible();

      await expect(tracker.getByText(/10\/03/)).toBeVisible();
      await expect(tracker.getByText(/tra 5g/)).toBeVisible();
    });
  });
}
