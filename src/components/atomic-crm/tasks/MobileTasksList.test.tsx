import { render } from "vitest-browser-react";
import { buildContact, StoryWrapper } from "@/test/StoryWrapper";
import { MobileTasksList } from "./MobileTasksList";

// Manual Task UX repair: this global (cross-contact) mobile surface had
// NO way to create a Task at all — desktop's Dashboard already had this
// exact icon button next to its own header.
describe("MobileTasksList (Manual Task UX repair)", () => {
  it("H: exposes an Add Task control", async () => {
    const screen = await render(
      <StoryWrapper data={{ contacts: [buildContact({ id: 1 })] }}>
        <MobileTasksList />
      </StoryWrapper>,
    );

    await expect
      .element(screen.getByRole("button", { name: "Create task" }))
      .toBeVisible();
  });

  it("I: allows selecting a Contact (no single Contact context here, unlike Client/Contact pages)", async () => {
    const screen = await render(
      <StoryWrapper
        data={{
          contacts: [
            buildContact({ id: 1, first_name: "Maya", last_name: "Chen" }),
          ],
        }}
      >
        <MobileTasksList />
      </StoryWrapper>,
    );

    await screen.getByRole("button", { name: "Create task" }).click();

    // selectContact renders a searchable Contact combobox — the same
    // AutocompleteInput desktop Dashboard's own AddTask already uses.
    // Scoped by name: the form also has Type/Status selects, which are
    // combobox-role too.
    const contactField = screen.getByRole("combobox", { name: /^Contact/ });
    await expect.element(contactField).toBeVisible();

    await contactField.click();
    await expect
      .element(screen.getByRole("option", { name: /Maya Chen/i }))
      .toBeVisible();
  });
});
