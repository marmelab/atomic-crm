import { expect, test } from "@playwright/test";

import { loginAsLocalAdmin } from "./support/auth";
import { resetAndSeedTestData } from "./support/test-data-controller";

test.beforeEach(() => {
  resetAndSeedTestData();
});

test("desktop navigation exposes all core modules from registry", async ({
  page,
}) => {
  await loginAsLocalAdmin(page);

  const desktopTabs = [
    { label: /^Clienti$/, path: /\/clients$/ },
    { label: /^Referenti$/, path: /\/contacts$/ },
    { label: /^Progetti$/, path: /\/projects$/ },
    { label: /^Registro Lavori$/, path: /\/services$/ },
    { label: /^Preventivi$/, path: /\/quotes$/ },
    { label: /^Pagamenti(?:\s+\d+)?$/, path: /\/payments$/ },
    { label: /^Spese$/, path: /\/expenses$/ },
    { label: /^Promemoria$/, path: /\/client_tasks$/ },
  ];

  for (const tab of desktopTabs) {
    await page.getByRole("link", { name: tab.label }).click();
    await expect(page).toHaveURL(tab.path);
  }

  await page.getByRole("link", { name: "Bacheca", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("mobile navigation exposes bottom bar, create menu and Altro referenti", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsLocalAdmin(page);

  const mobileNav = page.getByRole("navigation", { name: "Navigazione CRM" });

  await expect(mobileNav.getByRole("link", { name: "Inizio" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Clienti" })).toBeVisible();
  await expect(
    mobileNav.getByRole("link", { name: "Promemoria" }),
  ).toBeVisible();
  await expect(mobileNav.getByRole("button", { name: "Crea" })).toBeVisible();
  await expect(mobileNav.getByRole("button", { name: "Altro" })).toBeVisible();

  await mobileNav.getByRole("button", { name: "Crea" }).click();
  await expect(page.getByRole("menuitem", { name: "Spesa" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Lavoro" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Pagamento" })).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Promemoria" }),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await mobileNav.getByRole("button", { name: "Altro" }).click();
  await expect(page.getByRole("menuitem", { name: "Referenti" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Referenti" }).click();
  await expect(page).toHaveURL(/\/contacts$/);
});
