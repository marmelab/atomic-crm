import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { CreateForm } from "./DealInputs.stories";

describe("DealInputs", () => {
  beforeAll(() => {
    page.viewport(1600, 900);
  });

  it("creates a contact missing from the list and selects it", async () => {
    const screen = await render(<CreateForm />);

    // pick the company first: the contact created from this form should inherit it
    await screen.getByRole("combobox", { name: /company/i }).click();
    await screen.getByRole("option", { name: /Smith Corp/ }).click();

    const contactInput = screen.getByPlaceholder("Search");
    await contactInput.click();
    await userEvent.type(contactInput, "Grace Hopper");

    // no contact matches, so creating one is the only option left
    await screen.getByRole("option", { name: /Create Grace Hopper/ }).click();

    // the creation form opens, prefilled from what was typed and from the deal
    const sheet = screen.getByRole("dialog");
    await expect
      .element(sheet.getByLabelText(/first name/i))
      .toHaveValue("Grace");
    await expect
      .element(sheet.getByLabelText(/last name/i))
      .toHaveValue("Hopper");
    await expect
      .element(sheet.getByRole("combobox", { name: /company/i }))
      .toHaveTextContent("Smith Corp");

    await sheet.getByRole("button", { name: /^save$/i }).click();

    // back on the deal form, the new contact is selected
    await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
    await expect.element(screen.getByText("Grace Hopper")).toBeInTheDocument();
  });

  it("does not offer to create a contact before anything is typed", async () => {
    const screen = await render(<CreateForm />);

    await screen.getByPlaceholder("Search").click();

    // the hint is shown instead, and cannot be selected
    const hint = screen.getByRole("option", {
      name: /Start typing to create a new contact/,
    });
    await expect.element(hint).toHaveAttribute("aria-disabled", "true");
  });
});
