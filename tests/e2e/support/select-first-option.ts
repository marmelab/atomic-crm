import { expect, type Locator, type Page } from "@playwright/test";

export const selectFirstOption = async (page: Page, trigger: Locator) => {
  await trigger.click();
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
};
