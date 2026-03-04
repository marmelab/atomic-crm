import { expect, test } from "@playwright/test";

import { loginAsLocalAdmin } from "./support/auth";
import { resetAndSeedTestData } from "./support/test-data-controller";

test.beforeEach(() => {
  resetAndSeedTestData();
});

test("desktop: toggle between list and kanban views on projects page", async ({
  page,
}) => {
  await loginAsLocalAdmin(page);
  await page.getByRole("link", { name: /^Progetti$/ }).click();
  await expect(page).toHaveURL(/\/projects$/);

  // Default is list view — the kanban toggle group should be visible on desktop
  const kanbanToggle = page.getByRole("radio", { name: "Vista kanban" });
  const listToggle = page.getByRole("radio", { name: "Vista lista" });
  await expect(listToggle).toBeVisible();
  await expect(kanbanToggle).toBeVisible();

  // List view should show the project table/list content
  await expect(listToggle).toHaveAttribute("data-state", "on");

  // Switch to kanban
  await kanbanToggle.click();
  await expect(kanbanToggle).toHaveAttribute("data-state", "on");

  // Kanban columns should appear
  await expect(page.getByText("In Corso")).toBeVisible();
  await expect(page.getByText("In Pausa")).toBeVisible();
  await expect(page.getByText("Completati")).toBeVisible();
  await expect(page.getByText("Cancellati")).toBeVisible();

  // Our seeded test project (status: in_corso) should appear in the "In Corso" column
  await expect(page.getByText(/Test Project/)).toBeVisible();

  // Switch back to list
  await listToggle.click();
  await expect(listToggle).toHaveAttribute("data-state", "on");
});

test("kanban view shows project cards with correct details", async ({
  page,
}) => {
  await loginAsLocalAdmin(page);
  await page.getByRole("link", { name: /^Progetti$/ }).click();

  // Switch to kanban
  await page.getByRole("radio", { name: "Vista kanban" }).click();

  // Check that the test project card is visible with its details
  const projectCard = page.getByText(/Test Project/);
  await expect(projectCard).toBeVisible();

  // The card should show the category badge
  await expect(page.getByText("Produzione TV")).toBeVisible();

  // Budget info should be visible
  await expect(page.getByText(/Budget:/)).toBeVisible();
});

test("mobile: kanban toggle is not shown, only list view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsLocalAdmin(page);

  // Navigate to projects via mobile nav
  const mobileNav = page.getByRole("navigation", { name: "Navigazione CRM" });
  await mobileNav.getByRole("button", { name: "Altro" }).click();
  await page.getByRole("menuitem", { name: "Progetti" }).click();
  await expect(page).toHaveURL(/\/projects$/);

  // Kanban toggle should NOT be visible on mobile
  await expect(
    page.getByRole("radio", { name: "Vista kanban" }),
  ).not.toBeVisible();
});
