import { composeStories } from "@storybook/react-vite";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import * as stories from "./ContactList.stories";

const {
  BulkCreateTagDesktop,
  BulkTagDesktop,
  EmptyDesktop,
  ErrorMobile,
  LoadingContent,
  SuccessDesktop,
} = composeStories(stories);

const getSelectionCheckboxes = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-slot="checkbox"]')).map(
    (element) => element as HTMLElement,
  );

describe("Contact list", () => {
  it("renders the empty state in the desktop list", async () => {
    const screen = await render(<EmptyDesktop />);

    await expect
      .element(screen.getByRole("heading", { name: "No contacts found" }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("It seems your contact list is empty."))
      .toBeVisible();
  });

  it("renders contacts in the desktop success state", async () => {
    const screen = await render(<SuccessDesktop />);

    await expect.element(screen.getByText("Ada Lovelace")).toBeVisible();
    await expect.element(screen.getByText("Grace Hopper")).toBeVisible();
    await expect
      .element(screen.getByRole("heading", { name: "No contacts found" }))
      .not.toBeInTheDocument();
  });

  it("renders a loading skeleton for the desktop list content", async () => {
    const screen = await render(<LoadingContent />);

    await expect
      .poll(() => screen.container.querySelector('[data-slot="skeleton"]'))
      .not.toBeNull();
  });

  it("shows the bulk tag button only after selecting contacts", async () => {
    const screen = await render(<BulkTagDesktop />);

    await expect
      .element(screen.getByRole("button", { name: /^tag$/i }))
      .not.toBeInTheDocument();

    await expect
      .poll(() => getSelectionCheckboxes(screen.container).length)
      .toBe(2);

    const [selectionCheckbox] = getSelectionCheckboxes(screen.container);
    await selectionCheckbox.click();

    await expect
      .element(screen.getByRole("button", { name: /^tag$/i }))
      .toBeVisible();
  });

  it("adds an existing tag to selected contacts without duplicating it", async () => {
    const screen = await render(<BulkTagDesktop />);

    await expect
      .poll(() => getSelectionCheckboxes(screen.container).length)
      .toBe(2);

    const checkboxes = getSelectionCheckboxes(screen.container);
    await checkboxes[0].click();
    await checkboxes[1].click();

    await screen.getByRole("button", { name: /^tag$/i }).click();
    await screen.getByRole("button", { name: "VIP" }).click();

    await expect
      .element(screen.getByText("Tag added to 1 contact"))
      .toBeInTheDocument();
    await expect
      .poll(() => screen.getByText("VIP").all().length)
      .toBeGreaterThanOrEqual(2);
  });

  it("creates a new tag inline and applies it to the full selected list", async () => {
    const screen = await render(<BulkCreateTagDesktop />);

    await expect
      .poll(() => getSelectionCheckboxes(screen.container).length)
      .toBeGreaterThan(0);

    const [selectionCheckbox] = getSelectionCheckboxes(screen.container);
    await selectionCheckbox.click();
    await screen.getByRole("button", { name: /select all/i }).click();

    await screen.getByRole("button", { name: /^tag$/i }).click();
    await screen.getByRole("button", { name: /create new tag/i }).click();

    await expect
      .element(
        screen.getByText(
          "Create a new tag and apply it to the selected contacts.",
        ),
      )
      .toBeVisible();

    await screen.getByLabelText("Tag name").fill("Prospect");
    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect
      .element(screen.getByText("Tag added to 30 contacts"))
      .toBeInTheDocument();
    await expect.element(screen.getByText("Prospect").first()).toBeVisible();
    await expect
      .element(screen.getByText("Add tag to contacts"))
      .not.toBeInTheDocument();
  });

  it("renders the mobile error state when loading contacts fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    try {
      const screen = await render(<ErrorMobile />);

      await expect
        .element(screen.getByText("Error loading contacts"))
        .toBeVisible();
      await expect
        .element(screen.getByRole("button", { name: /retry/i }))
        .toBeVisible();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("retries successfully in the mobile error state", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    try {
      const screen = await render(<ErrorMobile />);

      await screen.getByRole("button", { name: /retry/i }).click();

      await expect.element(screen.getByText("Ada Lovelace")).toBeVisible();
      await expect
        .element(screen.getByText("Error loading contacts"))
        .not.toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });
});
