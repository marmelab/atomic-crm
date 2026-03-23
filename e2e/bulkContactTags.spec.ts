import { test, expect } from "./fixtures";

test("user adds a tag to several contacts", async ({
  page,
  isMobile,
  createContact,
  createSales,
  menu,
  dismissToast,
}) => {
  test.skip(isMobile, "Bulk tag is only available on desktop");

  const sales = await createSales({
    email: "john@doe.com",
    first_name: "John",
    last_name: "Doe",
    password: "password",
  });

  await createContact({
    first_name: "Ada",
    last_name: "Lovelace",
    sales_id: sales.id,
  });
  await createContact({
    first_name: "Grace",
    last_name: "Hopper",
    sales_id: sales.id,
  });

  await page.goto("http://localhost:5175/");

  await page.getByLabel("Email").fill("john@doe.com");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveTitle(/Atomic CRM/);
  await expect(page.getByRole("link", { name: "Contacts" })).toBeVisible();

  await menu.goToContacts();

  const checkboxes = page.getByRole("checkbox");
  await checkboxes.nth(1).click();
  await checkboxes.nth(2).click();

  await page.getByRole("button", { name: /^Tag$/ }).click();
  await page.getByRole("button", { name: "Create new tag" }).click();
  await page.getByLabel("Tag name").fill("Prospect");
  await page.getByRole("button", { name: "Save" }).click();

  await dismissToast("Tag added to 2 contacts");

  await expect(page.getByText("Prospect")).toHaveCount(2);
});
