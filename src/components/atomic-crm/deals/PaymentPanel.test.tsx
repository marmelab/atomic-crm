import { render } from "vitest-browser-react";

import { StoryWrapper } from "@/test/StoryWrapper";
import { PaymentPanel } from "./PaymentPanel";
import type { Deal, DealPaymentScheduleItem } from "../types";

// The panel is where payment truth actually reaches Leif, so the states
// that used to be wrong are checked as rendered output, not as return
// values: a fully paid client must not be asked to create a payment plan,
// and an uncertain one must not be told anything at all confidently.

const deal = (overrides: Partial<Deal> = {}): Deal =>
  ({
    id: 1,
    name: "Opportunity",
    contact_id: 10,
    offer_id: 1,
    stage: "won",
    amount: 4000,
    offer_price_snapshot: 4000,
    sales_id: 1,
    index: 0,
    stage_entered_at: "2026-05-01T00:00:00Z",
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    ...overrides,
  }) as Deal;

const paidItem = (
  overrides: Partial<DealPaymentScheduleItem> = {},
): DealPaymentScheduleItem =>
  ({
    id: 1,
    deal_id: 1,
    amount: 4000,
    sequence: 1,
    status: "paid",
    source: "stripe",
    stripe_payment_intent_id: "pi_1",
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    ...overrides,
  }) as DealPaymentScheduleItem;

const show = (
  deals: Deal[],
  deal_payment_schedule_items: DealPaymentScheduleItem[],
) =>
  render(
    <StoryWrapper data={{ deals, deal_payment_schedule_items }}>
      <PaymentPanel opportunityId={1} contactId={10} />
    </StoryWrapper>,
  );

describe("PaymentPanel", () => {
  it("shows a one-time payment as paid in full, not as setup pending", async () => {
    // Arrange — Emily Loeb: $3,700 in a single payment, no subscription.
    const screen = await show(
      [deal({ selected_payment_total: 3700 })],
      [paidItem({ amount: 3700, paid_on: "2026-07-16" })],
    );

    // Assert
    await expect.element(screen.getByText("Paid in full")).toBeVisible();
    expect(screen.container.textContent).not.toContain("Create payment plan");
  });

  it("shows how far through a plan somebody is when no live subscription exists", async () => {
    // Arrange — Jules Litman-Cleper: 4 of 6 collected, schedule completed.
    const items = [1, 2, 3, 4].map((n) =>
      paidItem({
        id: n,
        sequence: n,
        amount: 666,
        stripe_payment_intent_id: `pi_${n}`,
      }),
    );
    const screen = await show(
      [
        deal({
          selected_payment_total: 3996,
          selected_installment_count: 6,
        }),
      ],
      items,
    );

    // Assert
    await expect.element(screen.getByText("Active payment plan")).toBeVisible();
    expect(screen.container.textContent).toContain("4 of 6 installments paid");
    expect(screen.container.textContent).toContain("$1,332.00 remaining");
  });

  it("states uncertainty and offers a way to close it, instead of asserting a state", async () => {
    // Arrange — Mia Cosme: money scattered across Customer objects the CRM
    // is not linked to.
    const screen = await show(
      [
        deal({
          payment_review_reason:
            "Payments sit across four different Stripe Customer objects.",
        }),
      ],
      [paidItem({ amount: 925 })],
    );

    // Assert
    await expect
      .element(screen.getByText("Payment status needs review"))
      .toBeVisible();
    expect(screen.container.textContent).toContain(
      "four different Stripe Customer objects",
    );
    await expect
      .element(screen.getByRole("button", { name: "Mark reviewed" }))
      .toBeVisible();
  });

  it("asks for a payment plan only when there is genuinely nothing and no doubt", async () => {
    // Arrange — Emma Wijns.
    const screen = await show([deal()], []);

    // Assert
    await expect
      .element(screen.getByText("Payment setup pending"))
      .toBeVisible();
    expect(screen.container.textContent).toContain("Create payment plan");
  });
});
