import { ResourceContextProvider } from "ra-core";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { StoryWrapper, buildCompany, buildDeal } from "@/test/StoryWrapper";
import { DealCardContent } from "./DealCard";
import { DealShow } from "./DealShow";

describe.each([
  ["desktop", 1280, 800],
  ["mobile", 375, 667],
] as const)(
  "deals with missing values at %s resolution",
  (_name, width, height) => {
    beforeEach(async () => {
      await page.viewport(width, height);
    });

    it("omits separators for a missing company and amount", async () => {
      const deal = buildDeal({
        id: 701,
        name: "Imported deal",
        company_id: null as unknown as number,
        amount: null as unknown as number,
        categories: ["other"],
      });
      const screen = await render(
        <StoryWrapper>
          <DealCardContent deal={deal} />
        </StoryWrapper>,
      );

      await expect
        .element(screen.getByText("Imported deal", { exact: true }))
        .toBeVisible();
      await expect
        .element(screen.getByText("Other", { exact: true }))
        .toBeVisible();
    });

    it("keeps a zero amount and separators between populated fields", async () => {
      const deal = buildDeal({
        id: 702,
        name: "Zero deal",
        amount: 0,
        categories: ["other"],
      });
      const screen = await render(
        <StoryWrapper data={{ companies: [buildCompany()] }}>
          <DealCardContent deal={deal} />
        </StoryWrapper>,
      );

      await expect
        .element(screen.getByText("Acme - Zero deal", { exact: true }))
        .toBeVisible();
      await expect
        .element(screen.getByText("$0.00, Other", { exact: true }))
        .toBeVisible();
    });

    it.each([
      ["missing amount and date", null, null, "—", "—", false],
      ["missing amount", null, "2020-01-02", "—", "Jan 2, 2020", true],
      ["missing date", 1000, null, "$1.00K", "—", false],
      ["zero amount", 0, "2020-01-02", "$0.00", "Jan 2, 2020", true],
    ] as const)(
      "opens a deal with %s",
      async (_case, amount, date, amountText, dateText, isPast) => {
        // The database accepts null values even though the form's Deal type requires them.
        const deal = buildDeal({
          id: 703,
          name: "Deal details",
          company_id: null as unknown as number,
          amount: amount as number,
          expected_closing_date: date as string,
        });
        const screen = await render(
          <StoryWrapper data={{ deals: [deal] }}>
            <ResourceContextProvider value="deals">
              <DealShow open id="703" />
            </ResourceContextProvider>
          </StoryWrapper>,
        );

        await expect
          .element(screen.getByRole("heading", { name: "Deal details" }))
          .toBeVisible();
        const amountField = screen
          .getByText("Budget", { exact: true })
          .element().parentElement!;
        expect(amountField.lastElementChild!.textContent).toBe(amountText);
        const dateField = screen
          .getByText("Expected closing date", { exact: true })
          .element().parentElement!;
        expect(dateField.querySelector(".text-sm")!.textContent).toBe(dateText);
        if (isPast) {
          await expect
            .element(screen.getByText("Past", { exact: true }))
            .toBeVisible();
        } else {
          await expect
            .element(screen.getByText("Past", { exact: true }))
            .not.toBeInTheDocument();
        }
      },
    );
  },
);
