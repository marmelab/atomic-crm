// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// The security property worth proving is what the sweep is ALLOWED to
// reach. A signed-in user pressing "Sync Stripe" must only ever touch the
// Stripe Customers already verified as that person's — never the whole
// account, and never one found by matching an email address.

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  customersQueried: [] as string[],
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
      update: () => ({ eq: async () => ({ error: null }) }),
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
  ingestStripePayments: async (
    _stripe: unknown,
    { customerIds }: { customerIds: string[] },
  ) => {
    state.customersQueried.push(...customerIds);
    return {
      ingested: 0,
      alreadyRecorded: 0,
      receivedMinor: 0,
      currency: null,
      lastPaymentAt: null,
      reviewReason: null,
      errors: [],
      capabilityWarnings: [],
    };
  },
}));

vi.mock("./stripePlanObjects.ts", () => ({
  recordPlanObjects: async () => ({
    recorded: 0,
    updated: 0,
    currentSubscriptionId: null,
    currentScheduleId: null,
    errors: [],
  }),
}));

const { reconcileStripe } = await import("./stripeReconcile.ts");

const stripe = {
  subscriptionSchedules: { list: async () => ({ data: [] }) },
  subscriptions: { list: async () => ({ data: [] }) },
} as never;

beforeEach(() => {
  state.customersQueried = [];
  state.tables = {
    contact_stripe_customers: [
      { contact_id: 1, stripe_customer_id: "cus_mine_a" },
      { contact_id: 1, stripe_customer_id: "cus_mine_b" },
      { contact_id: 2, stripe_customer_id: "cus_someone_else" },
    ],
    deals: [
      {
        id: 10,
        contact_id: 1,
        stage: "won",
        outcome: null,
        archived_at: null,
        stripe_subscription_id: null,
        stripe_subscription_schedule_id: null,
        selected_payment_total: 3700,
        offer_price_snapshot: 4000,
        payment_review_reason: null,
      },
      {
        id: 20,
        contact_id: 2,
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
  };
});

describe("scoping a Stripe sweep", () => {
  it("reaches every Stripe Customer verified as that person's", async () => {
    // Arrange — contact 1 owns two verified customer objects.

    // Act
    const delta = await reconcileStripe(stripe, { contactId: 1 });

    // Assert
    expect(delta.customersScanned).toBe(1);
    expect(state.customersQueried.sort()).toEqual(["cus_mine_a", "cus_mine_b"]);
  });

  it("cannot reach a Stripe Customer belonging to somebody else", async () => {
    // Act
    await reconcileStripe(stripe, { contactId: 1 });

    // Assert
    expect(state.customersQueried).not.toContain("cus_someone_else");
  });

  it("scans nobody for a Contact with no verified Stripe Customer", async () => {
    // Arrange — a real person with a Stripe account nobody has verified.
    // No email fallback exists, deliberately: an address is a discovery
    // hint, never an authority to move money onto a record.

    // Act
    const delta = await reconcileStripe(stripe, { contactId: 99 });

    // Assert
    expect(delta.customersScanned).toBe(0);
    expect(state.customersQueried).toHaveLength(0);
  });

  it("refuses to pick an Opportunity when more than one could own the money", async () => {
    // Arrange — two live Opportunities for the same person.
    state.tables.deals.push({
      id: 11,
      contact_id: 1,
      stage: "won",
      outcome: null,
      archived_at: null,
      stripe_subscription_id: null,
      stripe_subscription_schedule_id: null,
      selected_payment_total: null,
      offer_price_snapshot: 4000,
      payment_review_reason: null,
    });

    // Act
    const delta = await reconcileStripe(stripe, { contactId: 1 });

    // Assert — surfaced, not guessed, and no money touched.
    expect(delta.ambiguous).toHaveLength(1);
    expect(state.customersQueried).toHaveLength(0);
  });
});
