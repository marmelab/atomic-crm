import { test, expect } from "./fixtures";

const APP_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173";

test("synthetic flow: sign in, create company and contact, then verify dashboard", async ({
  page,
  createUser,
}) => {
  const email = "admin@hatch-test.com";
  const password = "test-password-123";
  await createUser({ email, password });

  await page.goto(APP_URL);
  await expect(page).toHaveTitle(/Hatch CRM|Atomic CRM/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForLoadState("networkidle");

  await page.getByRole("link", { name: "Companies" }).click();
  await page.waitForLoadState("networkidle");

  await page.getByText(/New Company|New/i).first().click();
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Name *").fill("Apex Plumbing Services");

  const serviceArea = page.getByLabel("Service Area");
  if (await serviceArea.isVisible({ timeout: 2000 }).catch(() => false)) {
    await serviceArea.fill("Greater Toronto Area");
  }

  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Apex Plumbing Services")).toBeVisible();

  await page.getByRole("link", { name: "Contacts" }).click();
  await page.waitForLoadState("networkidle");

  await page.getByText(/New Contact|New/i).first().click();
  await page.waitForLoadState("networkidle");

  await page.getByLabel("First name").fill("Dave");
  await page.getByLabel("Last name").fill("Martinez");
  await page.getByLabel("Title").fill("Owner");

  await page.getByLabel("Company").click();
  await page.getByPlaceholder("Search").fill("Apex");
  await page.getByText("Apex Plumbing Services").click();

  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Dave Martinez")).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("What's next?")).toBeVisible();
  await expect(page.getByText("Add your first note")).toBeVisible();
});
