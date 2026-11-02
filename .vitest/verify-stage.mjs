import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:5174/#/deals", {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(4000);

await page.getByRole("radio", { name: /List/i }).click();
await page.waitForTimeout(2500);

// read the first row's deal name and stage
const firstRow = page.locator("tbody tr").first();
const dealName = (
  (await firstRow.locator("td").first().textContent()) ?? ""
).trim();
const stageBefore = (
  (await firstRow
    .locator("[data-slot='select-trigger'], button[aria-haspopup='listbox']")
    .first()
    .textContent()) ?? ""
).trim();
console.log(
  "deal:",
  JSON.stringify(dealName),
  "stage before:",
  JSON.stringify(stageBefore),
);

// open dropdown, pick a different stage
await firstRow
  .locator("button[aria-haspopup='listbox'], [data-slot='select-trigger']")
  .first()
  .click();
await page.waitForTimeout(800);
const listbox = page.getByRole("listbox");
const options = (await listbox.getByRole("option").allTextContents())
  .map((o) => o.replace(/[^A-Za-z\s-]/g, "").trim())
  .filter(Boolean);
const target = options.find(
  (o) => !stageBefore.includes(o) && o !== stageBefore,
);
console.log("changing to:", target);
await listbox
  .getByRole("option", {
    name: new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  })
  .click();
await page.waitForTimeout(3000);

// find the deal by name anywhere in the page and read ITS stage trigger
const row = page.locator("tbody tr").filter({ hasText: dealName }).first();
await row.waitFor({ timeout: 5000 }).catch(() => {});
const stageAfter = (
  (await row
    .locator("button[aria-haspopup='listbox'], [data-slot='select-trigger']")
    .first()
    .textContent()) ?? "ROW NOT FOUND"
).trim();
console.log("stage after (for the same deal):", JSON.stringify(stageAfter));
console.log(
  stageAfter.toLowerCase().includes(target.toLowerCase())
    ? "PASS deal stage changed inline"
    : "FAIL stage did not change",
);
await page.screenshot({ path: ".vitest/after-stage-change.png" });
await browser.close();
process.exit(0);
