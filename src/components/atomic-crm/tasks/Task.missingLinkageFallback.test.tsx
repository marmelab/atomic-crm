import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { buildReviewTask, buildTestCrm } from "./actionDestinationTestFixtures";

// A Task whose Contact has no Deal at all (deleted, or never created) has
// nothing real to resolve — the fallback must open the Task's own edit
// view, never a dead link or a silently wrong destination.
describe("Task action destination — missing linkage falls back safely", () => {
  it("a review_application task whose Contact has no Deal falls back to opening the Task's own edit view", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm({
      tasks: [buildReviewTask()], // no deals, no applications seeded at all
    });
    const screen = await render(element);

    // The action button's own accessible name is just the type label —
    // the Contact's name is a separate, adjacent link.
    const actionButton = screen.getByRole("button", {
      name: "Review Application:",
    });
    await expect.element(actionButton).toBeInTheDocument();
    await actionButton.click();

    // TaskEdit opens (a real dialog) — proof the fallback launched the
    // Task's own detail view rather than silently doing nothing or
    // guessing a destination. Never the Application review screen.
    await expect.element(screen.getByRole("dialog")).toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: "Approve" }))
      .not.toBeInTheDocument();
  });
});
