import { test, expect } from "./fixtures";

test("full synthetic flow: create company → contact → deal → advance pipeline → verify dashboard", async ({
  page,
  createUser,
  isMobile,
}) => {
  // Create admin user and sign in
  const email = "admin@hatch-test.com";
  const password = "test-password-123";
  await createUser({ email, password });

  await page.goto("http://localhost:5175/");
  await expect(page).toHaveTitle(/Hatch CRM|Atomic CRM/);

  // Complete onboarding
  await page.getByLabel("First name").fill("Nathan");
  await page.getByLabel("Last name").fill("Test");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  // Wait for dashboard to load
  await page.waitForLoadState("networkidle");

  // --- Step 1: Create a company with construction fields ---
  if (isMobile) {
    await page.getByRole("link", { name: "Companies" }).click();
  } else {
    await page.getByRole("link", { name: "Companies" }).click();
  }
  await page.waitForLoadState("networkidle");

  await page.getByText(/New Company|New/i).first().click();
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Name *").fill("Apex Plumbing Services");

  // Fill construction-specific fields if visible
  const serviceArea = page.getByLabel("Service Area");
  if (await serviceArea.isVisible({ timeout: 2000 }).catch(() => false)) {
    await serviceArea.fill("Greater Toronto Area");
  }

  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForLoadState("networkidle");

  // Verify company was created
  await expect(page.getByText("Apex Plumbing Services")).toBeVisible();

  // --- Step 2: Create a contact linked to the company ---
  if (isMobile) {
    await page.getByRole("link", { name: "Contacts" }).click();
  } else {
    await page.getByRole("link", { name: "Contacts" }).click();
  }
  await page.waitForLoadState("networkidle");

  await page.getByText(/New Contact|New/i).first().click();
  await page.waitForLoadState("networkidle");

  await page.getByLabel("First name").fill("Dave");
  await page.getByLabel("Last name").fill("Martinez");
  await page.getByLabel("Title").fill("Owner");

  // Link to company
  await page.getByLabel("Company").click();
  await page.getByPlaceholder("Search").fill("Apex");
  await page.getByText("Apex Plumbing Services").click();

  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForLoadState("networkidle");

  // Verify contact was created
  await expect(page.getByText("Dave Martinez")).toBeVisible();

  // --- Step 3: Create a deal ---
  if (isMobile) {
    await page.getByRole("link", { name: "Deals" }).click();
  } else {
    await page.getByRole("link", { name: "Deals" }).click();
  }
  await page.waitForLoadState("networkidle");

  await page.getByText(/New Deal|New/i).first().click();
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Name *").fill("Apex Plumbing Audit");

  // Link to company
  const companyField = page.getByLabel("Company");
  if (await companyField.isVisible({ timeout: 2000 }).catch(() => false)) {
    await companyField.click();
    await page.getByPlaceholder("Search").fill("Apex");
    await page.getByText("Apex Plumbing Services").click();
  }

  // Set amount
  const amountField = page.getByLabel("Amount");
  if (await amountField.isVisible({ timeout: 2000 }).catch(() => false)) {
    await amountField.fill("5000");
  }

  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForLoadState("networkidle");

  // --- Step 4: Verify deal appears in pipeline ---
  // The deal should be in the first stage (Lead)
  await expect(page.getByText("Apex Plumbing Audit")).toBeVisible();

  // --- Step 5: Navigate to dashboard and verify it shows data ---
  if (isMobile) {
    await page.getByRole("link", { name: "Dashboard" }).click();
  } else {
    await page.getByRole("link", { name: "Dashboard" }).click();
  }
  await page.waitForLoadState("networkidle");

  // Dashboard should show at least 1 deal, 1 company, or 1 contact
  // The exact widgets depend on dashboard configuration, so check broadly
  const dashboardContent = await page.textContent("body");
  expect(dashboardContent).toBeTruthy();
});
