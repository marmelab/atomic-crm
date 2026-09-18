import { describe, expect, test } from "vitest";
import type { DataProvider } from "ra-core";

import { assessPaymentStatus } from "./paymentStatus";
import type {
  Deal,
  DealPaymentScheduleItem,
  DealStripePlanObject,
} from "../types";

// These tests exist because the CRM told Leif that three clients who had
// paid him money owed him a payment plan. Each case below is one of those
// real situations, kept as a regression.

const makeDeal = (overrides: Partial<Deal> = {}): Deal =>
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

const makeItem = (
  overrides: Partial<DealPaymentScheduleItem> = {},
): DealPaymentScheduleItem =>
  ({
    id: 1,
    deal_id: 1,
    amount: 1000,
    sequence: 1,
    status: "paid",
    source: "stripe",
    stripe_payment_intent_id: "pi_test",
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    ...overrides,
  }) as DealPaymentScheduleItem;

const planObject = (
  overrides: Partial<DealStripePlanObject> = {},
): DealStripePlanObject =>
  ({
    id: 1,
    deal_id: 1,
    stripe_object_id: "sub_old",
    object_type: "subscription",
    status: "canceled",
    is_current: false,
    linked_at: "2026-05-01T00:00:00Z",
    link_source: "reconciliation",
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    ...overrides,
  }) as DealStripePlanObject;

const assess = (
  deal: Deal,
  items: DealPaymentScheduleItem[] = [],
  plans: DealStripePlanObject[] = [],
) =>
  assessPaymentStatus(
    {
      getOne: async () => ({ data: deal }),
      getList: async (resource: string) =>
        resource === "deal_stripe_plan_objects"
          ? { data: plans, total: plans.length }
          : { data: items, total: items.length },
    } as unknown as DataProvider,
    deal.id,
  );

describe("payment status — a missing plan is not a missing payment", () => {
  test("a single one-time payment covering the agreed total is paid in full", async () => {
    // Arrange — Emily Loeb: $3,700 settled in one PaymentIntent, which
    // creates no subscription and no schedule whatsoever.
    const deal = makeDeal({ selected_payment_total: 3700 });
    const items = [
      makeItem({ amount: 3700, paid_on: "2026-07-16", sequence: 1 }),
    ];

    // Act
    const status = await assess(deal, items);

    // Assert
    expect(status.state).toBe("paid_in_full");
    expect(status.outstanding).toBeNull();
  });

  test("installments paid behind a completed schedule are an active plan, not setup pending", async () => {
    // Arrange — Jules Litman-Cleper: 4 of 6 collected, and Stripe marks
    // his schedule "completed" and his subscription "canceled", so no live
    // arrangement is linked on the Opportunity at all.
    const deal = makeDeal({
      selected_payment_total: 3996,
      selected_installment_count: 6,
      stripe_subscription_id: null,
      stripe_subscription_schedule_id: null,
    });
    const items = [1, 2, 3, 4].map((n) =>
      makeItem({
        id: n,
        sequence: n,
        amount: 666,
        stripe_payment_intent_id: `pi_${n}`,
      }),
    );

    // Act
    const status = await assess(deal, items);

    // Assert
    expect(status.state).toBe("active_plan");
    expect(status.detail).toContain("4 of 6 installments paid");
    expect(status.outstanding).toBe("$1,332.00 remaining over 2 payments");
  });

  test("no saved payment method does not make a fully paid client unpaid", async () => {
    // Arrange — Jess Beauchamp: all four installments collected, then she
    // asked for her card to be removed. Nothing here records a card,
    // because whether one exists has no bearing on what was paid.
    const deal = makeDeal({
      selected_payment_total: 4000,
      selected_installment_count: 4,
    });
    const items = [1, 2, 3, 4].map((n) =>
      makeItem({
        id: n,
        sequence: n,
        amount: 1000,
        paid_on: "2026-08-01",
        stripe_payment_intent_id: `pi_${n}`,
      }),
    );

    // Act
    const status = await assess(deal, items);

    // Assert
    expect(status.state).toBe("paid_in_full");
    expect(status.outstanding).toBeNull();
  });

  test("a Won client with no payment and no doubt is setup pending", async () => {
    // Arrange — Emma Wijns: genuinely nothing in Stripe, genuinely owed.
    const deal = makeDeal();

    // Act
    const status = await assess(deal, []);

    // Assert
    expect(status.state).toBe("setup_pending");
    expect(status.outstanding).toBe("Create payment plan");
  });
});

