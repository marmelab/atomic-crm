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
  await expect(page.getByText("1/3 done")).toBeVisible();
  await expect(page.getByText("Install Atomic CRM")).toBeVisible();
  await expect(page.getByText("Add your first contact")).toBeVisible();
  await expect(page.getByText("Add your first note")).toBeVisible();

  await page.getByText("New Contact").click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("She/Her").click();
  await page.getByLabel("First name").fill("Jane");
  await page.getByLabel("Last name").fill("Smith");
  await page.getByLabel("Title").fill("CEO");
  await page.getByLabel("Company").click();
  await page.getByPlaceholder("Search...").fill("Smith Corp");
  await page.getByText("Create Smith Corp").click();
  await page
    .getByRole("group", { name: "Email addresses" })
    .getByRole("button", { name: "Add" })
    .click();
  await page
    .getByRole("group", { name: "Email addresses" })
    .getByRole("textbox", { name: "Email" })
    .fill("jane@smithcorp.com");

  await page
    .getByRole("group", { name: "Phone numbers" })
    .getByRole("button", { name: "Add" })
    .click();
  await page
    .getByRole("group", { name: "Phone numbers" })
    .getByRole("textbox", { name: "Phone number" })
    .fill("+1234567890");

  await page
    .getByLabel("LinkedIn URL")
    .fill("https://www.linkedin.com/in/jane-smith");

  await page
    .getByLabel("Background info (bio, how you met, etc)")
    .fill("Met at a conference.");

  await page.getByLabel("Has newsletter").check();

  await expect(page.getByLabel("Account manager *")).toHaveText("John Doe");

  await page.getByRole("button", { name: "Save" }).click();

  await page.waitForURL("**/contacts/*");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("Jane Smith")).toBeVisible();
  await expect(page.getByText("CEO at Smith Corp")).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("2/3 done")).toBeVisible();

  await page.getByRole("link", { name: "Add note" }).click();

  await page.waitForLoadState("networkidle");

  await page.getByPlaceholder("Add a note").fill("This is a note about Jane.");
  await page.getByRole("button", { name: "Add this note" }).click();

  await expect(page.getByText("Element created")).toBeVisible();
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("You added a note")).toBeVisible();
  await expect(page.getByText("This is a note about Jane.")).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();

  await page.waitForLoadState("networkidle");

  await expect(page.getByText("Latest Activity")).toBeVisible();
  await expect(
    page.getByText("Latest Activity").locator("xpath=../.."),
  ).toHaveText(/You added company Smith Corp today at/);

  await expect(
    page.getByText("Latest Activity").locator("xpath=../.."),
  ).toHaveText(/You added Jane Smith to Smith Corp today at/);

  await expect(
    page.getByText("Latest Activity").locator("xpath=../.."),
  ).toHaveText(/You added a note about Jane Smith today at/);
});
