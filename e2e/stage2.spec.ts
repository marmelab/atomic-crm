import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Stage 2 acceptance (TZ section 11): "a counterparty is a client and a
 * supplier at once; a Polish VAT number fills in the name; 100 products are
 * imported".
 *
 * Self-contained like e2e/stage1.spec.ts: it signs up a new owner, so it runs
 * against any instance with the stage 2 migrations (make start and
 * npx supabase functions serve running):
 *   PLAYWRIGHT_BASE_URL=http://localhost:5173 npx playwright test e2e/stage2.spec.ts --project=chromium
 *
 * The VIES answer is stubbed at the edge function URL: the European service is
 * sometimes down, and the connector itself is covered by connectors/vies tests.
 */

test.use({ locale: "uk-UA", timezoneId: "Europe/Kyiv" });
test.describe.configure({ mode: "serial" });

const run = Date.now();
const owner = { email: `stage2-${run}@test.local`, password: "Stage2-Ua!" };
// Playwright runs from the repository root
const PRODUCTS_CSV = path.resolve("test-data", "products.csv");

const signUpWithBusiness = async (page: Page) => {
  await page.goto("/#/sign-up");
  await page.getByLabel(/^Ім.я$/).fill("Ірина");
  await page.getByLabel("Прізвище").fill("Склад");
  await page.getByLabel("Ел. пошта").fill(owner.email);
  await page.getByLabel("Пароль").fill(owner.password);
  await page.getByRole("button", { name: "Створити акаунт" }).click();
  await page.waitForURL(/#\/(setup)?$/);
  if (!page.url().includes("/setup")) await page.goto("/#/setup");

  await page.getByLabel("Назва бізнесу").fill(`Салон ${run}`);
  await page.getByRole("radio", { name: /Україна/ }).click();
  await page.getByRole("radio", { name: /^Торгівля/ }).click();
  await page.getByLabel("Код ЄДРПОУ").fill("14360570");
  await page.getByRole("button", { name: "Створити бізнес" }).click();
  await expect(page.getByRole("link", { name: "Склад" })).toBeVisible();
};

test("a Polish supplier and client is filled in from its VAT number", async ({
  page,
}) => {
  await page.route("**/functions/v1/vies_check", (route) =>
    route.fulfill({
      json: {
        status: "valid",
        vatId: "PL7740001454",
        name: `ORLEN ${run}`,
        address: "CHEMIKÓW 7",
        zipcode: "09-411",
        city: "PŁOCK",
      },
    }),
  );
  await signUpWithBusiness(page);

  await page.goto("/#/companies/create");
  await page.getByText("Україна", { exact: true }).click();
  await page.getByRole("option", { name: "Польща" }).click();
  await page.getByText("Постачальник", { exact: true }).click();
  await page.getByLabel("NIP").fill("774-000-14-54");
  await page.getByRole("button", { name: "Заповнити за VAT" }).click();

  await expect(page.getByText("VAT-номер дійсний (VIES)")).toBeVisible();
  await expect(page.locator('input[name="name"]')).toHaveValue(`ORLEN ${run}`);
  await expect(page.locator('input[name="city"]')).toHaveValue("PŁOCK");

  await page.getByRole("button", { name: "Створити контрагента" }).click();
  await page.waitForURL(/#\/companies\/\d+\/show/);
  await expect(page.getByText("Клієнт", { exact: true })).toBeVisible();
  await expect(page.getByText("Постачальник", { exact: true })).toBeVisible();
  await expect(page.getByText("7740001454")).toBeVisible();

  // Listed both among clients and among suppliers
  for (const role of ["Клієнт", "Постачальник"]) {
    await page.goto("/#/companies");
    await page.getByRole("button", { name: role }).click();
    await expect(page.getByText(`ORLEN ${run}`)).toBeVisible();
  }
});

test("100 products are imported from a CSV file, with their stock", async ({
  page,
}) => {
  await page.goto("/#/login");
  await page.getByLabel(/Ел. пошта/).fill(owner.email);
  await page.getByLabel(/Пароль/).fill(owner.password);
  await page.getByRole("button", { name: /Увійти/ }).click();
  await page.waitForURL(/#\/$/);

  await page.goto("/#/products");
  await page.getByRole("button", { name: "Імпорт CSV" }).click();
  await page
    .locator('[role="dialog"] input[type="file"]')
    .setInputFiles(PRODUCTS_CSV);
  await page.getByRole("button", { name: "Почати імпорт" }).click();
  await expect(
    page.getByText("Імпорт завершено. Записів: 100, помилок: 0"),
  ).toBeVisible({ timeout: 60_000 });

  await page.goto("/#/products");
  await expect(page.getByText(/1-50 з 100|1–50 з 100/)).toBeVisible();
  await page.getByPlaceholder("Пошук").fill("TD-001");
  await expect(page.getByText("Шампунь з ромашкою")).toBeVisible();
  await expect(page.getByText("10 шт")).toBeVisible();
});
