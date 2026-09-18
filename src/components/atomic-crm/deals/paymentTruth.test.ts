import { describe, expect, test } from "vitest";

import { assessPaymentTruth } from "./paymentTruth";
import { presentPayment } from "./paymentPresentation";
import {
  makeDeal,
  paid,
  plan,
  scheduled,
  PAYMENT_CASES,
} from "./paymentTruth.fixtures";

const assess = (c: (typeof PAYMENT_CASES)[number]) =>
  assessPaymentTruth({
    deal: c.deal,
    scheduleItems: c.scheduleItems,
    planObjects: c.planObjects,
  });

describe("payment truth — the eight people the model got wrong", () => {
  for (const c of PAYMENT_CASES) {
    test(c.name, () => {
      const truth = assess(c);

      expect(truth.agreedTotal).toBe(c.expect.agreedTotal);
      expect(truth.collected).toBe(c.expect.collected);
      expect(truth.futureScheduled).toBe(c.expect.futureScheduled);
      expect(truth.remaining).toBe(c.expect.remaining);
      expect(truth.installmentsSatisfied).toBe(c.expect.installmentsSatisfied);
      expect(truth.paidInFull).toBe(c.expect.paidInFull);
      expect(truth.paymentSetupComplete).toBe(c.expect.paymentSetupComplete);
      expect(truth.state).toBe(c.expect.state);
    });
  }

  test("Sam is never told a payment was received", () => {
    // Arrange — the exact defect: a plan of 4 x $175 and no money.
    const sam = PAYMENT_CASES[0];

    // Act
    const shown = presentPayment(assess(sam));
    const text = [shown.headline, ...shown.detail, shown.outstanding].join(" ");

    // Assert
    expect(text).not.toMatch(/received/i);
    expect(text).toContain("$0.00 paid");
  });

  test("Jules is never called settled because every row is paid", () => {
    // Arrange — five paid rows, six agreed installments.
    const jules = PAYMENT_CASES.find((c) => c.name.startsWith("Jules"))!;

    // Act
    const truth = assess(jules);
    const shown = presentPayment(truth);

    // Assert
    expect(truth.paidInFull).toBe(false);
    expect(shown.outstanding).toBe("$666.00 remaining");
    expect(shown.detail).toContain("5 of 6 installments paid");
  });
});

describe("what is not money", () => {
  const won = makeDeal({ selected_payment_total: 1000 });

  test("a scheduled obligation is not collected money", () => {
    const truth = assessPaymentTruth({
      deal: won,
      scheduleItems: [scheduled(1000)],
      planObjects: [],
    });
    expect(truth.collected).toBe(0);
    expect(truth.futureScheduled).toBe(1000);
    expect(truth.paidInFull).toBe(false);
  });

  test("a scheduled obligation a payment has discharged is no longer future money", () => {
    // One PaymentIntent may satisfy several obligations, so the link is
    // recorded on the obligation rather than the other way round.
    const truth = assessPaymentTruth({
      deal: won,
      scheduleItems: [
        scheduled(1000, { satisfied_by_payment_intent_id: "pi_x" }),
        paid(1000, { stripe_payment_intent_id: "pi_x" }),
      ],
      planObjects: [],
    });
    expect(truth.futureScheduled).toBe(0);
    // And the receipt is still counted exactly once.
    expect(truth.collected).toBe(1000);
  });

  test("a live subscription is not collected money", () => {
    const truth = assessPaymentTruth({
      deal: won,
      scheduleItems: [],
      planObjects: [plan({ status: "active", is_current: true })],
    });
    expect(truth.collected).toBe(0);
    expect(truth.paidInFull).toBe(false);
    // It IS an arrangement, though.
    expect(truth.paymentSetupComplete).toBe(true);
  });

  test("installment terms alone are not collected money", () => {
    const truth = assessPaymentTruth({
      deal: makeDeal({
        selected_payment_total: 700,
        selected_installment_count: 4,
        selected_installment_amount: 175,
      }),
      scheduleItems: [],
      planObjects: [],
    });
    expect(truth.collected).toBe(0);
    expect(truth.installmentsSatisfied).toBe(0);
  });
});

