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

  it("keeps the only-mine switch for a user who is not an admin", async () => {
    const screen = await render(<NonAdminAccountManagerFilter />);

    await expect.element(screen.getByText("Only deals I manage")).toBeVisible();
    await expect
      .element(screen.getByRole("combobox", { name: "Account manager" }))
      .not.toBeInTheDocument();
  });
});
