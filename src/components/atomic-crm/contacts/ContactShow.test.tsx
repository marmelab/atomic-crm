import { render } from "vitest-browser-react";
import { MobileSuccess } from "./ContactShow.mobile.stories";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => true,
}));

describe("ContactShow", () => {
  it("renders a safe zero-task label before nb_tasks is available", async () => {
    const screen = await render(<MobileSuccess />);

    await expect
      .element(screen.getByRole("tab", { name: "0 tasks" }))
      .toBeVisible();
    await expect
      .poll(
        () => screen.container.textContent?.includes("%{smart_count}") ?? false,
      )
      .toBe(false);
    await expect
      .poll(() => screen.container.textContent?.includes("||||") ?? false)
      .toBe(false);
  });
});
