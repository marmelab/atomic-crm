import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { FirstStep } from "./DashboardStepper.stories";

// The test viewport is narrower than the mobile breakpoint, so the desktop
// branch of the stepper is only reachable by driving the hook itself.
const mockIsMobile = vi.hoisted(() => vi.fn(() => false));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: mockIsMobile }));

describe("DashboardStepper", () => {
  beforeEach(() => {
    mockIsMobile.mockReturnValue(false);
  });

  it("opens the data import dialog from the onboarding header", async () => {
    const screen = await render(<FirstStep />);

    await expect
      .element(screen.getByRole("heading", { name: "What's next?" }))
      .toBeVisible();

    await screen.getByRole("button", { name: "Import data" }).click();

    await expect.element(screen.getByLabelText("Resource")).toBeVisible();
  });

  it("links to the contact creation page on desktop", async () => {
    const screen = await render(<FirstStep />);

    // A plain link, as CreateButton renders one: an anchor given role="button"
    // is announced as a button but does not answer to Space
    await expect
      .element(screen.getByRole("link", { name: "Add contact" }))
      .toHaveAttribute("href", "/contacts/create");
  });

  it("shows the add note link as disabled while no contact exists", async () => {
    // Arrange: at step 1 the stepper disables "Add note".
    const screen = await render(<FirstStep />);
    const addNote = screen.getByRole("link", { name: "Add note" });
    await expect.element(addNote).toBeVisible();

    // Assert: it is announced as disabled, and it also LOOKS disabled. A link
    // has no native disabled state, so both are set by hand.
    await expect.element(addNote).toHaveAttribute("aria-disabled", "true");
    const style = getComputedStyle(addNote.element());
    expect(style.pointerEvents).toBe("none");
    expect(Number(style.opacity)).toBeLessThan(1);
  });

  it("opens the contact creation sheet on mobile", async () => {
    mockIsMobile.mockReturnValue(true);
    const screen = await render(<FirstStep />);

    await screen.getByRole("button", { name: "Add contact" }).click();

    await expect
      .element(screen.getByRole("heading", { name: "New Contact" }))
      .toBeVisible();
  });
});
