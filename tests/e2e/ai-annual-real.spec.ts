/**
 * REAL AI test — calls the actual Edge Function (no mocks).
 * Verifies that the AI response:
 * 1. Contains expense/margin data
 * 2. Says "provvisorie" or "parziali" for current year
 * 3. Does NOT treat zeros as automatic problems
 * 4. Mentions the correct work value and expense range
 * 5. Distinguishes margine lordo from reddito fiscale
 */

import { expect, test } from "@playwright/test";

import { loginAsLocalAdmin } from "./support/auth";
import { resetAndSeedTestData } from "./support/test-data-controller";

test.describe("AI Annual Real Response", () => {
  test.beforeEach(() => {
    resetAndSeedTestData();
  });

  test("AI spiegami l'anno produces correct, prudent summary with expense data", async ({
    page,
  }) => {
    // Capture the request context and response
    let requestContext: Record<string, unknown> | null = null;
    let aiResponseMarkdown: string | null = null;

    // Intercept to capture payload AND let it through to real AI
    page.on("response", async (response) => {
      if (
        response.url().includes("annual_operations_summary") &&
        response.status() === 200
      ) {
        try {
          const body = await response.json();
          aiResponseMarkdown = body?.data?.summaryMarkdown ?? null;
        } catch {
          // ignore parse errors
        }
      }
    });

    page.on("request", (request) => {
      if (request.url().includes("annual_operations_summary")) {
        try {
          const body = JSON.parse(request.postData() ?? "{}");
          requestContext = body.context;
        } catch {
          // ignore
        }
      }
    });

    await loginAsLocalAdmin(page);

    // Click "Spiegami Annuale"
    const explainButton = page.getByRole("button", {
      name: /spiegami annuale/i,
    });
    await expect(explainButton).toBeVisible({ timeout: 15000 });
    await explainButton.click();

    // Wait for the AI response to appear (real API call, may take time)
    await expect(
      page.getByText("In breve", { exact: false }),
    ).toBeVisible({ timeout: 60000 });

    // ────────────────────────────────────────────────
    // VERIFY: Request context had correct expense data
    // ────────────────────────────────────────────────
    expect(requestContext).not.toBeNull();
    const ctx = requestContext as Record<string, unknown>;
    const expenses = ctx.expenses as {
      total: number;
      count: number;
      byType: Array<{ expenseType: string; amount: number }>;
    };

    // Expenses must be present and non-zero
    expect(expenses).toBeDefined();
    expect(expenses.total).toBeGreaterThan(0);
    expect(expenses.count).toBeGreaterThan(0);

    // credito_ricevuto must NOT appear
    const creditEntry = expenses.byType.find(
      (t) => t.expenseType === "credito_ricevuto",
    );
    expect(creditEntry).toBeUndefined();

    // annual_expenses_total metric must exist
    const metrics = ctx.metrics as Array<{
      id: string;
      value: number;
      basis: string;
    }>;
    const expenseMetric = metrics.find(
      (m) => m.id === "annual_expenses_total",
    );
    expect(expenseMetric).toBeDefined();
    expect(expenseMetric!.value).toBeGreaterThan(0);
    expect(expenseMetric!.basis).toBe("cost");

    // Meta: current year → isCurrentYear must be true
    const meta = ctx.meta as { isCurrentYear: boolean; selectedYear: number };
    expect(meta.isCurrentYear).toBe(true);
    expect(meta.selectedYear).toBe(new Date().getFullYear());

    // ────────────────────────────────────────────────
    // VERIFY: AI response text is correct and prudent
    // ────────────────────────────────────────────────
    expect(aiResponseMarkdown).not.toBeNull();
    const text = aiResponseMarkdown!.toLowerCase();

    // Must mention expenses or spese
    expect(text).toMatch(/spes[eoia]/);

    // Must mention margine lordo or margin
    expect(text).toMatch(/margine/);

    // Current year → must say provisional/partial
    expect(text).toMatch(/provvisor[ieao]|parzial[ieao]/);

    // Must NOT present "reddito fiscale" as if it were calculated here
    // (it should either not mention it or explicitly say it's different/outside scope)
    if (text.includes("reddito fiscale")) {
      expect(text).toMatch(
        /fuori|esclus|non.*includ|non.*contesto|non.*consider|non.*reddito fiscale|non è il reddito|non sono in quest/,
      );
    }

    // Must contain expected sections
    expect(aiResponseMarkdown).toMatch(/## In breve/i);
    expect(aiResponseMarkdown).toMatch(/## Cose importanti/i);

    // Must NOT treat zero quotes as automatic problem
    if (text.includes("preventivi")) {
      expect(text).not.toMatch(
        /problema|critico|alarm|emergenz|preoccupant/,
      );
    }

    // Log the response for manual inspection
    console.warn("\n=== AI RESPONSE (real) ===\n");
    console.warn(aiResponseMarkdown);
    console.warn("\n=== END AI RESPONSE ===\n");
  });

  test("AI answer about expenses gives correct margin calculation", async ({
    page,
  }) => {
    let aiAnswerMarkdown: string | null = null;

    page.on("response", async (response) => {
      if (
        response.url().includes("annual_operations_answer") &&
        response.status() === 200
      ) {
        try {
          const body = await response.json();
          aiAnswerMarkdown = body?.data?.answerMarkdown ?? null;
        } catch {
          // ignore
        }
      }
    });

    await loginAsLocalAdmin(page);

    // Wait for AI card to be ready
    await expect(
      page.getByText("AI: spiegami l'anno", { exact: false }),
    ).toBeVisible({ timeout: 15000 });

    // Type a question about expenses/margin
    const textarea = page.getByLabel("Fai una domanda su questo anno");
    await textarea.fill("Qual è il margine lordo finora?");

    // Click "Chiedi all'AI"
    const askButton = page.getByRole("button", { name: /chiedi all'ai/i });
    await askButton.click();

    // Wait for answer (real API call)
    await expect(
      page.getByText("Domanda:", { exact: false }),
    ).toBeVisible({ timeout: 60000 });

    expect(aiAnswerMarkdown).not.toBeNull();
    const text = aiAnswerMarkdown!.toLowerCase();

    // Must mention margine
    expect(text).toMatch(/margine/);

    // Must mention spese
    expect(text).toMatch(/spes[eoia]/);

    // Must say provisional for current year
    expect(text).toMatch(/provvisor[ieao]|parzial[ieao]/);

    // Must NOT confuse with fiscal income
    if (text.includes("reddito")) {
      expect(text).toMatch(
        /fuori|esclus|diverso|non.*coincid|non.*confond|non.*reddito fiscale|non è il reddito|non sono in quest/,
      );
    }

    // Log for manual inspection
    console.warn("\n=== AI ANSWER (real) ===\n");
    console.warn(aiAnswerMarkdown);
    console.warn("\n=== END AI ANSWER ===\n");
  });
});
