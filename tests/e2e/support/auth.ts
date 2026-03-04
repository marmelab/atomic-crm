import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

const adminEmail =
  process.env.LOCAL_SUPABASE_ADMIN_EMAIL ?? "admin@gestionale.local";
const adminPassword =
  process.env.LOCAL_SUPABASE_ADMIN_PASSWORD ?? "LocalAdmin123!";

export { adminEmail, adminPassword };

/**
 * Login come admin locale
 * I dati di test devono essere preparati prima nel test con resetAndSeedTestData()
 */
export const loginAsLocalAdmin = async (page: Page) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Accedi",
    }),
  ).toBeVisible();

  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Accedi" }).click();

  await expect(page.getByRole("link", { name: "Clienti" })).toBeVisible();
};
