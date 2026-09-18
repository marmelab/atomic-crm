import { describe, expect, test } from "vitest";

import { assessPostSaleSetup, isPaymentSetUp } from "./postSaleSetup";
import type {
  Deal,
  DealPaymentScheduleItem,
  DealStripePlanObject,
  EnrollmentOnboardingItem,
} from "../types";

// The distinction this whole module exists to hold: a client's own
// onboarding state and the post-sale work keeping an Opportunity on the
// board are two different things. Emma Wijns is onboarded and still needs
// a payment plan created; Sam Milz has said yes and his plan exists only
// in Stripe. Both belong in Onboarding, for different reasons, and neither
// is un-onboarded.

const deal = (overrides: Partial<Deal> = {}): Deal =>
  ({
    id: 1,
    name: "Opportunity",
    contact_id: 10,
    offer_id: 1,
    stage: "won",
    amount: 700,
    offer_price_snapshot: 700,
    sales_id: 1,
    index: 0,
    stage_entered_at: "2026-09-01T00:00:00Z",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  }) as Deal;

const paidItem = (
  overrides: Partial<DealPaymentScheduleItem> = {},
): DealPaymentScheduleItem =>
  ({
    id: 1,
    deal_id: 1,
    amount: 175,
    sequence: 1,
    status: "paid",
    source: "stripe",
    stripe_payment_intent_id: "pi_1",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  }) as DealPaymentScheduleItem;

const planObject = (
  overrides: Partial<DealStripePlanObject> = {},
): DealStripePlanObject =>
  ({
    id: 1,
    deal_id: 1,
    stripe_object_id: "sub_sched_1",
    object_type: "schedule",
    status: "not_started",
    is_current: true,
    linked_at: "2026-09-16T00:00:00Z",
    link_source: "owner_confirmed",
    created_at: "2026-09-16T00:00:00Z",
    updated_at: "2026-09-16T00:00:00Z",
    ...overrides,
  }) as DealStripePlanObject;

const onboardingItem = (
  overrides: Partial<EnrollmentOnboardingItem> = {},
): EnrollmentOnboardingItem =>
  ({
    id: 1,
    enrollment_id: 1,
    requirement_key: "contract",
    label: "Contract",
    task_text_template: "",
    is_required: true,
    sort_order: 1,
    status: "pending",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  }) as EnrollmentOnboardingItem;

const assess = (args: Parameters<typeof assessPostSaleSetup>[0]) =>
  assessPostSaleSetup(args);

describe("what keeps a sold Opportunity on the board", () => {
  test("Sam: said yes, plan exists only in Stripe — stays in Onboarding", () => {
    // Arrange — $700 agreed, nothing linked and nothing collected yet,
    // because his Stripe customer has not been confirmed.
    const status = assess({
      deal: deal({ selected_payment_total: 700 }),
      enrollmentStatus: "active",
      scheduleItems: [],
      planObjects: [],
      onboardingItems: [],
    });

    // Assert
    expect(status.complete).toBe(false);
    expect(status.headline).toBe("Payment setup pending");
  });

  test("Sam, once his Stripe plan is linked, leaves the board", () => {
    // Arrange — the schedule exists and the first $175 is in.
    const status = assess({
      deal: deal({
        selected_payment_total: 700,
        selected_installment_count: 4,
        selected_installment_amount: 175,
      }),
      enrollmentStatus: "active",
      scheduleItems: [paidItem()],
      planObjects: [planObject()],
      onboardingItems: [],
    });

    // Assert — three installments still to come, and that is not a reason
    // to keep him in Onboarding.
    expect(status.complete).toBe(true);
    expect(status.blockers).toHaveLength(0);
  });

  test("Emma: onboarded client, payment never set up — stays in Onboarding", () => {
    // Arrange — her client onboarding is complete and owner-confirmed.
    // This must not be read as un-onboarded, and must not take her off the
    // board either: a real payment job is outstanding.
    const status = assess({
      deal: deal({ selected_payment_total: 4000 }),
      enrollmentStatus: "active",
      scheduleItems: [],
      planObjects: [],
      onboardingItems: [],
    });

    // Assert
    expect(status.complete).toBe(false);
    expect(status.blockers).toEqual([
      { kind: "payment", label: "Payment setup pending" },
    ]);
  });

  test("a six-month plan does not hold somebody in Onboarding for six months", () => {
    // Arrange — one of six installments collected.
    const status = assess({
      deal: deal({
        selected_payment_total: 3996,
        selected_installment_count: 6,
        selected_installment_amount: 666,
      }),
      enrollmentStatus: "active",
      scheduleItems: [paidItem({ amount: 666 })],
      planObjects: [planObject({ status: "active" })],
      onboardingItems: [],
    });

    // Assert — payment SETUP is complete; collection is not the question.
    expect(status.complete).toBe(true);
  });

  test("an outstanding required checklist item is named on the card", () => {
    // Arrange
    const status = assess({
      deal: deal({ selected_payment_total: 700 }),
      enrollmentStatus: "onboarding",
      scheduleItems: [paidItem()],
      planObjects: [planObject()],
      onboardingItems: [onboardingItem({ label: "Contract" })],
    });

    // Assert
    expect(status.complete).toBe(false);
    expect(status.headline).toBe("Contract pending");
  });

  test("payment leads when both a checklist item and payment are outstanding", () => {
    // Arrange
    const status = assess({
      deal: deal(),
      enrollmentStatus: "onboarding",
      scheduleItems: [],
      planObjects: [],
      onboardingItems: [onboardingItem({ label: "Course access" })],
    });

    // Assert — one line on the card, and it says the money one.
    expect(status.headline).toBe("Payment setup pending");
    expect(status.blockers).toHaveLength(2);
  });

  test("an empty checklist is not read as everything outstanding", () => {
    // Arrange — every historical client predates the checklist and has no
    // item rows at all. Inventing blockers would drag years of finished
    // clients back onto the board.
    const status = assess({
      deal: deal({ selected_payment_total: 700 }),
      enrollmentStatus: "active",
      scheduleItems: [paidItem()],
      planObjects: [planObject()],
      onboardingItems: [],
    });

    // Assert
    expect(status.complete).toBe(true);
  });

  test("a finished client never sits in the active pipeline", () => {
    // Arrange — Kerri Fukui: completed long ago, with an open review about
    // historical money. A question about the past is not setup work.
    const status = assess({
      deal: deal({ payment_review_reason: "Collected 9620 against 4000." }),
      enrollmentStatus: "completed",
      scheduleItems: [],
      planObjects: [],
      onboardingItems: [],
    });

    // Assert
    expect(status.complete).toBe(true);
    expect(status.headline).toBeNull();
  });
});

describe("payment setup is not payment collection", () => {
  test("an arrangement that exists counts as set up", () => {
    expect(isPaymentSetUp("paid_in_full")).toBe(true);
    expect(isPaymentSetUp("active_plan")).toBe(true);
    expect(isPaymentSetUp("scheduled_plan")).toBe(true);
  });

  test("terms with nothing behind them do not", () => {
    // owner_confirmed_plan is exactly "still needs creating or linking".
    expect(isPaymentSetUp("owner_confirmed_plan")).toBe(false);
    expect(isPaymentSetUp("setup_pending")).toBe(false);
    expect(isPaymentSetUp("needs_review")).toBe(false);
    expect(isPaymentSetUp("unknown")).toBe(false);
  });
});