describe("payment status — one agreement, several Stripe objects", () => {
  test("a replacement subscription continues the same plan instead of ending it", async () => {
    // Arrange — Jules Litman-Cleper: six payments of $666 agreed. His
    // first subscription was built with four cycles, so Stripe ended it
    // after payment four, and a replacement now carries the last two.
    const deal = makeDeal({
      selected_payment_total: 3996,
      selected_installment_count: 6,
      selected_installment_amount: 666,
      stripe_subscription_id: "sub_new",
    });
    const items = [1, 2, 3, 4].map((n) =>
      makeItem({
        id: n,
        sequence: n,
        amount: 666,
        stripe_payment_intent_id: `pi_${n}`,
      }),
    );
    const plans = [
      planObject({ id: 1, stripe_object_id: "sub_old", status: "canceled" }),
      planObject({
        id: 2,
        stripe_object_id: "sub_new",
        status: "active",
        is_current: true,
      }),
    ];

    // Act
    const status = await assess(deal, items, plans);

    // Assert — neither "paid in full" nor "setup pending".
    expect(status.state).toBe("active_plan");
    expect(status.detail).toContain(
      "Replacement Stripe subscription carrying the rest",
    );
    expect(status.outstanding).toBe("$1,332.00 remaining over 2 payments");
  });

  test("an ended subscription still counts the payments it collected", async () => {
    // Arrange — the same client before the replacement was created: every
    // Stripe plan object is finished, and four payments are still real.
    const deal = makeDeal({
      selected_payment_total: 3996,
      selected_installment_count: 6,
      selected_installment_amount: 666,
      stripe_subscription_id: null,
      stripe_subscription_schedule_id: null,
    });
    const items = [1, 2, 3, 4].map((n) =>
      makeItem({
        id: n,
        sequence: n,
        amount: 666,
        stripe_payment_intent_id: `pi_${n}`,
      }),
    );
    const plans = [
      planObject({ id: 1, stripe_object_id: "sub_old", status: "canceled" }),
      planObject({
        id: 2,
        stripe_object_id: "sched_old",
        object_type: "schedule",
        status: "completed",
      }),
    ];

    // Act
    const status = await assess(deal, items, plans);

    // Assert
    expect(status.state).toBe("active_plan");
    expect(status.collected).toBe(2664);
    expect(status.installmentsSatisfied).toBe(4);
  });
});

describe("payment status — transactions are not installments", () => {
  test("four installments satisfied by three transactions is paid in full", async () => {
    // Arrange — Jess Beauchamp: $1,000, then $2,000 covering two
    // installments, then $1,000.
    const deal = makeDeal({
      selected_payment_total: 4000,
      selected_installment_count: 4,
      selected_installment_amount: 1000,
    });
    const items = [
      makeItem({
        id: 1,
        sequence: 1,
        amount: 1000,
        stripe_payment_intent_id: "pi_1",
      }),
      makeItem({
        id: 2,
        sequence: 2,
        amount: 2000,
        stripe_payment_intent_id: "pi_2",
      }),
      makeItem({
        id: 3,
        sequence: 3,
        amount: 1000,
        stripe_payment_intent_id: "pi_3",
      }),
    ];

    // Act
    const status = await assess(deal, items);

    // Assert
    expect(status.state).toBe("paid_in_full");
    expect(status.installmentsSatisfied).toBe(4);
    expect(status.detail).toContain("4 of 4 installments paid");
    expect(status.detail).toContain("3 transactions");
  });

  test("one economic payment evidenced twice is counted once", async () => {
    // Arrange — Linda Turner: the owner-stated row that duplicated the
    // Stripe payment is voided, not deleted, so provenance survives and
    // the money does not double.
    const deal = makeDeal({ selected_payment_total: 4000 });
    const items = [
      makeItem({
        id: 1,
        sequence: 1,
        amount: 4000,
        status: "void",
        source: "owner_stated",
        stripe_payment_intent_id: null,
      }),
      makeItem({
        id: 2,
        sequence: 2,
        amount: 4000,
        stripe_payment_intent_id: "pi_linda",
      }),
    ];

    // Act
    const status = await assess(deal, items);

    // Assert
    expect(status.collected).toBe(4000);
    expect(status.state).toBe("paid_in_full");
  });
});

