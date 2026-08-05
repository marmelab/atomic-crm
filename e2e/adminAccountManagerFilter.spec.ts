import { expect, test } from "./fixtures";

test.describe("admin filtering by account manager", () => {
  test.beforeEach(async ({ createSales, createCompany, createContact }) => {
    const admin = await createSales({
      administrator: true,
      email: "john@doe.com",
      first_name: "John",
      last_name: "Doe",
      password: "password",
    });

    const teammate = await createSales({
      email: "marie@curie.com",
      first_name: "Marie",
      last_name: "Curie",
      password: "password",
    });

    const company = await createCompany({
      name: "Smith Corp",
      salesId: admin.id,
    });

    await createContact({
      company_id: company.id,
      first_name: "Ada",
      last_name: "Lovelace",
      sales_id: admin.id,
      title: "CTO",
    });

    await createContact({
      company_id: company.id,
      first_name: "Grace",
      last_name: "Hopper",
      sales_id: teammate.id,
      title: "Rear Admiral",
    });
  });

  test("admin narrows the contact list down to a teammate's contacts", async ({
    page,
    isMobile,
    menu,
  }) => {
    test.skip(isMobile, "The filter sidebar is behind a sheet on mobile");

    await page.goto("/");
    await page.getByLabel("Email").fill("john@doe.com");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await menu.goToContacts();
    await expect(page.getByText("Ada Lovelace")).toBeVisible();
    await expect(page.getByText("Grace Hopper")).toBeVisible();

    await page.getByRole("combobox", { name: "Account manager" }).click();
    await page.getByRole("option", { name: "Marie Curie" }).click();

    await expect(page.getByText("Grace Hopper")).toBeVisible();
    await expect(page.getByText("Ada Lovelace")).toBeHidden();
  });

  test("a non-admin user gets no account manager picker", async ({
    page,
    isMobile,
    menu,
  }) => {
    test.skip(isMobile, "The filter sidebar is behind a sheet on mobile");

    await page.goto("/");
    await page.getByLabel("Email").fill("marie@curie.com");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await menu.goToContacts();
    await expect(page.getByText("Grace Hopper")).toBeVisible();

    await expect(
      page.getByRole("combobox", { name: "Account manager" }),
    ).toBeHidden();
  });
});
