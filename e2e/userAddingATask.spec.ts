import { expect, test } from "./fixtures";

test.describe("user adding a task", () => {
  test.beforeEach(async ({ createSales, createContact, createCompany }) => {
    const sales = await createSales({
      first_name: "John",
      last_name: "Doe",
      email: "john@doe.com",
      password: "password",
    });

    const company = await createCompany({
      name: "Smith Corp",
      salesId: sales.id,
    });

    await createContact({
      first_name: "Jane",
      last_name: "Smith",
      title: "CEO",
      sales_id: sales.id,
      company_id: company.id,
      notes: [{ text: "Met at a conference." }],
    });

    await createContact({
      first_name: "Bob",
      last_name: "Johnson",
      title: "CTO",
      sales_id: sales.id,
      company_id: company.id,
    });

    await createContact({
      first_name: "Alice",
      last_name: "Williams",
      title: "CFO",
      sales_id: sales.id,
      company_id: company.id,
    });
  });
  test("user adding a task", async ({ page, isMobile, menu, dismissToast }) => {
    await page.goto("http://localhost:5175/");
    await page.getByLabel("Email").fill("john@doe.com");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveTitle(/Atomic CRM/);
    await expect(page.getByText("Latest Activity")).toBeVisible();

    await menu.goToContacts();
    await page.waitForLoadState("networkidle");

    await page.getByText("Jane Smith").click();
    await page.waitForLoadState("networkidle");

    if (isMobile) {
      await page.getByRole("button", { name: "Create" }).click();
      await page.getByRole("menuitem", { name: "Task" }).click();
    } else {
      await page.getByRole("button", { name: "Add Task" }).click();
    }
    await page.getByLabel("Description *").fill("Follow up with Jane");
    await page.getByLabel("Due date").fill("2026-04-11T21:00");
    await page.getByLabel("Type").click();
    await page.getByRole("option", { name: "Call" }).click();

    await page.getByRole("button", { name: "Save" }).click();

    await dismissToast("Task added");

    if (isMobile) {
      await expect(page.getByText("1 task")).toBeVisible();
      await page.getByText("1 task").click();

      await expect(page.getByText("Follow up with Jane")).toBeVisible();
      await expect(page.getByText("due 4/11/2026, 9:00:00 PM")).toBeVisible();
    } else {
      await expect(page.getByText("Tasks")).toBeVisible();

      await expect(page.getByText("Tasks").locator("..")).toHaveText(
        /Follow up with Jane/,
      );
      await menu.goToDashboard();

      await expect(page.getByText("Upcoming Tasks")).toBeVisible();
      await expect(
        page.getByText("Upcoming Tasks").locator("../.."),
      ).toHaveText(/Follow up with Jane/);
      await expect(
        page.getByText("Follow up with Jane").locator(".."),
      ).toHaveText(
        "Call Follow up with Janedue 4/11/2026, 9:00:00 PM (Re: Jane Smith)",
      );
    }
  });
});