describe("payment status — where the agreed figure came from", () => {
  test("a Deal-specific total outranks the Offer list price", async () => {
    // Arrange — Emily Loeb and Mia Cosme bought LE at $3,700. Every
    // historical LE Opportunity carries today's $4,000 from the import.
    const deal = makeDeal({
      selected_payment_total: 3700,
      offer_price_snapshot: 4000,
    });

    // Act
    const status = await assess(deal, [makeItem({ amount: 3700 })]);

    // Assert
    expect(status.agreedTotal).toBe(3700);
    expect(status.agreedTotalSource).toBe("deal");
    expect(status.state).toBe("paid_in_full");
  });

  test("a list-price fallback is reported as a list price, not as agreed terms", async () => {
    // Arrange — no Deal-specific total recorded.
    const deal = makeDeal({ offer_price_snapshot: 4000 });

    // Act
    const status = await assess(deal, [makeItem({ amount: 1000 })]);

    // Assert
    expect(status.agreedTotalSource).toBe("offer_list_price");
  });
});

describe("payment status — uncertainty is not setup pending", () => {
  test("an open review outranks a part-paid plan instead of asserting one", async () => {
    // Arrange — Mia Cosme: the linked customer holds a single $925
    // payment, which is indistinguishable from an ordinary part-paid plan.
    // Her other payments sit on Customer objects the CRM is not linked to.
    const deal = makeDeal({
      payment_review_reason:
        "Four $925 payments sit across four different Stripe Customer objects.",
    });
    const items = [makeItem({ amount: 925 })];

    // Act
    const status = await assess(deal, items);

    // Assert
    expect(status.state).toBe("needs_review");
    expect(status.state).not.toBe("setup_pending");
    expect(status.reviewReason).toContain("four different Stripe Customer");
  });

  test("an open review never silently becomes 'create payment plan'", async () => {
    // Arrange — uncertainty with no money recorded at all.
    const deal = makeDeal({
      payment_review_reason: "Stripe evidence is incomplete.",
    });

    // Act
    const status = await assess(deal, []);

    // Assert
    expect(status.state).toBe("needs_review");
    expect(status.outstanding).not.toBe("Create payment plan");
  });

  test("a fully reconciled payment keeps its state and still surfaces the review", async () => {
    // Arrange — the one case where a confident answer outranks the
    // question: the money reconciles exactly against agreed terms.
    const deal = makeDeal({
      selected_payment_total: 4000,
      payment_review_reason: "Worth a look.",
    });
    const items = [makeItem({ amount: 4000 })];

    // Act
    const status = await assess(deal, items);

    // Assert
    expect(status.state).toBe("paid_in_full");
    expect(status.reviewReason).toBe("Worth a look.");
  });
});

describe("payment status — preparation is not payment", () => {
  test("a successful SetupIntent alone does not create a payment plan", async () => {
    // Arrange — a SetupIntent stores a payment method and collects
    // nothing. It produces no schedule item, so the Opportunity carries no
    // paid and no scheduled row, and must not read as a plan.
    const deal = makeDeal();

    // Act
    const status = await assess(deal, []);

    // Assert
    expect(status.state).not.toBe("active_plan");
    expect(status.state).not.toBe("scheduled_plan");
    expect(status.state).not.toBe("paid_in_full");
    expect(status.stripeLinked).toBe(false);
  });

  test("a linked schedule with nothing collected yet is scheduled, not active", async () => {
    // Arrange — Denise Cormier and Ava Frotton: a real future plan, which
    // read as "no payment plan" for weeks.
    const deal = makeDeal({
      stripe_subscription_schedule_id: "sub_sched_1",
    });
    const items = [
      makeItem({
        status: "scheduled",
        due_date: "2026-09-30",
        source: "owner_stated",
        stripe_payment_intent_id: null,
      }),
    ];

    // Act
    const status = await assess(deal, items);

    // Assert
    expect(status.state).toBe("scheduled_plan");
    expect(status.detail).toContain("Starts Sep 30, 2026");
  });
});
