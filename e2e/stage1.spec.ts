import { expect, test, type Page } from "@playwright/test";

/**
 * Stage 1 acceptance (TZ section 11): "two businesses (UA and PL) see only
 * their own data; each has its own currency and requisites".
 *
 * Self-contained: it signs up two new owners through the interface, so it
 * runs against any instance with the stage 1 migrations, including the local
 * development one:
 *   PLAYWRIGHT_BASE_URL=http://localhost:5173 npx playwright test e2e/stage1.spec.ts --project=chromium
 */

test.use({ locale: "uk-UA", timezoneId: "Europe/Kyiv" });
test.describe.configure({ mode: "serial" });

const run = Date.now();
const ukOwner = { email: `ua-owner-${run}@test.local`, password: "Stage1-Ua!" };
const plOwner = { email: `pl-owner-${run}@test.local`, password: "Stage1-Pl!" };
const ukContact = { first: "Тарас", last: `Іваненко${run}` };
const plContact = { first: "Piotr", last: `Nowak${run}` };

const signOut = async (page: Page) => {
  await page.evaluate(() => localStorage.clear());
  await page.context().clearCookies();
};

const signUp = async (
  page: Page,
  owner: { email: string; password: string },
  first: string,
  last: string,
) => {
  await page.goto("/#/sign-up");
  await page.getByLabel(/^Ім.я$/).fill(first);
  await page.getByLabel("Прізвище").fill(last);
  await page.getByLabel("Ел. пошта").fill(owner.email);
  await page.getByLabel("Пароль").fill(owner.password);
  await page.getByRole("button", { name: "Створити акаунт" }).click();
  // A new account starts in the setup wizard (on a fresh local database the
  // first account adopts the demo business instead: add a business then)
  await page.waitForURL(/#\/(setup)?$/);
  if (!page.url().includes("/setup")) await page.goto("/#/setup");
  await expect(page.getByLabel("Назва бізнесу")).toBeVisible();
};

const signIn = async (
  page: Page,
  owner: { email: string; password: string },
) => {
  await page.goto("/#/login");
  await page.getByLabel(/Ел. пошта|Email/).fill(owner.email);
  await page.getByLabel(/Пароль|Password/).fill(owner.password);
  await page.getByRole("button", { name: /Увійти|Sign in/ }).click();
  await page.waitForURL(/#\/$/);
};

const createCompanyAndDeal = async (
  page: Page,
  labels: {
    companyName: string;
    dealName: string;
    company: string;
    amount: string;
    save: string;
  },
  values: { company: string; deal: string; amount: string },
) => {
  await page.goto("/#/companies/create");
  await page.getByLabel(labels.companyName).fill(values.company);
  await page.getByRole("button", { name: labels.save }).click();
  await page.waitForURL(/#\/companies\/\d+\/show/);

  await page.goto("/#/deals/create");
  await page.getByLabel(labels.dealName, { exact: true }).fill(values.deal);
  await page.getByRole("combobox", { name: labels.company }).click();
  await page.keyboard.type(values.company);
  await page.getByRole("option", { name: values.company }).click();
  await page.getByLabel(labels.amount).fill(values.amount);
  await page.getByRole("button", { name: labels.save }).click();
  await page.waitForURL(/#\/deals(\/\d+\/show)?$/);
};

test("a Ukrainian business works in hryvnias with Ukrainian requisites", async ({
  page,
}) => {
  await signUp(page, ukOwner, "Ольга", "Власенко");

  await page.getByLabel("Назва бізнесу").fill(`Київська студія ${run}`);
  await page.getByRole("radio", { name: /Україна/ }).click();
  await page.getByRole("radio", { name: /^Послуги/ }).click();
  await page.getByLabel("Код ЄДРПОУ").fill("14360571");
  await expect(page.getByText("контрольні цифри не збігаються")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Створити бізнес" }),
  ).toBeDisabled();
  await page.getByLabel("Код ЄДРПОУ").fill("14360570");
  await page.getByRole("button", { name: "Створити бізнес" }).click();

  // The start screen is Today, in Ukrainian
  await expect(page.getByRole("link", { name: "Сьогодні" })).toBeVisible();

  await page.goto("/#/contacts/create");
  await page.getByLabel(/^Ім.я/).fill(ukContact.first);
  await page.getByLabel(/^Прізвище/).fill(ukContact.last);
  await page.getByRole("button", { name: "Зберегти" }).click();
  await page.waitForURL(/#\/contacts\/\d+\/show/);

  await createCompanyAndDeal(
    page,
    {
      companyName: "Назва компанії",
      dealName: "Назва",
      company: "Компанія",
      amount: "Сума",
      save: "Зберегти",
    },
    { company: `Квітка ${run}`, deal: `Сайт ${run}`, amount: "12400" },
  );
  await page.goto("/#/deals");
  await expect(page.getByText(/12,4\s?тис\.\s?₴/).first()).toBeVisible();

  await page.goto("/#/business");
  await expect(page.getByText("UAH")).toBeVisible();
  await expect(page.getByLabel("Код ЄДРПОУ")).toHaveValue("14360570");
});

test("a Polish business works in zlotys with Polish requisites and sees no Ukrainian data", async ({
  page,
}) => {
  await signUp(page, plOwner, "Piotr", "Kowalski");

  await page.getByLabel("Назва бізнесу").fill(`Sklep Warszawa ${run}`);
  await page.getByRole("radio", { name: /Польща/ }).click();
  await page.getByRole("radio", { name: /^Торгівля/ }).click();
  await expect(page.getByLabel("NIP *")).toBeVisible();
  await expect(page.getByLabel("Код ЄДРПОУ")).toHaveCount(0);
  await page.getByLabel("NIP *").fill("774-000-14-54");
  await page.getByRole("button", { name: "Створити бізнес" }).click();

  // A Polish business speaks English until a Polish translation exists
  await expect(page.getByRole("link", { name: "Today" })).toBeVisible();

  await page.goto("/#/contacts");
  await expect(page.getByText(ukContact.last)).toHaveCount(0);
  await page.goto("/#/deals");
  await expect(page.getByText(`Сайт ${run}`)).toHaveCount(0);

  await page.goto("/#/contacts/create");
  await page.getByLabel(/^First name/).fill(plContact.first);
  await page.getByLabel(/^Last name/).fill(plContact.last);
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/#\/contacts\/\d+\/show/);

  await createCompanyAndDeal(
    page,
    {
      companyName: "Company name",
      dealName: "Name",
      company: "Company",
      amount: "Budget",
      save: "Save",
    },
    { company: `Kwiat ${run}`, deal: `Sklep ${run}`, amount: "12400" },
  );
  await page.goto("/#/deals");
  await expect(page.getByText(/zł/).first()).toBeVisible();
  await expect(page.getByText(/₴/)).toHaveCount(0);

  await page.goto("/#/business");
  await expect(page.getByText("PLN")).toBeVisible();
  await expect(page.getByLabel("NIP *")).toHaveValue("7740001454");
});

test("the Ukrainian owner still sees only Ukrainian data", async ({ page }) => {
  await page.goto("/");
  await signOut(page);
  await signIn(page, ukOwner);

  await page.goto("/#/contacts");
  await expect(page.getByText(ukContact.last)).toBeVisible();
  await expect(page.getByText(plContact.last)).toHaveCount(0);
  await page.goto("/#/deals");
  await expect(page.getByText(`Сайт ${run}`)).toBeVisible();
  await expect(page.getByText(`Sklep ${run}`)).toHaveCount(0);
  await expect(page.getByText(/zł/)).toHaveCount(0);
});
