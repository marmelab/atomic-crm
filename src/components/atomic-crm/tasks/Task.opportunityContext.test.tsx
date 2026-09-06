import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import {
  buildDeal,
  buildReviewTask,
  buildTestCrm,
} from "./actionDestinationTestFixtures";

// sales_call, follow_up, nurture_follow_up, check_payment,
// sales_call_cancelled all classify as "opportunity-context" — the real
// screen that already exists for "go work this Opportunity" today is
// DealShow (/deals/:id/show), confirmed against current code (embeds both
// DealSalesCallSection and DealApplicationAndEnrollment), not invented.
// send_contract/complete_access used to live here too — retired
// (Contracts + Onboarding slice) in favor of onboarding_item, which
// resolves deterministically to enrollment-context instead — see
// taskActionDestination.test.ts.
describe("Task action destination — opportunity-context task types", () => {
  it("a Sales Call task opens the relevant Deal, not a dead link", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm({
      deals: [buildDeal({ stage: "call_booked" })],
      tasks: [
        buildReviewTask({
          id: 1001,
          type: "sales_call",
          text: "Sales call with SalesId Verify",
        }),
      ],
    });
    const screen = await render(element);

    // The action link's own accessible name is just the type label — the
    // Contact's name is a separate, adjacent link.
    const actionLink = screen.getByRole("link", { name: "Sales Call:" });
    await expect.element(actionLink).toBeInTheDocument();
    await actionLink.click();

    // DealShow opens as a dialog.
    await expect.element(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
