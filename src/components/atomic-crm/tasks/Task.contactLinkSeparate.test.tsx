import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import {
  buildApplication,
  buildDeal,
  buildReviewTask,
  buildTestCrm,
} from "./actionDestinationTestFixtures";

// The Contact name stays its own separate link to the Contact page — the
// task-as-action-launcher fix deliberately does not make the whole title
// one ambiguous link across multiple destinations.
describe("Task action destination — Contact link stays separate from the action link", () => {
  it("clicking the Contact's name opens the Contact page, not the Application review screen", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm({
      deals: [buildDeal()],
      applications: [buildApplication()],
      tasks: [buildReviewTask()],
    });
    const screen = await render(element);

    const contactLink = screen.getByRole("link", { name: "SalesId Verify" });
    await expect.element(contactLink).toBeInTheDocument();
    await contactLink.click();

    await expect
      .element(screen.getByRole("button", { name: "Approve" }))
      .not.toBeInTheDocument();
  });
});
