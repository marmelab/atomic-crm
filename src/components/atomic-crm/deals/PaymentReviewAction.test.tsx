import { render } from "vitest-browser-react";

import { StoryWrapper } from "@/test/StoryWrapper";
import { PaymentPanel } from "./PaymentPanel";
import type { Deal, DealPaymentScheduleItem } from "../types";

// What the panel offers, and what happens when it is used.
//
// The Opportunity page and the Client page render THIS component, so
// there is one review action and the two cannot disagree — which is why
// these render the panel rather than a page.

const deal = (over: Partial<Deal> = {}): Deal =>
  ({
    id: 1,
    name: "Zz Payment",
    contact_id: 10,
    offer_id: 1,
    stage: "won",
    outcome: null,
    archived_at: null,
    amount: 4000,
    offer_price_snapshot: 4000,
    offer_name_snapshot: "The Living Example",
    sales_id: 0,
    index: 0,
    pricing_mode: "standard",
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    stage_entered_at: "2026-05-01T00:00:00Z",
    ...over,
  }) as Deal;

const show = (
  deals: Deal[],
  deal_payment_schedule_items: DealPaymentScheduleItem[] = [],
) =>
  render(
    <StoryWrapper data={{ deals, deal_payment_schedule_items }}>
      <PaymentPanel opportunityId={1} contactId={10} />
    </StoryWrapper>,
  );

describe("an Opportunity whose agreed total nobody recorded", () => {
  it("says so, and offers the number rather than an acknowledgement", async () => {
    // Arrange — Emma's shape: Won, no agreed total, nothing collected.
    const screen = await show([deal()]);

    // Assert
    await expect
      .element(screen.getByText("Payment status needs review"))
      .toBeVisible();
    await expect
      .element(
        screen.getByText("No agreed total is recorded for this Opportunity."),
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Record agreed terms" }))
      .toBeVisible();
    // The button that could never work is not offered.
    await expect
      .element(screen.getByRole("button", { name: "Mark reviewed" }))
      .not.toBeInTheDocument();
  });

  it("clears for good once the total is recorded", async () => {
    // Arrange
    const screen = await show([deal()]);

    // Act — open the form, state the number, save.
    await screen.getByRole("button", { name: "Record agreed terms" }).click();
    await screen.getByLabelText("Agreed total").fill("4000");
    await screen.getByLabelText("Installments (optional)").fill("4");
    await screen.getByRole("button", { name: "Save agreed terms" }).click();

    // Assert — the warning is gone because the fact arrived, and it is
    // the arrangement that is now described.
    await expect
      .element(screen.getByText("Payment status needs review"))
      .not.toBeInTheDocument();
    await expect
      .element(
        screen.getByText("No agreed total is recorded for this Opportunity."),
      )
      .not.toBeInTheDocument();
  });

  it("refuses a total that is not a number", async () => {
    const screen = await show([deal()]);

    await screen.getByRole("button", { name: "Record agreed terms" }).click();
    await screen.getByLabelText("Agreed total").fill("soon");
    await screen.getByRole("button", { name: "Save agreed terms" }).click();

    // Still unresolved, because nothing usable was said.
    await expect
      .element(screen.getByText("Payment status needs review"))
      .toBeVisible();
  });
});

describe("an Opportunity whose terms are known", () => {
  it("shows no review at all", async () => {
    const screen = await show([
      deal({
        selected_payment_total: 4000,
        selected_payment_total_source: "stripe_derived",
        selected_installment_count: 4,
        selected_installment_amount: 1000,
      } as Partial<Deal>),
    ]);

    await expect
      .element(screen.getByText("Payment status needs review"))
      .not.toBeInTheDocument();
  });

  it("offers Mark reviewed for a question a human raised", async () => {
    const screen = await show([
      deal({
        selected_payment_total: 4000,
        payment_review_reason: "Leif flagged this to look at.",
        payment_review_code: "owner_flagged",
      } as Partial<Deal>),
    ]);

    await expect
      .element(screen.getByRole("button", { name: "Mark reviewed" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Record agreed terms" }))
      .not.toBeInTheDocument();
  });
});
