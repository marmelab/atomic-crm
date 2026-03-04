import { expect, test, type Page } from "@playwright/test";

import { ensureLocalE2eState, loginAsLocalAdmin } from "./support/auth";

test.beforeAll(() => {
  ensureLocalE2eState();
});

const openInvoiceDraftDialogAndAssert = async (page: Page) => {
  await page
    .getByRole("button", { name: "Genera bozza fattura", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bozza fattura" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Chiudi", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Chiudi", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Bozza fattura" }),
  ).toBeHidden();
};

test("invoice draft is available from service, project, client and quote surfaces", async ({
  page,
}) => {
  await loginAsLocalAdmin(page);

  await page
    .getByRole("link", { name: "Registro Lavori", exact: true })
    .click();
  await expect(page).toHaveURL(/\/services$/);
  await page.locator("table tbody tr a").first().click();
  await expect(page).toHaveURL(/\/services\/.+\/show$/);
  await openInvoiceDraftDialogAndAssert(page);

  await page.getByRole("link", { name: "Progetti", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.locator("table tbody tr a").first().click();
  await expect(page).toHaveURL(/\/projects\/.+\/show$/);
  await openInvoiceDraftDialogAndAssert(page);

  await page
    .getByRole("link", {
      name: "ASSOCIAZIONE CULTURALE GUSTARE SICILIA",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/clients\/.+\/show$/);
  await openInvoiceDraftDialogAndAssert(page);

  await page.getByRole("link", { name: "Preventivi", exact: true }).click();
  await expect(page).toHaveURL(/\/quotes$/);

  const quoteCards = page.locator("div.cursor-pointer");
  if ((await quoteCards.count()) > 0) {
    const firstQuoteCard = quoteCards.first();
    await expect(firstQuoteCard).toBeVisible();
    await firstQuoteCard.click();
    await expect(page).toHaveURL(/\/quotes\/.+\/show$/);
    await openInvoiceDraftDialogAndAssert(page);
  } else {
    await expect(
      page.getByText("Nessun preventivo ancora. Crea il primo!"),
    ).toBeVisible();
  }
});

test("invoiceDraft query parameter opens invoice draft dialog automatically", async ({
  page,
}) => {
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

  const url = new URL(page.url());
  const hashPath = url.hash.slice(1);
  await page.goto(`/#${hashPath}?invoiceDraft=true`);

  await expect(
    page.getByRole("heading", { name: "Bozza fattura" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Chiudi", exact: true }),
  ).toBeVisible();
});
