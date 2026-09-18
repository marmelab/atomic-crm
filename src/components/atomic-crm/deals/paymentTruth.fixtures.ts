import type {
  Deal,
  DealPaymentScheduleItem,
  DealStripePlanObject,
} from "../types";

// The eight live people the payment model has been wrong about, as
// fixtures every consumer is tested against.
//
// Shared deliberately: the domain module, the Payment panel, the Client
// page's ledger card and the Dashboard all have to produce the same
// numbers from the same rows, and the only way to prove that is to give
// them literally the same input.

export const makeDeal = (overrides: Partial<Deal> = {}): Deal =>
  ({
    id: 1,
    name: "Opportunity",
    contact_id: 10,
    offer_id: 1,
    stage: "won",
    amount: 0,
    // Today's list price, deliberately different from several agreed
    // totals below — nothing may fall back to it.
    offer_price_snapshot: 4000,
    sales_id: 1,
    index: 0,
    stage_entered_at: "2026-05-01T00:00:00Z",
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    ...overrides,
  }) as Deal;

export const paid = (
  amount: number,
  overrides: Partial<DealPaymentScheduleItem> = {},
): DealPaymentScheduleItem =>
  ({
    id: Math.random(),
    deal_id: 1,
    amount,
    sequence: 1,
    status: "paid",
    source: "stripe",
    stripe_payment_intent_id: `pi_${Math.random().toString(36).slice(2)}`,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    ...overrides,
  }) as DealPaymentScheduleItem;

export const scheduled = (
  amount: number,
  overrides: Partial<DealPaymentScheduleItem> = {},
): DealPaymentScheduleItem =>
  ({
    id: Math.random(),
    deal_id: 1,
    amount,
    sequence: 9,
    status: "scheduled",
    source: "owner_stated",
    stripe_payment_intent_id: null,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    ...overrides,
  }) as DealPaymentScheduleItem;

export const plan = (
  overrides: Partial<DealStripePlanObject> = {},
): DealStripePlanObject =>
  ({
    id: Math.random(),
    deal_id: 1,
    stripe_object_id: `sub_${Math.random().toString(36).slice(2)}`,
    object_type: "subscription",
    status: "active",
    is_current: true,
    linked_at: "2026-05-01T00:00:00Z",
    link_source: "reconciliation",
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    ...overrides,
  }) as DealStripePlanObject;

export type PaymentCase = {
  name: string;
  deal: Deal;
  scheduleItems: DealPaymentScheduleItem[];
  planObjects: DealStripePlanObject[];
  expect: {
    agreedTotal: number | null;
    collected: number;
    futureScheduled: number;
    remaining: number | null;
    installmentsSatisfied: number | null;
    paidInFull: boolean;
    paymentSetupComplete: boolean;
    state: string;
  };
};

