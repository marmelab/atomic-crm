import { expect, test } from "@playwright/test";
import { loginAsLocalAdmin } from "./support/auth";

test("AI chat opens and works", async ({ page }) => {
  await loginAsLocalAdmin(page);

  // Apri chat AI
  await page.getByRole("button", { name: "Apri chat AI unificata" }).click();

  // Verifica che si apre
  await expect(
    page.getByPlaceholder("Chiedi qualcosa sul CRM..."),
  ).toBeVisible();

  // Verifica domande suggerite
  await expect(
    page.getByText("Dammi un riepilogo operativo rapido"),
  ).toBeVisible();

  // Scrivi una domanda
  await page.getByPlaceholder("Chiedi qualcosa sul CRM...").fill("test");

  // Verifica che il bottone invia è visibile
  await expect(page.getByRole("button", { name: "Invia" })).toBeVisible();
});
