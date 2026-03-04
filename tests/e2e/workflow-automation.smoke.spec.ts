import { expect, test } from "@playwright/test";

import { loginAsLocalAdmin } from "./support/auth";
import { resetAndSeedTestData } from "./support/test-data-controller";

test.beforeEach(() => {
  resetAndSeedTestData();
});

test("workflow list page loads and shows seeded workflows", async ({
  page,
}) => {
  await loginAsLocalAdmin(page);

  // Navigate to workflows — it's under "Altro" menu on desktop too
  // since it's configured with `nav: { altroMenu: { mobile: true, ... } }`
  await page.goto("/#/workflows");
  await expect(page).toHaveURL(/\/workflows$/);

  // The migration seeds 3 workflows
  await expect(page.getByText("Preventivo accettato → Crea progetto")).toBeVisible();
  await expect(
    page.getByText("Progetto avviato → Task di briefing"),
  ).toBeVisible();
  await expect(
    page.getByText("Pagamento ricevuto → Task ringraziamento"),
  ).toBeVisible();

  // Each should show "Attivo" badge
  const activeBadges = page.getByText("Attivo", { exact: true });
  await expect(activeBadges.first()).toBeVisible();
});

test("workflow show page displays details", async ({ page }) => {
  await loginAsLocalAdmin(page);

  await page.goto("/#/workflows");

  // Click on the first workflow
  await page
    .getByRole("link", { name: "Preventivo accettato → Crea progetto" })
    .click();
  await expect(page).toHaveURL(/\/workflows\/.*\/show$/);

  // Should show workflow details
  await expect(page.getByText("Preventivo accettato → Crea progetto")).toBeVisible();

  // Should show trigger details (scoped to main content to avoid nav "Preventivi" link)
  const mainContent = page.locator("#main-content");
  await expect(mainContent.getByText("Preventivi")).toBeVisible();
  await expect(mainContent.getByText("Cambio stato").first()).toBeVisible();

  // Should show action details
  await expect(
    mainContent.getByText("Crea progetto", { exact: true }),
  ).toBeVisible();

  // Should show action buttons
  await expect(page.getByRole("button", { name: /Disattiva/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Modifica/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Elimina/ })).toBeVisible();
});

test("create a new workflow", async ({ page }) => {
  await loginAsLocalAdmin(page);

  await page.goto("/#/workflows/create");

  // Fill in workflow name
  await page.getByLabel("Nome workflow").fill("Test Workflow E2E");

  // Select trigger resource (default choices should be available)
  await page.getByLabel("Risorsa").click();
  await page.getByRole("option", { name: "Progetti" }).click();

  // Select trigger event
  await page.getByLabel("Evento").click();
  await page.getByRole("option", { name: "Creato" }).click();

  // Select action type — default is create_task
  await page.getByLabel("Tipo azione").click();
  await page.getByRole("option", { name: "Crea promemoria" }).click();

  // Fill task text (conditional field for create_task)
  await page.getByLabel("Testo del promemoria").fill("Promemoria di test");

  // Submit
  await page.getByRole("button", { name: /salva/i }).click();

  // Should redirect to list
  await expect(page).toHaveURL(/\/workflows$/);

  // New workflow should appear in the list
  await expect(page.getByText("Test Workflow E2E")).toBeVisible();
});

test("toggle workflow active/inactive from show page", async ({ page }) => {
  await loginAsLocalAdmin(page);

  await page.goto("/#/workflows");

  // Go to first workflow show
  await page
    .getByRole("link", { name: "Preventivo accettato → Crea progetto" })
    .click();
  await expect(page).toHaveURL(/\/workflows\/.*\/show$/);

  // Should be active — scope to the detail card area
  const detail = page.locator("#main-content");
  await expect(
    detail.locator("[data-slot='badge']").filter({ hasText: "Attivo" }).first(),
  ).toBeVisible();

  // Click disattiva
  await detail.getByRole("button", { name: /Disattiva/ }).click();

  // Badge should change to "Disattivato"
  await expect(
    detail.locator("[data-slot='badge']").filter({ hasText: "Disattivato" }),
  ).toBeVisible();

  // Toggle back
  await detail.getByRole("button", { name: /Attiva/ }).click();
  await expect(
    detail.locator("[data-slot='badge']").filter({ hasText: "Attivo" }).first(),
  ).toBeVisible();
});
