import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { FirstStep } from "./DashboardStepper.stories";

describe("DashboardStepper", () => {
  it("opens the data import dialog from the onboarding header", async () => {
    const screen = await render(<FirstStep />);

    await expect
      .element(screen.getByRole("heading", { name: "What's next?" }))
      .toBeVisible();

    await screen.getByRole("button", { name: "Import data" }).click();

    await expect.element(screen.getByLabelText("Resource")).toBeVisible();
  });
});
