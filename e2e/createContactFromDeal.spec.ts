import { expect, test } from "./fixtures";

test.describe("user creating a contact from the deal form", () => {
  test.skip(({ isMobile }) => isMobile, "Covered on desktop only");

  test.beforeEach(async ({ createSales, createCompany, createContact }) => {
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

    // the deal list only offers to create a deal once a contact exists
    await createContact({
      first_name: "Jane",
      last_name: "Smith",
      title: "CEO",
      sales_id: sales.id,
      company_id: company.id,
    });
  });

  test("creates the missing contact without leaving the deal form", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("john@doe.com");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveTitle(/Atomic CRM/);

    await page.getByRole("link", { name: "Deals" }).click();
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: "Create deal" }).click();

    // "Linked to" keeps this scoped to the deal form once the contact sheet opens
    const dealForm = page.getByRole("dialog").filter({ hasText: "Linked to" });
    await dealForm
      .getByRole("textbox", { name: "Name" })
      .fill("Big opportunity");
    await dealForm.getByRole("combobox", { name: "Company" }).click();
    await page.getByRole("option", { name: "Smith Corp" }).click();

    // Grace is not in the contact list yet
    const contactInput = dealForm.getByPlaceholder("Search");
    await contactInput.click();
    await contactInput.fill("Grace Hopper");
    await expect(
      page.getByRole("option", { name: "Create Grace Hopper" }),
    ).toBeVisible();
    await page.getByRole("option", { name: "Create Grace Hopper" }).click();

    // the creation form opens, prefilled from what was typed and from the deal
    const contactSheet = page.getByRole("dialog", { name: "New Contact" });
    await expect(contactSheet.getByLabel("First name")).toHaveValue("Grace");
    await expect(contactSheet.getByLabel("Last name")).toHaveValue("Hopper");
    await expect(
      contactSheet.getByRole("combobox", { name: "Company" }),
    ).toContainText("Smith Corp");

    await contactSheet
      .getByRole("button", { name: "Save", exact: true })
      .click();

    // the deal form is still there, with the new contact selected
    await expect(contactSheet).toBeHidden();
    await expect(dealForm.getByText("Grace Hopper")).toBeVisible();

    await dealForm.getByRole("button", { name: "Save", exact: true }).click();
    await page.waitForLoadState("networkidle");

    // the link survives the deal being saved
    await page.getByText("Big opportunity").click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Grace Hopper")).toBeVisible();
  });
});
