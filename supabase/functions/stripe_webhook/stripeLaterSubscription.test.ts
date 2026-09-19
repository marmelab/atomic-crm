// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// A subscription created AFTER the customer was already linked.
//
// This is the sequence human acceptance actually ran: Emma was Won, her
// Stripe customer was verified, and only then did Leif build her plan in
// the Stripe dashboard. Sync Stripe found it and linked it — and her
// Opportunity still read "Agreed terms not recorded", because linking a
// plan and knowing the agreed total were never connected.
//
// So what is proved here is the whole path: discovery for an
// already-linked customer, the total the plan proves, and a second run
// that writes nothing because nothing changed. Synthetic Stripe fixtures
// only.

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  updates: [] as { table: string; patch: Row; id: unknown }[],
}));

vi.mock("../_shared/supabaseAdmin.ts", () => {
  const from = (table: string) => {
    state.tables[table] ??= [];
    const filters: [string, unknown][] = [];
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      },
      in: (column: string, values: unknown[]) => {
        filters.push([column, values]);
        return builder;
      },
      not: () => builder,
      update: (patch: Row) => ({
        eq: async (_column: string, id: unknown) => {
          state.updates.push({ table, patch, id });
          const row = state.tables[table].find((r) => r.id === id);
          if (row) Object.assign(row, patch);
          return { error: null };
        },
      }),
      insert: async () => ({ error: null }),
      then: (resolve: (value: unknown) => unknown) => {
        const rows = state.tables[table].filter((row) =>
          filters.every(([column, value]) =>
            Array.isArray(value)
              ? value.includes(row[column])
              : row[column] === value,
          ),
        );
        return Promise.resolve(resolve({ data: rows, error: null }));
      },
    };
    return builder;
  };
  return { supabaseAdmin: { from } };
});

vi.mock("./stripePayments.ts", () => ({
  ingestStripePayments: async () => ({
    ingested: 0,
    alreadyRecorded: 0,
    merged: 0,
    obligationsSatisfied: 0,
    receivedMinor: 0,
    currency: null,
    lastPaymentAt: null,
    reviewReason: null,
    errors: [],
    capabilityWarnings: [],
  }),
}));

vi.mock("./stripePlanObjects.ts", () => ({
  recordPlanObjects: async () => ({
    recorded: 1,
    updated: 0,
    currentSubscriptionId: null,
    currentScheduleId: null,
    errors: [],
  }),
}));

const { reconcileStripe } = await import("./stripeReconcile.ts");

const SEC = (iso: string) => Math.floor(Date.parse(iso) / 1000);

// One phase, $1,000 a month, November to March. Four payments.
const schedule = (over: Record<string, unknown> = {}) => ({
  id: "sub_sched_zz",
  status: "not_started",
  subscription: null,
  phases: [
    {
      start_date: SEC("2026-11-01T00:00:00Z"),
      end_date: SEC("2027-03-01T00:00:00Z"),
      iterations: null,
      items: [
        {
          price: {
            unit_amount: 100000,
            recurring: { interval: "month", interval_count: 1 },
          },
        },
      ],
    },
  ],
  ...over,
});

const stripeWith = (schedules: unknown[]) =>
  ({
    subscriptionSchedules: { list: async () => ({ data: schedules }) },
    subscriptions: { list: async () => ({ data: [] }) },
    prices: {
      retrieve: async () => ({
        unit_amount: 100000,
        recurring: { interval: "month", interval_count: 1 },
      }),
    },
  }) as never;

beforeEach(() => {
  state.updates = [];
  state.tables = {
    contact_stripe_customers: [{ contact_id: 1, stripe_customer_id: "cus_zz" }],
    deals: [
      {
        id: 10,
        contact_id: 1,
        stage: "won",
        outcome: null,
        archived_at: null,
        stripe_subscription_id: null,
        stripe_subscription_schedule_id: null,
        selected_payment_total: null,
        offer_price_snapshot: 4000,
        payment_review_reason: null,
      },
    ],
    deal_payment_schedule_items: [],
  };
});

describe("a plan created after the customer was linked", () => {
  it("is found, linked, and tells the CRM what was agreed", async () => {
    // Act
    const delta = await reconcileStripe(stripeWith([schedule()]), {
      contactId: 1,
    });

    // Assert — found and linked...
    expect(delta.schedulesLinked).toBe(1);
    expect(state.tables.deals[0].stripe_subscription_schedule_id).toBe(
      "sub_sched_zz",
    );
    // ...and the total the plan proves, with its provenance.
    expect(delta.agreedTermsDerived).toBe(1);
    expect(state.tables.deals[0].selected_payment_total).toBe(4000);
    expect(state.tables.deals[0].selected_payment_total_source).toBe(
      "stripe_derived",
    );
    expect(state.tables.deals[0].selected_installment_count).toBe(4);
    expect(state.tables.deals[0].selected_installment_amount).toBe(1000);
  });

  it("writes nothing at all on a second run", async () => {
    // Arrange — the state the first run left behind.
    const stripe = stripeWith([schedule()]);
    await reconcileStripe(stripe, { contactId: 1 });
    state.updates = [];

    // Act
    const delta = await reconcileStripe(stripe, { contactId: 1 });

    // Assert — idempotent: no new link, no second total, no duplicate.
    expect(state.updates).toHaveLength(0);
    expect(delta.schedulesLinked).toBe(0);
    expect(delta.agreedTermsDerived).toBe(0);
    expect(delta.alreadyLinked).toBe(1);
    expect(state.tables.deals[0].selected_payment_total).toBe(4000);
  });

  it("never overwrites a total somebody already recorded", async () => {
    // Arrange — Leif stated $3,500 for a plan Stripe would read as $4,000.
    state.tables.deals[0].selected_payment_total = 3500;
    state.tables.deals[0].selected_payment_total_source = "owner_confirmed";

    // Act
    const delta = await reconcileStripe(stripeWith([schedule()]), {
      contactId: 1,
    });

    // Assert — Stripe fills a gap; it does not argue with a person.
    expect(delta.agreedTermsDerived).toBe(0);
    expect(state.tables.deals[0].selected_payment_total).toBe(3500);
    expect(state.tables.deals[0].selected_payment_total_source).toBe(
      "owner_confirmed",
    );
  });

  it("refuses an open-ended plan rather than inventing a total", async () => {
    // Arrange — monthly, no end date. Proves a rate, never a total.
    const openEnded = schedule({
      phases: [
        {
          start_date: SEC("2026-11-01T00:00:00Z"),
          end_date: null,
          iterations: null,
          items: [
            {
              price: {
                unit_amount: 100000,
                recurring: { interval: "month", interval_count: 1 },
              },
            },
          ],
        },
      ],
    });

    // Act
    const delta = await reconcileStripe(stripeWith([openEnded]), {
      contactId: 1,
    });

    // Assert — the plan is still linked; the total stays unknown.
    expect(delta.schedulesLinked).toBe(1);
    expect(delta.agreedTermsDerived).toBe(0);
    expect(state.tables.deals[0].selected_payment_total).toBeNull();
  });

  it("refuses when money was collected outside the plan", async () => {
    // Arrange — Daniel: $500 taken before the plan was arranged.
    state.tables.deal_payment_schedule_items = [
      { id: 1, deal_id: 10, amount: 500, status: "paid" },
    ];

    // Act
    const delta = await reconcileStripe(stripeWith([schedule()]), {
      contactId: 1,
    });

    // Assert
    expect(delta.agreedTermsDerived).toBe(0);
    expect(state.tables.deals[0].selected_payment_total).toBeNull();
  });
});