describe("agreed terms come from the Deal, never the Offer", () => {
  test("a historical price is not replaced by today's list price", () => {
    // Emily bought LE at $3,700; the import stamped $4,000 on every LE row.
    const truth = assessPaymentTruth({
      deal: makeDeal({
        selected_payment_total: 3700,
        offer_price_snapshot: 4000,
      }),
      scheduleItems: [paid(3700)],
      planObjects: [],
    });
    expect(truth.agreedTotal).toBe(3700);
    expect(truth.paidInFull).toBe(true);
  });

  test("a sold Opportunity with no recorded terms needs review, not a list price", () => {
    const truth = assessPaymentTruth({
      deal: makeDeal({
        selected_payment_total: null,
        offer_price_snapshot: 4000,
      }),
      scheduleItems: [paid(1000)],
      planObjects: [],
    });
    expect(truth.agreedTotal).toBeNull();
    expect(truth.termsKnown).toBe(false);
    expect(truth.remaining).toBeNull();
    expect(truth.state).toBe("needs_review");
    expect(truth.reviewCode).toBe("terms_unknown");
  });
});

describe("installment progress", () => {
  const sixHundredSixtySix = makeDeal({
    selected_payment_total: 3996,
    selected_installment_count: 6,
    selected_installment_amount: 666,
  });

  test("a partial installment does not round up", () => {
    // $600 toward a $1,000 installment is no installments.
    const truth = assessPaymentTruth({
      deal: makeDeal({
        selected_payment_total: 4000,
        selected_installment_count: 4,
        selected_installment_amount: 1000,
      }),
      scheduleItems: [paid(600)],
      planObjects: [],
    });
    expect(truth.installmentsSatisfied).toBe(0);
  });

  test("cents do not lose an installment that was actually paid", () => {
    const truth = assessPaymentTruth({
      deal: sixHundredSixtySix,
      scheduleItems: [paid(666), paid(666)],
      planObjects: [],
    });
    expect(truth.installmentsSatisfied).toBe(2);
  });

  test("progress never exceeds what was agreed", () => {
    const truth = assessPaymentTruth({
      deal: sixHundredSixtySix,
      scheduleItems: Array.from({ length: 8 }, () => paid(666)),
      planObjects: [],
    });
    expect(truth.installmentsSatisfied).toBe(6);
  });

  test("no equal-installment terms means no fabricated X of Y", () => {
    const truth = assessPaymentTruth({
      deal: makeDeal({ selected_payment_total: 1400 }),
      scheduleItems: [paid(400)],
      planObjects: [],
    });
    expect(truth.installmentsSatisfied).toBeNull();
    expect(presentPayment(truth).detail).toContain("$400.00 collected");
  });
});

describe("payment setup is about an arrangement existing", () => {
  test("one stray historical payment with no live plan is not setup", () => {
    const truth = assessPaymentTruth({
      deal: makeDeal({ selected_payment_total: 4000 }),
      scheduleItems: [paid(500)],
      planObjects: [plan({ status: "canceled", is_current: false })],
    });
    expect(truth.paymentSetupComplete).toBe(false);
  });

  test("paid in full is setup complete", () => {
    const truth = assessPaymentTruth({
      deal: makeDeal({ selected_payment_total: 500 }),
      scheduleItems: [paid(500)],
      planObjects: [],
    });
    expect(truth.paymentSetupComplete).toBe(true);
  });

  test("a not-yet-started verified plan is setup complete", () => {
    const truth = assessPaymentTruth({
      deal: makeDeal({ selected_payment_total: 4000 }),
      scheduleItems: [],
      planObjects: [
        plan({
          object_type: "schedule",
          status: "not_started",
          is_current: true,
        }),
      ],
    });
    expect(truth.paymentSetupComplete).toBe(true);
  });

  test("an arrangement confirmed outside Stripe is setup complete", () => {
    const truth = assessPaymentTruth({
      deal: makeDeal({
        selected_payment_total: 4000,
        payment_setup_confirmed_at: "2026-09-18T00:00:00Z",
      }),
      scheduleItems: [],
      planObjects: [],
    });
    expect(truth.paymentSetupComplete).toBe(true);
  });

  test("a scheduled ledger row alone is NOT an arrangement", () => {
    // Terms Leif wrote down are not a payment processor holding a plan.
    const truth = assessPaymentTruth({
      deal: makeDeal({ selected_payment_total: 4000 }),
      scheduleItems: [scheduled(4000)],
      planObjects: [],
    });
    expect(truth.paymentSetupComplete).toBe(false);
  });
});
