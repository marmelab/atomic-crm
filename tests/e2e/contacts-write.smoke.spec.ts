import { expect, test } from "@playwright/test";

import { ensureLocalE2eState, loginAsLocalAdmin } from "./support/auth";

test.beforeAll(() => {
  ensureLocalE2eState();
});

test("project handoff can create a new contact and auto-link it back to the project", async ({
  page,
}) => {
  const uniqueSuffix = Date.now().toString().slice(-6);
  const firstName = "Smoke";
  const lastName = `Project ${uniqueSuffix}`;
  const fullName = `${firstName} ${lastName}`;

  await loginAsLocalAdmin(page);

  await page.getByRole("link", { name: "Progetti" }).click();
  await expect(page).toHaveURL(/\/projects$/);

  await page
    .getByRole("link", { name: "Bella tra i Fornelli", exact: true })
    .click();

  await expect(page).toHaveURL(/\/projects\/.+\/show$/);
  await page.getByRole("link", { name: "Nuovo referente" }).click();

  await expect(page).toHaveURL(/\/contacts\/create\?/);
  await expect(
    page.getByText(
      "Aperto da un progetto: salva il referente e verra' collegato automaticamente al progetto corrente.",
    ),
  ).toBeVisible();

  await page
    .getByRole("textbox", { name: "Nome", exact: true })
    .fill(firstName);
  await page
    .getByRole("textbox", { name: "Cognome", exact: true })
    .fill(lastName);
  await page.getByRole("button", { name: "Salva" }).click();

  await expect(page).toHaveURL(/\/contacts\/.+\/show$/);
  await expect(
    page.getByRole("heading", {
      name: fullName,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "ASSOCIAZIONE CULTURALE GUSTARE SICILIA",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page
      .locator('a[href*="/projects/"]')
      .filter({
        hasText: "Bella tra i Fornelli",
      })
      .first(),
  ).toBeVisible();
});
