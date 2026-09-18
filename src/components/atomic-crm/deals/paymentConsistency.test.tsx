import { render } from "vitest-browser-react";

import { StoryWrapper } from "@/test/StoryWrapper";
import { PaymentPanel } from "./PaymentPanel";
import { presentPayment } from "./paymentPresentation";
import { assessPaymentTruth } from "./paymentTruth";
import { PAYMENT_CASES } from "./paymentTruth.fixtures";

// The proof that consolidation actually happened.
//
// Before this, ClientShow rendered two resolvers side by side and they
// disagreed: Jules Litman-Cleper read "settled · $0.00 outstanding" from
// one and "$666 remaining" from the other, on the same screen. Sam Milz
// was told his first $175 had been received by a formatter that had never
// seen a payment row.
//
// So every consumer is driven from the SAME fixtures, and what is asserted
// is that the numbers a person reads match the numbers the domain computed.

const withDeal = (c: (typeof PAYMENT_CASES)[number]) => ({
  deals: [c.deal],
  deal_payment_schedule_items: c.scheduleItems.map((item, index) => ({
    ...item,
    id: index + 1,
    deal_id: c.deal.id,
  })),
  deal_stripe_plan_objects: c.planObjects.map((object, index) => ({
    ...object,
    id: index + 1,
    deal_id: c.deal.id,
  })),
});

describe("every surface reads one payment truth", () => {
  for (const c of PAYMENT_CASES) {
    it(`agrees with the domain model — ${c.name}`, async () => {
      // Arrange — the domain's answer for this exact person.
      const truth = assessPaymentTruth({
        deal: c.deal,
        scheduleItems: c.scheduleItems,
        planObjects: c.planObjects,
      });

      // Act — the panel a human actually looks at.
      const screen = await render(
        <StoryWrapper data={withDeal(c)}>
          <PaymentPanel opportunityId={c.deal.id} contactId={10} />
        </StoryWrapper>,
      );
      // The panel resolves its own data, so wait for the headline the
      // domain model says it should show — which also asserts that it
      // shows that headline and not another.
      const expected = presentPayment(truth);
      await expect.element(screen.getByText(expected.headline)).toBeVisible();
      const shown = screen.container.textContent ?? "";

      // Assert — the money on screen is the money the model computed, and
      // nothing claims a receipt the model does not have.
      const money = (value: number) =>
        new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: "USD",
        }).format(value);

      if (truth.collected === 0) {
        expect(shown).not.toMatch(/received/i);
      }
      if (truth.paidInFull) {
        expect(shown).toContain("Paid in full");
      } else {
        expect(shown).not.toContain("Paid in full");
      }
      if (
        truth.remaining != null &&
        truth.remaining > 0 &&
        truth.collected > 0
      ) {
        expect(shown).toContain(money(truth.remaining));
      }
      if (
        truth.installmentProgressKnown &&
        truth.collected > 0 &&
        (truth.agreedInstallmentCount ?? 0) > 1
      ) {
        expect(shown).toContain(
          `${truth.installmentsSatisfied} of ${truth.agreedInstallmentCount} installments paid`,
        );
      }
    });
  }

  it("never prints the Offer list price as somebody's agreed total", async () => {
    // Arrange — Emily bought LE at $3,700; the import stamped $4,000 on
    // every LE Opportunity.
    const emily = PAYMENT_CASES.find((c) => c.name.startsWith("Emily"))!;

    // Act
    const screen = await render(
      <StoryWrapper data={withDeal(emily)}>
        <PaymentPanel opportunityId={emily.deal.id} contactId={10} />
      </StoryWrapper>,
    );

    // Assert
    await expect.element(screen.getByText("Paid in full")).toBeVisible();
    expect(screen.container.textContent).not.toContain("$4,000.00");
  });
});
