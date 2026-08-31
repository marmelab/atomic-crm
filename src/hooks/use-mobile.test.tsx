import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { useIsMobile } from "./use-mobile";

// Routing/shell regression (Programs + Opportunity UX Chaos Monkey pass):
// CRM.tsx renders an entirely different Resource/route set depending on
// this hook's value, so it must correctly track the viewport both on
// initial mount AND after a later resize — getting stuck strands the user
// on the wrong shell with no way back short of a hard reload at the right
// width. See use-mobile.ts for the failure mode this guards against.
const Probe = () => {
  const isMobile = useIsMobile();
  return <div data-testid="probe">{isMobile ? "mobile" : "desktop"}</div>;
};

describe("useIsMobile", () => {
  it("reflects a narrow viewport on initial mount", async () => {
    await page.viewport(375, 800);
    const screen = await render(<Probe />);
    await expect
      .element(screen.getByTestId("probe"))
      .toHaveTextContent("mobile");
  });

  it("reflects a wide viewport on initial mount", async () => {
    await page.viewport(1280, 800);
    const screen = await render(<Probe />);
    await expect
      .element(screen.getByTestId("probe"))
      .toHaveTextContent("desktop");
  });

  it("recovers to desktop after resizing wide, without a reload", async () => {
    await page.viewport(700, 800);
    const screen = await render(<Probe />);
    await expect
      .element(screen.getByTestId("probe"))
      .toHaveTextContent("mobile");

    await page.viewport(1280, 800);
    await expect
      .element(screen.getByTestId("probe"))
      .toHaveTextContent("desktop");
  });

  it("switches back to mobile after resizing narrow again", async () => {
    await page.viewport(1280, 800);
    const screen = await render(<Probe />);
    await expect
      .element(screen.getByTestId("probe"))
      .toHaveTextContent("desktop");

    await page.viewport(400, 800);
    await expect
      .element(screen.getByTestId("probe"))
      .toHaveTextContent("mobile");
  });
});
