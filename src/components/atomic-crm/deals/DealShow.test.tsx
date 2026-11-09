import { render } from "vitest-browser-react";

import { ClosingDate } from "./DealShow.stories";

describe("DealShow", () => {
  it("flags a past closing date", async () => {
    const screen = await render(
      <ClosingDate expectedClosingDate="2020-01-15" />,
    );

    await expect.element(screen.getByText("Acme deal")).toBeVisible();
    await expect.element(screen.getByText("Jan 15, 2020")).toBeVisible();
    await expect.element(screen.getByText("Past")).toBeVisible();
  });

  it("shows an out-of-range closing date as invalid instead of crashing", async () => {
    const screen = await render(
      <ClosingDate expectedClosingDate="20250-12-31" />,
    );

    await expect.element(screen.getByText("Invalid date")).toBeVisible();
    await expect.element(screen.getByText("Past")).not.toBeInTheDocument();
  });

  it("says when a deal has no closing date", async () => {
    const screen = await render(<ClosingDate expectedClosingDate={null} />);

    await expect.element(screen.getByText("No closing date")).toBeVisible();
    await expect.element(screen.getByText("Past")).not.toBeInTheDocument();
  });
});
