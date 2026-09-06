import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { buildDeal, buildTestCrm } from "./actionDestinationTestFixtures";
import type { Task } from "../types";

// Contracts + Onboarding slice, human-acceptance repair: an onboarding_item
// Task's own `text` ("Send contract to Jane Doe") IS its human-facing
// label — the generic "{Type label}: {Contact name}" composition every
// other task type uses ("Onboarding: SalesId Verify" here) would be
// actively worse, since every onboarding Task for one Enrollment shares
// the exact same type label. Never the raw internal type identifier
// ("onboarding_item") either.
describe("Task — onboarding_item human-facing label", () => {
  it("shows the actionable task text on the Dashboard, not the generic type+contact composition or the raw type identifier", async () => {
    await page.viewport(1280, 900);
    const onboardingTask: Task = {
      id: 2000,
      contact_id: 1,
      type: "onboarding_item",
      text: "Send contract to SalesId Verify",
      due_date: "2026-01-01T00:00:00.000Z",
      done_date: null,
      status: "pending",
      sales_id: 0,
      enrollment_id: 1,
      onboarding_item_id: 1,
    };
    const { element } = buildTestCrm({
      deals: [buildDeal({ stage: "won" })],
      tasks: [onboardingTask],
    });
    const screen = await render(element);

    await expect
      .element(screen.getByText("Send contract to SalesId Verify"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("onboarding_item"))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByText("Onboarding: SalesId Verify"))
      .not.toBeInTheDocument();
    // No redundant separate Contact-name link — the text already names them.
    await expect
      .element(
        screen.getByText("Send contract to SalesId VerifySalesId Verify"),
      )
      .not.toBeInTheDocument();
  });

  it("an unrelated task type is unaffected — still shows the type/contact composition", async () => {
    await page.viewport(1280, 900);
    const followUpTask: Task = {
      id: 2001,
      contact_id: 1,
      type: "follow_up",
      text: "",
      due_date: "2026-01-01T00:00:00.000Z",
      done_date: null,
      status: "pending",
      sales_id: 0,
    };
    const { element } = buildTestCrm({
      deals: [buildDeal({ stage: "call_booked" })],
      tasks: [followUpTask],
    });
    const screen = await render(element);

    await expect
      .element(screen.getByText("Follow-up: SalesId Verify"))
      .toBeInTheDocument();
  });
});