export const PAYMENT_CASES: PaymentCase[] = [
  {
    // Nothing collected. His plan exists only in Stripe and is not linked
    // yet, so there is no arrangement the CRM can see.
    name: "Sam Milz — $700 agreed, 4 x $175, nothing paid, nothing linked",
    deal: makeDeal({
      selected_payment_total: 700,
      selected_installment_count: 4,
      selected_installment_amount: 175,
      offer_price_snapshot: 700,
    }),
    scheduleItems: [],
    planObjects: [],
    expect: {
      agreedTotal: 700,
      collected: 0,
      futureScheduled: 0,
      remaining: 700,
      installmentsSatisfied: 0,
      paidInFull: false,
      paymentSetupComplete: false,
      state: "setup_pending",
    },
  },
  {
    name: "Sam Milz — once his Stripe schedule is linked",
    deal: makeDeal({
      selected_payment_total: 700,
      selected_installment_count: 4,
      selected_installment_amount: 175,
      offer_price_snapshot: 700,
    }),
    scheduleItems: [],
    planObjects: [
      plan({
        object_type: "schedule",
        status: "not_started",
        is_current: true,
      }),
    ],
    expect: {
      agreedTotal: 700,
      collected: 0,
      futureScheduled: 0,
      remaining: 700,
      installmentsSatisfied: 0,
      paidInFull: false,
      // An arrangement exists. Collection has not started, and does not
      // need to have.
      paymentSetupComplete: true,
      state: "scheduled_plan",
    },
  },
  {
    name: "Mel Yacovelli — agreed $700, nothing paid, no arrangement",
    deal: makeDeal({
      selected_payment_total: 700,
      selected_installment_count: 1,
      selected_installment_amount: 700,
      offer_price_snapshot: 700,
    }),
    scheduleItems: [],
    planObjects: [],
    expect: {
      agreedTotal: 700,
      collected: 0,
      futureScheduled: 0,
      remaining: 700,
      installmentsSatisfied: 0,
      paidInFull: false,
      paymentSetupComplete: false,
      state: "setup_pending",
    },
  },
  {
    name: "Mia Cosme — $3,700 agreed, four $925 payments across five customers",
    deal: makeDeal({
      selected_payment_total: 3700,
      selected_installment_count: 4,
      selected_installment_amount: 925,
    }),
    scheduleItems: [paid(925), paid(925), paid(925), paid(925)],
    planObjects: [],
    expect: {
      agreedTotal: 3700,
      collected: 3700,
      futureScheduled: 0,
      remaining: 0,
      installmentsSatisfied: 4,
      paidInFull: true,
      paymentSetupComplete: true,
      state: "paid_in_full",
    },
  },
  {
    name: "Emily Loeb — $3,700 agreed, settled in one payment, no subscription",
    deal: makeDeal({
      selected_payment_total: 3700,
      selected_installment_count: 1,
      selected_installment_amount: 3700,
    }),
    scheduleItems: [paid(3700)],
    planObjects: [],
    expect: {
      agreedTotal: 3700,
      collected: 3700,
      futureScheduled: 0,
      remaining: 0,
      installmentsSatisfied: 1,
      paidInFull: true,
      paymentSetupComplete: true,
      state: "paid_in_full",
    },
  },
  {
    name: "Jess Beauchamp — four installments satisfied by three transactions, card removed",
    deal: makeDeal({
      selected_payment_total: 4000,
      selected_installment_count: 4,
      selected_installment_amount: 1000,
    }),
    scheduleItems: [paid(1000), paid(2000), paid(1000)],
    planObjects: [
      plan({ status: "canceled", is_current: false }),
      plan({ object_type: "schedule", status: "canceled", is_current: false }),
    ],
    expect: {
      agreedTotal: 4000,
      collected: 4000,
      futureScheduled: 0,
      remaining: 0,
      installmentsSatisfied: 4,
      paidInFull: true,
      paymentSetupComplete: true,
      state: "paid_in_full",
    },
  },
  {
    name: "Jules Litman-Cleper — five of six paid, original plan ended, replacement live",
    deal: makeDeal({
      selected_payment_total: 3996,
      selected_installment_count: 6,
      selected_installment_amount: 666,
      stripe_subscription_id: "sub_new",
    }),
    scheduleItems: [paid(666), paid(666), paid(666), paid(666), paid(666)],
    planObjects: [
      plan({
        stripe_object_id: "sub_old",
        status: "canceled",
        is_current: false,
      }),
      plan({
        stripe_object_id: "sched_old",
        object_type: "schedule",
        status: "completed",
        is_current: false,
      }),
      plan({ stripe_object_id: "sub_new", status: "active", is_current: true }),
    ],
    expect: {
      agreedTotal: 3996,
      collected: 3330,
      futureScheduled: 0,
      remaining: 666,
      installmentsSatisfied: 5,
      // Every ROW happens to be paid. That is not settlement.
      paidInFull: false,
      paymentSetupComplete: true,
      state: "active_plan",
    },
  },
  {
    name: "Linda Turner — one $4,000 economic payment, owner and Stripe provenance",
    deal: makeDeal({
      selected_payment_total: 4000,
      selected_installment_count: 1,
      selected_installment_amount: 4000,
    }),
    scheduleItems: [
      paid(4000, {
        source: "owner_stated",
        stripe_payment_intent_id: "pi_linda",
        verified_by_stripe_at: "2026-09-18T00:00:00Z",
        paid_on: "2026-09-15",
      }),
    ],
    planObjects: [],
    expect: {
      agreedTotal: 4000,
      collected: 4000,
      futureScheduled: 0,
      remaining: 0,
      installmentsSatisfied: 1,
      paidInFull: true,
      paymentSetupComplete: true,
      state: "paid_in_full",
    },
  },
  {
    name: "Lara Spagnola — $400 collected, $1,000 scheduled for 2027-01-01",
    deal: makeDeal({
      selected_payment_total: 1400,
      offer_price_snapshot: 1400,
    }),
    scheduleItems: [
      paid(400, {
        source: "owner_stated",
        stripe_payment_intent_id: "pi_lara",
        verified_by_stripe_at: "2026-09-18T00:00:00Z",
      }),
      scheduled(1000, { due_date: "2027-01-01" }),
    ],
    planObjects: [plan({ status: "active", is_current: true })],
    expect: {
      agreedTotal: 1400,
      collected: 400,
      futureScheduled: 1000,
      remaining: 1000,
      // No equal-installment terms recorded, so no fabricated X of Y.
      installmentsSatisfied: null,
      paidInFull: false,
      paymentSetupComplete: true,
      state: "active_plan",
    },
  },
];
