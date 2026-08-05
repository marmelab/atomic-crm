import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import {
  AdminAccountManagerFilter,
  NonAdminAccountManagerFilter,
} from "./DealList.stories";

describe("DealList", () => {
  beforeAll(() => {
    page.viewport(1600, 900);
  });

  it("replaces the only-mine switch with an account manager picker for an admin", async () => {
    const screen = await render(<AdminAccountManagerFilter />);

    await expect
      .element(screen.getByRole("combobox", { name: "Account manager" }))
      .toBeVisible();
    await expect
      .element(screen.getByText("Only deals I manage"))
      .not.toBeInTheDocument();
  });

  it("returns to every deal after an admin clears the account manager", async () => {
    const screen = await render(<AdminAccountManagerFilter />);

    await expect.element(screen.getByText("Jane deal")).toBeVisible();
    await expect.element(screen.getByText("Marie deal")).toBeVisible();

    await screen.getByRole("combobox", { name: "Account manager" }).click();
    await screen.getByRole("option", { name: "Marie Curie" }).click();

    await expect.element(screen.getByText("Jane deal")).not.toBeInTheDocument();

    await screen.getByRole("button", { name: "Clear value" }).click();

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
});
