import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import {
  AdminAccountManagerFilter,
  NonAdminAccountManagerFilter,
} from "./CompanyList.stories";

describe("CompanyList", () => {
  beforeAll(() => {
    page.viewport(1600, 900);
  });

  it("offers an account manager picker to an admin", async () => {
    const screen = await render(<AdminAccountManagerFilter />);

    await expect
      .element(screen.getByRole("combobox", { name: "Account manager" }))
      .toBeVisible();
  });

  it("offers no account manager picker to a user who is not an admin", async () => {
    const screen = await render(<NonAdminAccountManagerFilter />);

    await expect.element(screen.getByText("Me")).toBeVisible();
    await expect
      .element(screen.getByRole("combobox", { name: "Account manager" }))
      .not.toBeInTheDocument();
  });
});
