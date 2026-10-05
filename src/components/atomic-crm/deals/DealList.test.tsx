import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { createDataProvider } from "../providers/fakerest";
import { buildCompany, buildDeal, createCrmDb } from "@/test/StoryWrapper";
import {
  AdminAccountManagerFilter,
  CreateDeal,
  LegacyCategoryFilter,
  NonAdminAccountManagerFilter,
} from "./DealList.stories";

describe("DealList", () => {
  beforeAll(() => {
    page.viewport(1600, 900);
  });

  it("lets an admin filter the board by account manager instead of only-mine", async () => {
    const screen = await render(<AdminAccountManagerFilter />);

    await expect.element(screen.getByText("Jane deal")).toBeVisible();
    await expect.element(screen.getByText("Marie deal")).toBeVisible();
    await expect
      .element(screen.getByText("Only deals I manage"))
      .not.toBeInTheDocument();

    await screen.getByRole("combobox", { name: "Account manager" }).click();
    await screen.getByRole("option", { name: "Marie Curie" }).click();

    await expect.element(screen.getByText("Jane deal")).not.toBeInTheDocument();

    const clearButton = screen.getByRole("button", { name: "Clear value" });
    await clearButton.element().focus();
    await userEvent.keyboard("{Enter}");

    await expect.element(screen.getByText("Jane deal")).toBeVisible();
    await expect.element(screen.getByText("Marie deal")).toBeVisible();
  });

  it("keeps the only-mine switch for a user who is not an admin", async () => {
    const screen = await render(<NonAdminAccountManagerFilter />);

    await expect.element(screen.getByText("Only deals I manage")).toBeVisible();
    await expect
      .element(screen.getByRole("combobox", { name: "Account manager" }))
      .not.toBeInTheDocument();
  });

  it("shows a stale single-category filter in the Category input, where it can be cleared", async () => {
    const screen = await render(<LegacyCategoryFilter />);

    await expect.element(screen.getByText("Copywriting deal")).toBeVisible();
    await expect
      .element(screen.getByText("Design deal"))
      .not.toBeInTheDocument();
    // the Category input shows the migrated filter as a removable chip
    const removeChip = screen.getByRole("button", {
      name: "Remove",
      exact: true,
    });
    await expect.element(removeChip).toBeVisible();
    expect(removeChip.element().parentElement).toHaveTextContent("Copywriting");

    await removeChip.click();

    await expect.element(screen.getByText("Design deal")).toBeVisible();
    await expect.element(screen.getByText("Copywriting deal")).toBeVisible();
  });

  it("creates a deal with an amount per category, summed into its budget", async () => {
    const dataProvider = createDataProvider({
      // with no deal at all, the list shows its empty state, not the dialog
      db: createCrmDb({ companies: [buildCompany()], deals: [buildDeal()] }),
      latency: 0,
      silent: true,
    });
    const screen = await render(<CreateDeal dataProvider={dataProvider} />);

    await screen.getByRole("textbox", { name: "Name" }).fill("Website revamp");
    await screen.getByRole("combobox", { name: "Company" }).click();
    await screen.getByRole("option", { name: "Acme" }).click();

    // the form starts with one empty line
    await screen.getByRole("combobox", { name: "Category" }).click();
    await screen.getByRole("option", { name: "Website design" }).click();
    await screen.getByRole("spinbutton", { name: "Budget" }).fill("8000");
    await screen.getByRole("button", { name: "Add" }).click();
    await screen.getByRole("combobox", { name: "Category" }).nth(1).click();
    await screen.getByRole("option", { name: "Copywriting" }).click();
    await screen
      .getByRole("spinbutton", { name: "Budget" })
      .nth(1)
      .fill("4500.5");

    await expect.element(screen.getByText("Budget: $12,500.50")).toBeVisible();

    await screen.getByRole("button", { name: "Save" }).click();

    await expect
      .poll(async () => {
        const { data } = await dataProvider.getList("deals", {
          filter: { name: "Website revamp" },
          pagination: { page: 1, perPage: 10 },
          sort: { field: "id", order: "ASC" },
        });
        return data.map((deal) => deal.category_amounts);
      })
      .toEqual([
        [
          { category: "website-design", amount: 8000 },
          { category: "copywriting", amount: 4500.5 },
        ],
      ]);
  });
});
