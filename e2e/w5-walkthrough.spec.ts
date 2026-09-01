import { expect, test } from "@playwright/test";

const bff = process.env.CRM_BFF_URL ?? "http://127.0.0.1:8787";

test.describe("W5 walkthrough harden", () => {
  test.beforeAll(async ({ request }) => {
    const health = await request.get(`${bff}/health`);
    test.skip(!health.ok(), "local BFF is not running");
  });

  test("home labels the Avery duplicate and shows the POC banner", async ({
    page,
  }) => {
    await page.goto("/#/");
    await expect(
      page.getByText("This is a POC. Design is not frozen."),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "My Borrowers" }),
    ).toBeVisible();
    const borrowers = page
      .locator("h2", { hasText: "My Borrowers" })
      .locator("..");
    await expect(borrowers.getByText("Avery Agent · borrower")).toBeVisible();
    await expect(borrowers.getByText("possible duplicate")).toBeVisible();
    const agents = page
      .locator("h2", { hasText: "My Paired Agents" })
      .locator("..");
    await expect(
      agents.getByText("Avery Agent · real_estate_agent"),
    ).toBeVisible();
  });

  test("Willow show lists agent, LO, and team from the loan", async ({
    page,
  }) => {
    await page.goto("/#/contacts");
    await page.getByRole("link", { name: "Willow Woodley" }).click();
    await expect(
      page.getByRole("heading", { name: "Loan triangle" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Avery Agent" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Phil Officer" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Agents with a Grin" }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Merge into" }),
    ).toBeVisible();
  });

  test("contact search filters as you type", async ({ page }) => {
    await page.goto("/#/contacts");
    await expect(
      page.getByRole("link", { name: "Willow Woodley" }),
    ).toBeVisible();
    await page.getByLabel("Search name or NMLS").fill("999001");
    await expect(page.getByRole("link", { name: "Avery Agent" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Willow Woodley" }),
    ).toHaveCount(0);
  });
});
