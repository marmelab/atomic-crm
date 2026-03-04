import { test } from "@playwright/test";
import { loginAsLocalAdmin } from "./support/auth";

test("Debug dashboard loading", async ({ page }) => {
  // Capture console logs
  const logs: string[] = [];
  page.on("console", (msg) => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on("pageerror", (error) => {
    logs.push(`[PAGE ERROR] ${error.message}`);
  });

  await loginAsLocalAdmin(page);

  await page.waitForTimeout(3000);

  // Track API responses
  const responses: { url: string; status: number }[] = [];
  page.on("response", (response) => {
    if (response.url().includes("rest")) {
      responses.push({
        url: response.url().split("/").pop() ?? "",
        status: response.status(),
      });
    }
  });

  await page.reload();
  await page.waitForTimeout(3000);

  // Screenshot
  await page.screenshot({
    path: "test-results/debug-dashboard.png",
    fullPage: true,
  });
});
