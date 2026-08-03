import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

const dropClientCachesKeepingSession = (page: Page) =>
  page.evaluate(() => {
    const all = Object.keys(localStorage);
    if (!all.some((key) => key.startsWith("RaStore"))) {
      throw new Error(
        `Expected ra-core store keys in localStorage, found: ${all.join(", ")}`,
      );
    }
    all
      .filter((key) => !key.startsWith("sb-"))
      .forEach((key) => localStorage.removeItem(key));
  });

test.describe("user preferences", () => {
  test.beforeEach(async ({ createSales }) => {
    await createSales({
      first_name: "John",
      last_name: "Doe",
      email: "john@doe.com",
      password: "password",
    });
  });

  test("theme and language survive a reload", async ({ page, isMobile }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("john@doe.com");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveTitle(/Atomic CRM/);

    if (isMobile) {
      await page.goto("/settings");
      await page.getByRole("radio", { name: "Dark" }).click();
    } else {
      await page.getByRole("button", { name: "Toggle theme" }).click();
      await page.getByRole("menuitem", { name: "Dark" }).click();
    }
    await expect(page.locator("html")).toHaveClass(/dark/);

    if (!isMobile) {
      await page.goto("/profile");
    }
    await page.getByRole("combobox").filter({ hasText: "English" }).click();
    await page.getByRole("option", { name: "Français" }).click();

    await expect(page.getByText("Langue")).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await dropClientCachesKeepingSession(page);
    await page.reload();

    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByText("Langue")).toBeVisible();
  });
});
