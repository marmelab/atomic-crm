import { expect, test } from "@playwright/test";

// Graph UI against the local BFF + W1 seed. Skip when the Atomic
// Supabase e2e stack is the only server (no CRM_BFF_URL).
const bff = process.env.CRM_BFF_URL ?? "http://127.0.0.1:8787";

test.describe("W2 loan triangle", () => {
  test.beforeAll(async ({ request }) => {
    const health = await request.get(`${bff}/health`);
    test.skip(!health.ok(), "local BFF is not running");
  });

  test("opens Willow and walks spouse, team, and loan parties", async ({
    page,
  }) => {
    await page.goto("/#/contacts");
    await expect(page.getByRole("link", { name: "Willow Woodley" })).toBeVisible();
    await page.getByRole("link", { name: "Willow Woodley" }).click();
    await expect(page.getByText("borrower")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sam Spouse" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Willow purchase" })).toBeVisible();
    await page.getByRole("link", { name: "Willow purchase" }).click();
    await expect(page.getByText("referring_agent")).toBeVisible();
    await expect(page.getByRole("link", { name: "Avery Agent" })).toBeVisible();
    await page.getByRole("link", { name: "Avery Agent" }).click();
    await expect(page.getByText("nmls: 999001")).toBeVisible();
    await expect(page.getByRole("link", { name: "Agents with a Grin" })).toBeVisible();
  });
});
