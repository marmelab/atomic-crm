import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:5174/#/deals", {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(4000);

// go to list view (fresh demo session starts in Kanban)
await page.getByRole("radio", { name: /List/i }).click();
await page.waitForTimeout(2500);
const body = (await page.textContent("body")) ?? "";

const dealArg = process.argv[2] ?? "Sunt doloremque enim";
console.log("looking for deal:", dealArg);
console.log(
  body.includes(dealArg)
    ? "PASS deal visible in list"
    : "FAIL deal not in page 1 of list (may be on another page or renamed)",
);

const kanbanBody = await page.evaluate(() => {
  const headings = Array.from(document.querySelectorAll("h3"));
  const heading = headings.find((h) => h.textContent?.trim() === "New");
  return heading ? heading.textContent : null;
});
console.log("kanban New heading:", kanbanBody);
await browser.close();
process.exit(0);
