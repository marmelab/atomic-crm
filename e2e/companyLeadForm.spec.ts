import { expect, test } from "./fixtures";

test.describe("company lead form", () => {
  test.skip(({ isMobile }) => isMobile, "Covered on desktop only");

  test.beforeEach(async ({ createSales }) => {
    await createSales({
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@lead.test",
      password: "password",
    });
  });

  test("keeps contact numbers on the contact form only", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("ada@lead.test");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveTitle(/Atomic CRM/);

    await page.getByRole("link", { name: "Companies" }).click();
    await page
      .getByRole("link", { name: "Create Company", exact: true })
      .click();

    const lead = page.getByRole("heading", { name: "Lead" });
    await expect(lead).toBeVisible();

    await expect(page.getByLabel("Date")).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(page.getByLabel("Website")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Vertical")).toBeVisible();
    await expect(page.getByLabel("Place")).toBeVisible();

    await expect(page.getByText("Business name")).toHaveCount(0);
    await expect(page.getByText("Existing website URL")).toHaveCount(0);
    await expect(page.getByText("Calling contact")).toHaveCount(0);
    await expect(page.getByText("Business email")).toHaveCount(0);
    await expect(page.getByText("FMCG, Apparel, Toys, etc.")).toHaveCount(0);
    await expect(page.getByLabel("Mobile")).toHaveCount(0);
    await expect(page.getByLabel("WhatsApp number")).toHaveCount(0);

    await page.getByRole("button", { name: "Add new contact" }).click();

    await expect(page.getByLabel("Mobile")).toBeVisible();
    await expect(page.getByLabel("WhatsApp number")).toBeVisible();
  });
});
