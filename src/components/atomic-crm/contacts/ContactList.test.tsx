import { render } from "vitest-browser-react";

import {
  DesktopEmpty,
  DesktopSuccess,
  DesktopLoading,
  DesktopError,
} from "./ContactList.stories";

describe("ContactList", () => {
  it("renders an invite to create the first contact when the app is empty", async () => {
    const screen = await render(<DesktopEmpty />);
    await expect
      .element(screen.getByRole("heading", { name: "No contacts found" }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("It seems your contact list is empty."))
      .toBeVisible();
  });

  it("renders contacts in a list", async () => {
    const screen = await render(<DesktopSuccess />);

    await expect.element(screen.getByText("Ada Lovelace")).toBeVisible();
    await expect.element(screen.getByText("Grace Hopper")).toBeVisible();
    await expect
      .element(screen.getByRole("heading", { name: "No contacts found" }))
      .not.toBeInTheDocument();
  });

  it.skip("renders a skeleton while loading", async () => {
    const screen = await render(<DesktopLoading />);

    await expect
      .poll(() => screen.container.querySelector('[data-slot="skeleton"]'))
      .not.toBeNull();
  });

  it("renders an error notification when loading contacts fails", async () => {
    const screen = await render(<DesktopError />);

    await expect
      .element(screen.getByText("Error loading contacts"))
      .toBeVisible();
  });
});
