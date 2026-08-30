import { expect, test } from "@playwright/test";

const bff = process.env.CRM_BFF_URL ?? "http://127.0.0.1:8787";

test.describe("W3 saved views home", () => {
  test.beforeAll(async ({ request }) => {
    const health = await request.get(`${bff}/health`);
    test.skip(!health.ok(), "local BFF is not running");
  });

  test("home lists My Borrowers and My Paired Agents", async ({ page }) => {
    await page.goto("/#/");
    await expect(
      page.getByRole("heading", { name: "My Borrowers" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Willow Woodley" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "My Paired Agents" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Avery Agent" })).toBeVisible();
    await page.getByRole("link", { name: "Willow Woodley" }).first().click();
    await expect(page.getByText("borrower")).toBeVisible();
  });
});
