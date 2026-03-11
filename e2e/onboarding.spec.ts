import { test, expect } from "./fixtures";

test("user onboarding", async ({ page }) => {
  await page.goto("http://localhost:5175/");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Atomic CRM/);
  await expect(page.getByText("Welcome to Atomic CRM")).toBeVisible();

  await page.getByLabel("First name").fill("John");
  await page.getByLabel("Last name").fill("Doe");
  await page.getByLabel("Email").fill("john@doe.com");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("What's next?")).toBeVisible();
  await expect(page.getByText("Install Atomic CRM")).toBeVisible();
  await expect(page.getByText("Add your first contact")).toBeVisible();
  await expect(page.getByText("Add your first note")).toBeVisible();
});
