import { createClient } from "@supabase/supabase-js";
import { test, expect } from "./fixtures";

test("only the first user can sign up", async ({ createUser }) => {
  await createUser({ email: "john@doe.com", password: "password" });

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54341",
    process.env.VITE_SB_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { error } = await supabase.auth.signUp({
    email: "jane@doe.com",
    password: "password",
  });

  expect(error).not.toBeNull();
});

test("an administrator can still create users", async ({
  page,
  isMobile,
  createSales,
}) => {
  test.skip(isMobile, "User management is only available on desktop");

  await createSales({
    administrator: true,
    email: "john@doe.com",
    first_name: "John",
    last_name: "Doe",
    password: "password",
  });

  await page.goto("/");
  await page.getByLabel("Email").fill("john@doe.com");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();

  await page.goto("/#/sales");
  await page.getByRole("link", { name: "New user" }).click();
  await page.getByLabel("First name").fill("Marie");
  await page.getByLabel("Last name").fill("Curie");
  await page.getByLabel("Email").fill("marie@curie.com");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText(/^User created/)).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "marie@curie.com" }),
  ).toBeVisible();
});
