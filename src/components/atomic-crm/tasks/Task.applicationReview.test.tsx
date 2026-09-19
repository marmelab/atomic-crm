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

// The production defect Leif hit: Dashboard -> Review Application opened
// the generic Edit Task modal.
//
// The resolver looked the Application up by Contact and filtered on
// source = "public_form". Every Application in this database is a
// recovered historical_import, so it matched nothing, found no target and
// fell through to task-detail — a Description/Due date/Type form instead
// of the application the Task exists because of.
//
// A review Task names its Application outright now, so there is nothing to
// resolve and nothing to guess.
describe("Task action destination — a recovered Application", () => {
  it("opens the Application even though it is not a public_form submission", async () => {
    // Arrange — exactly the production shape.
    await page.viewport(1280, 900);
    const { element } = buildTestCrm({
      deals: [buildDeal()],
      applications: [
        buildApplication({ id: 182, source: "historical_import" }),
      ],
      tasks: [buildReviewTask({ application_id: 182 })],
    });
    const screen = await render(element);

    // Act
    const actionLink = screen.getByRole("link", {
      name: "Review Application:",
    });
    await actionLink.click();

    // Assert — the Application's own review page, never the Task editor.
    await expect
      .element(screen.getByText("Application Answers"))
      .toBeInTheDocument();
    expect(screen.container.textContent).not.toContain("Edit Task");
  });

  it("opens the exact Application the Task names, not the newest one", async () => {
    // Arrange — Dax Kara's shape: two Applications for one Contact, and
    // the Task means the older of them. "Newest for this Contact" would
    // pick the wrong one.
    await page.viewport(1280, 900);
    const { element } = buildTestCrm({
      deals: [buildDeal()],
      applications: [
        buildApplication({
          id: 41,
          source: "historical_import",
          raw_answers: { why_this_program: "The older submission." },
        }),
        buildApplication({
          id: 182,
          source: "historical_import",
          raw_answers: { why_this_program: "The newer submission." },
        }),
      ],
      tasks: [buildReviewTask({ application_id: 41 })],
    });
    const screen = await render(element);

    // Act
    await screen.getByRole("link", { name: "Review Application:" }).click();

    // Assert
    await expect
      .element(screen.getByText("Application Answers"))
      .toBeInTheDocument();
    // The older submission's own content, so "newest for this Contact"
    // would visibly fail here.
    await expect
      .element(screen.getByText("The older submission."))
      .toBeInTheDocument();
    expect(screen.container.textContent).not.toContain("The newer submission.");
  });
});
