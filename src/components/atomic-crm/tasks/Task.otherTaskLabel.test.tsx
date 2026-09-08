import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { buildDeal, buildTestCrm } from "./actionDestinationTestFixtures";
import type { Task } from "../types";

// Manual Task UX repair, round 2 (§3): human acceptance found a
// manually-created `other` Task rendering as bare "Other: SalesId
// Verify" on the Dashboard — the actual instruction Leif wrote was
// invisible without opening the Task. Distinct from onboarding_item's
// own SELF_DESCRIBING treatment (Task.onboardingItemLabel.test.tsx):
// this is Leif's own free text, which usually doesn't name anyone, so
// the Contact still needs to stay visible — as its own line, not folded
// into the title.
describe("Task — `other` human-facing label (Manual Task UX repair, round 2)", () => {
  it("K/L: shows the free-text instruction prominently, with the Contact still visible as its own line", async () => {
    await page.viewport(1280, 900);
    const otherTask: Task = {
      id: 2000,
      contact_id: 1,
      type: "other",
      text: "Check in about GYU attendance",
      due_date: "2026-01-01T00:00:00.000Z",
      done_date: null,
      status: "pending",
      sales_id: 0,
    };
    const { element } = buildTestCrm({
      deals: [buildDeal()],
      tasks: [otherTask],
    });
    const screen = await render(element);

    // The actual instruction is the primary, visible label — not hidden
    // behind opening the Task.
    await expect
      .element(screen.getByText("Check in about GYU attendance"))
      .toBeInTheDocument();
    // Never the bare, meaningless type label alone.
    await expect.element(screen.getByText("Other")).not.toBeInTheDocument();
    await expect
      .element(screen.getByText("Other: SalesId Verify"))
      .not.toBeInTheDocument();
    // The person it's about stays visible on the Dashboard (showContact) —
    // as its own line, unlike onboarding_item's suppressed Contact suffix.
    await expect
      .element(screen.getByText("SalesId Verify"))
      .toBeInTheDocument();
  });

  it("M: an unrelated, specialized task type is unaffected — still shows its own type + Contact composition", async () => {
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

  it("M: onboarding_item's own SELF_DESCRIBING treatment is unaffected", async () => {
    await page.viewport(1280, 900);
    const onboardingTask: Task = {
      id: 2002,
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
    // No redundant separate Contact-name line — the text already names
    // them, unlike `other`'s own new behavior above.
    await expect
      .element(
        screen.getByText("Send contract to SalesId VerifySalesId Verify"),
      )
      .not.toBeInTheDocument();
  });
});
