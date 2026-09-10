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

  it("opens the contact creation sheet on mobile", async () => {
    mockIsMobile.mockReturnValue(true);
    const screen = await render(<FirstStep />);

    await screen.getByRole("button", { name: "Add contact" }).click();

    await expect
      .element(screen.getByRole("heading", { name: "New Contact" }))
      .toBeVisible();
  });
});
