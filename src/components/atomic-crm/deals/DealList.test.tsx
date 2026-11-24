import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import {
  AdminAccountManagerFilter,
  NonAdminAccountManagerFilter,
  RequiredFieldsOnly,
} from "./DealList.stories";

describe("DealList", () => {
  beforeAll(() => {
    page.viewport(1600, 900);
  });

  it("lets an admin filter the board by account manager instead of only-mine", async () => {
    const screen = await render(<AdminAccountManagerFilter />);

    await expect.element(screen.getByText("Acme - Jane deal")).toBeVisible();
    await expect.element(screen.getByText("Acme - Marie deal")).toBeVisible();
    await expect
      .element(screen.getByText("Only deals I manage"))
      .not.toBeInTheDocument();

    await screen.getByRole("combobox", { name: "Account manager" }).click();
    await screen.getByRole("option", { name: "Marie Curie" }).click();

    await expect
      .element(screen.getByText("Acme - Jane deal"))
      .not.toBeInTheDocument();

    const clearButton = screen.getByRole("button", { name: "Clear value" });
    await clearButton.element().focus();
    await userEvent.keyboard("{Enter}");

    await expect.element(screen.getByText("Acme - Jane deal")).toBeVisible();
    await expect.element(screen.getByText("Acme - Marie deal")).toBeVisible();
  });

  it.each(["/deals", "/deals/1/show", "/deals/1"])(
    "shows a deal that only has the fields the database requires at %s",
    async (path) => {
      const screen = await render(<RequiredFieldsOnly path={path} />);

      await expect.element(screen.getByText(/Acme deal/).first()).toBeVisible();
    },
  );

  it("keeps the only-mine switch for a user who is not an admin", async () => {
    const screen = await render(<NonAdminAccountManagerFilter />);

    await expect.element(screen.getByText("Only deals I manage")).toBeVisible();
    await expect
      .element(screen.getByRole("combobox", { name: "Account manager" }))
      .not.toBeInTheDocument();
  });
});
