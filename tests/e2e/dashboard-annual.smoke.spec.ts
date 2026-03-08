/**
 * E2E smoke test for the annual dashboard:
 * - KPI cards render with correct values from controlled test data
 * - Alert rows have clickable action links to detail pages
 * - AI "spiegami l'anno" card is present and actionable
 * - Expense KPIs flow through to the AI context (verified via network)
 */

import { expect, test } from "@playwright/test";

import { loginAsLocalAdmin } from "./support/auth";
import { resetAndSeedTestData } from "./support/test-data-controller";

test.describe("Annual Dashboard", () => {
  test.beforeEach(() => {
    resetAndSeedTestData();
  });

  test("KPI cards show correct annual totals from test data", async ({
    page,
  }) => {
    await loginAsLocalAdmin(page);

    // Wait for dashboard to load KPI data
    await expect(
      page.getByText("Valore del lavoro dell'anno"),
    ).toBeVisible({ timeout: 15000 });

    // Annual work value: 3 services totaling 6500€
    // (2000+1000+0)+(0+2000+0)+(1000+500+0) = 6500
    const dashboardText = await page.textContent("main");
    expect(dashboardText).toMatch(/6[.,]?500/);

    // Pending payments KPI card
    await expect(
      page.getByText("Pagamenti da ricevere", { exact: true }),
    ).toBeVisible();
    // 2000€ in_attesa + 500€ scaduto = 2500€
    expect(dashboardText).toMatch(/2[.,]?500/);

    // Open quotes: should show count (0 in test data)
    await expect(
      page.getByText("Preventivi aperti", { exact: true }),
    ).toBeVisible();
  });

  test("alert rows have clickable links to detail pages", async ({
    page,
  }) => {
    await loginAsLocalAdmin(page);

    // Wait for alerts card to render
    await expect(
      page.getByText("Scadenze e alert", { exact: false }),
    ).toBeVisible({ timeout: 15000 });

    // There should be at least one overdue payment (500€ scaduto)
    const alertSection = page.locator("main");
    await expect(alertSection.getByText("Scaduto").first()).toBeVisible();

    // Find action links near payment/service alerts
    const paymentLinks = page.locator(
      'a[href*="/payments/"][href*="/show"]',
    );
    const serviceLinks = page.locator(
      'a[href*="/services/"][href*="/show"]',
    );

    // At least one payment or service link should exist in alerts
    const totalLinks =
      (await paymentLinks.count()) + (await serviceLinks.count());
    expect(totalLinks).toBeGreaterThan(0);

    // Click a payment link and verify navigation
    if ((await paymentLinks.count()) > 0) {
      await paymentLinks.first().click();
      await expect(page).toHaveURL(/\/payments\/.+\/show$/);
      await page.goBack();
    }
  });

  test("AI spiegami l'anno card is present with expense context", async ({
    page,
  }) => {
    await loginAsLocalAdmin(page);

    // Wait for AI card to appear
    const aiCard = page.getByText("AI: spiegami l'anno", { exact: false });
    await expect(aiCard).toBeVisible({ timeout: 15000 });

    // Verify the description mentions spese
    await expect(
      page.getByText("spese", { exact: false }).first(),
    ).toBeVisible();

    // The "Spiegami Annuale" button should be present
    const explainButton = page.getByRole("button", {
      name: /spiegami annuale/i,
    });
    await expect(explainButton).toBeVisible();
  });

  test("AI annual summary request includes expense data in payload", async ({
    page,
  }) => {
    // Intercept the Edge Function call BEFORE navigating
    let requestPayload: string | null = null;
    await page.route(
      "**/functions/v1/annual_operations_summary",
      async (route) => {
        requestPayload = route.request().postData();
        // Return a mock response in the exact format the provider expects:
        // { data: AnnualOperationsAnalyticsSummary }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              summaryMarkdown:
                "Test mock: il contesto include correttamente le spese operative.",
              model: "mock-model",
              generatedAt: new Date().toISOString(),
            },
          }),
        });
      },
    );

    await loginAsLocalAdmin(page);

    // Wait for AI card
    const explainButton = page.getByRole("button", {
      name: /spiegami annuale/i,
    });
    await expect(explainButton).toBeVisible({ timeout: 15000 });

    // Click the button
    await explainButton.click();

    // Wait for the mock response to appear in the UI
    await expect(
      page.getByText("contesto include correttamente le spese", {
        exact: false,
      }),
    ).toBeVisible({ timeout: 10000 });

    // Now verify the request payload had expense data
    expect(requestPayload).not.toBeNull();
    const payload = JSON.parse(requestPayload!);

    // The context should have an expenses section
    expect(payload.context).toBeDefined();
    expect(payload.context.expenses).toBeDefined();
    expect(payload.context.expenses.total).toBeGreaterThan(0);
    expect(payload.context.expenses.count).toBeGreaterThan(0);
    expect(payload.context.expenses.byType).toBeInstanceOf(Array);
    expect(payload.context.expenses.byType.length).toBeGreaterThan(0);

    // The annual_expenses_total metric should be present
    const expenseMetric = payload.context.metrics.find(
      (m: { id: string }) => m.id === "annual_expenses_total",
    );
    expect(expenseMetric).toBeDefined();
    expect(expenseMetric.value).toBeGreaterThan(0);

    // credito_ricevuto should NOT be in the expense breakdown
    const creditType = payload.context.expenses.byType.find(
      (t: { expenseType: string }) => t.expenseType === "credito_ricevuto",
    );
    expect(creditType).toBeUndefined();
  });
});
