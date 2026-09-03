import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import {
  buildApplication,
  buildDeal,
  buildReviewTask,
  buildTestCrm,
} from "./actionDestinationTestFixtures";

// Task-as-action-launcher repair pass: found via real human Auth acceptance
// testing against the linked project — clicking "Review Application:
// SalesId Verify" on the real Dashboard did nothing (the type label was
// plain text), and the only real link (the Contact's name) took the
// reviewer to the Contact page, never the Application where the actual
// review happens.
describe("Task action destination — the real SalesId Verify case", () => {
  it("clicking 'Review Application:' opens the specific Application's review page, not the Contact page", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm({
      deals: [buildDeal()],
      applications: [buildApplication()],
      tasks: [buildReviewTask()],
    });
    const screen = await render(element);

    // The action link's own accessible name is just the type label — the
    // Contact's name is a separate, adjacent link (see
    // Task.contactLinkSeparate.test.tsx), not part of this one.
    const actionLink = screen.getByRole("link", {
      name: "Review Application:",
    });
    await expect.element(actionLink).toBeInTheDocument();
    await actionLink.click();

    // The Application review screen — its Approve/Needs Higher Care/Not
    // Fit/Do Not Engage actions (ApplicationReviewActions.tsx) only render
    // here, never on the Contact page. This is the definitive proof: only
    // ApplicationShow has this button at all (ApplicationShow.tsx also
    // titles itself by the applicant's name, same as ContactShow does, so
    // that alone isn't a distinguishing signal — this button is).
    await expect
      .element(screen.getByRole("button", { name: "Approve" }))
      .toBeInTheDocument();
  });
});
