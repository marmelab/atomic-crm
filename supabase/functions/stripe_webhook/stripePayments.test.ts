// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// What has to be proven here is not "it reads Stripe" but the properties
// that made the old reconciler lie: that money is counted once however
// Stripe describes it, that a call it cannot make is reported as unknown
// rather than as zero, and that a second sweep writes nothing.

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  rows: [] as Row[],
  inserts: [] as Row[],
  nextId: 1,
}));

vi.mock("../_shared/supabaseAdmin.ts", () => {
  const from = (table: string) => ({
    select: () => ({
      eq: async () => ({
        data: table === "deal_payment_schedule_items" ? state.rows : [],
        error: null,
      }),
    }),
    update: (patch: Row) => ({
      eq: async (_column: string, value: unknown) => {
        const row = state.rows.find((r) => r.id === value);
        if (row) Object.assign(row, patch);
        return { error: null };
      },
    }),
    insert: async (row: Row) => {
      const clash = state.rows.some(
        (existing) =>
          existing.stripe_payment_intent_id === row.stripe_payment_intent_id,
      );
      if (clash) return { error: { code: "23505", message: "duplicate" } };
      const stored = { id: state.nextId++, ...row };
      state.rows.push(stored);
      state.inserts.push(stored);
      return { error: null };
    },
  });
  return { supabaseAdmin: { from } };
});

const { collectPayments, ingestStripePayments } = await import(
  "./stripePayments.ts"
);

const SECONDS = 1_752_000_000;

type StripeStub = {
  paymentIntents: { list: (...args: unknown[]) => Promise<unknown> };
  invoices: { list: (...args: unknown[]) => Promise<unknown> };
  charges: { list: (...args: unknown[]) => Promise<unknown> };
};

const permissionDenied = () => {
  throw new Error("Permission denied. The provided key lacks invoice_read.");
};

const makeStripe = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    paymentIntents: { list: async () => ({ data: [] }) },
    invoices: { list: async () => ({ data: [] }) },
    charges: { list: async () => ({ data: [] }) },
    ...over,
  }) as unknown as StripeStub;

beforeEach(() => {
  state.rows = [];
  state.inserts = [];
  state.nextId = 1;
});

describe("collecting money from Stripe", () => {
  it("counts one payment once when an invoice, a charge and an intent all describe it", async () => {
    // Arrange — the same $666 installment, as Stripe reports it three ways.
    const stripe = makeStripe({
      paymentIntents: {
        list: async () => ({
          data: [
            {
              id: "pi_1",
              status: "succeeded",
              amount_received: 66600,
              currency: "usd",
              created: SECONDS,
            },
          ],
        }),
      },
      invoices: {
        list: async () => ({
          data: [
            {
              id: "in_1",
              status: "paid",
              amount_paid: 66600,
              currency: "usd",
              payment_intent: "pi_1",
              created: SECONDS,
              status_transitions: { paid_at: SECONDS },
            },
          ],
        }),
      },
      charges: {
        list: async () => ({
          data: [
            {
              id: "ch_1",
              status: "succeeded",
              refunded: false,
              amount: 66600,
              currency: "usd",
              payment_intent: "pi_1",
              created: SECONDS,
            },
          ],
        }),
      },
    });

    // Act
    const { payments } = await collectPayments(stripe as never, "cus_example");

    // Assert
    expect(payments).toHaveLength(1);
    expect(payments[0].amountMinor).toBe(66600);
  });

  it("reports a PaymentIntent read it cannot make as unknown, never as zero", async () => {
    // Arrange — the primary source fails.
    const stripe = makeStripe({
      paymentIntents: { list: permissionDenied },
    });

    // Act
    const { payments, errors, capabilityWarnings } = await collectPayments(
      stripe as never,
      "cus_example",
    );

    // Assert — an empty list plus a recorded error, so the caller cannot
    // mistake silence for "nothing was paid".
    expect(payments).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(capabilityWarnings).toHaveLength(0);
  });

  it("treats a missing invoice permission as degraded capability, not per-client doubt", async () => {
    // Arrange — the live restricted key genuinely cannot read invoices or
    // charges. Every client must not become "needs review" because of it.
    const stripe = makeStripe({
      paymentIntents: {
        list: async () => ({
          data: [
            {
              id: "pi_9",
              status: "succeeded",
              amount_received: 370000,
              currency: "usd",
              created: SECONDS,
            },
          ],
        }),
      },
      invoices: { list: permissionDenied },
      charges: { list: permissionDenied },
    });

    // Act
    const { payments, errors, capabilityWarnings } = await collectPayments(
      stripe as never,
      "cus_example",
    );

    // Assert
    expect(payments).toHaveLength(1);
    expect(errors).toHaveLength(0);
    expect(capabilityWarnings).toHaveLength(2);
  });

  it("ignores a SetupIntent-shaped intent that collected nothing", async () => {
    // Arrange — preparation is not payment.
    const stripe = makeStripe({
      paymentIntents: {
        list: async () => ({
          data: [
            {
              id: "pi_zero",
              status: "succeeded",
              amount_received: 0,
              currency: "usd",
              created: SECONDS,
            },
            {
              id: "pi_pending",
              status: "requires_payment_method",
              amount_received: 0,
              currency: "usd",
              created: SECONDS,
            },
          ],
        }),
      },
    });

    // Act
    const { payments } = await collectPayments(stripe as never, "cus_example");

    // Assert
    expect(payments).toHaveLength(0);
  });
});

describe("recording money against an Opportunity", () => {
  const stripeWithTwoPayments = () =>
    makeStripe({
      paymentIntents: {
        list: async () => ({
          data: [
            {
              id: "pi_a",
              status: "succeeded",
              amount_received: 100000,
              currency: "usd",
              created: SECONDS,
            },
            {
              id: "pi_b",
              status: "succeeded",
              amount_received: 100000,
              currency: "usd",
              created: SECONDS + 86_400,
            },
          ],
        }),
      },
    });

  it("writes nothing on a second sweep over unchanged Stripe data", async () => {
    // Arrange
    const params = {
      customerIds: ["cus_example"],
      dealId: 1,
      agreedTotal: 4000,
      existingReviewReason: null,
    };

    // Act
    const first = await ingestStripePayments(
      stripeWithTwoPayments() as never,
      params,
    );
    const second = await ingestStripePayments(
      stripeWithTwoPayments() as never,
      params,
    );

    // Assert
    expect(first.ingested).toBe(2);
    expect(second.ingested).toBe(0);
    expect(second.alreadyRecorded).toBe(2);
    expect(state.inserts).toHaveLength(2);
  });

  it("aggregates money across every verified Stripe Customer for one person", async () => {
    // Arrange — Mia Cosme: $3,700 paid as four $925 payments, each made
    // through a DIFFERENT Stripe Customer object because a new one was
    // created each time. Reading only the primary found $925.
    const perCustomer: Record<string, string> = {
      cus_1: "pi_1",
      cus_2: "pi_2",
      cus_3: "pi_3",
      cus_4: "pi_4",
    };
    const stripe = makeStripe({
      paymentIntents: {
        list: async ({ customer }: { customer: string }) => ({
          data: [
            {
              id: perCustomer[customer],
              status: "succeeded",
              amount_received: 92500,
              currency: "usd",
              created: SECONDS,
            },
          ],
        }),
      },
    });

    // Act
    const result = await ingestStripePayments(stripe as never, {
      customerIds: ["cus_1", "cus_2", "cus_3", "cus_4"],
      dealId: 1,
      agreedTotal: 3700,
      existingReviewReason: null,
    });

    // Assert
    expect(result.ingested).toBe(4);
    expect(result.receivedMinor).toBe(370000);
    expect(result.reviewReason).toBeNull();
  });

  it("counts a payment once even when two verified customers surface it", async () => {
    // Arrange — the same PaymentIntent reachable through two customer
    // objects must not become two payments.
    const stripe = makeStripe({
      paymentIntents: {
        list: async () => ({
          data: [
            {
              id: "pi_shared",
              status: "succeeded",
              amount_received: 92500,
              currency: "usd",
              created: SECONDS,
            },
          ],
        }),
      },
    });

    // Act
    const result = await ingestStripePayments(stripe as never, {
      customerIds: ["cus_a", "cus_b"],
      dealId: 1,
      agreedTotal: 3700,
      existingReviewReason: null,
    });

    // Assert
    expect(result.ingested).toBe(1);
    expect(result.receivedMinor).toBe(92500);
  });

  it("never lifts a review somebody already raised", async () => {
    // Arrange — Mia Cosme's case: $925 against a $4,000 offer looks like
    // an ordinary part-paid plan, and the reason it is not is invisible to
    // this sweep.
    const stripe = makeStripe({
      paymentIntents: {
        list: async () => ({
          data: [
            {
              id: "pi_mia",
              status: "succeeded",
              amount_received: 92500,
              currency: "usd",
              created: SECONDS,
            },
          ],
        }),
      },
    });

    // Act
    const result = await ingestStripePayments(stripe as never, {
      customerIds: ["cus_example"],
      dealId: 1,
      agreedTotal: 4000,
      existingReviewReason: "Payments sit across four Customer objects.",
    });

    // Assert
    expect(result.reviewReason).toBe(
      "Payments sit across four Customer objects.",
    );
  });

  it("raises a review when money exists but no agreed total is recorded", async () => {
    // Arrange
    const stripe = makeStripe({
      paymentIntents: {
        list: async () => ({
          data: [
            {
              id: "pi_x",
              status: "succeeded",
              amount_received: 37500,
              currency: "usd",
              created: SECONDS,
            },
          ],
        }),
      },
    });

    // Act
    const result = await ingestStripePayments(stripe as never, {
      customerIds: ["cus_example"],
      dealId: 1,
      agreedTotal: null,
      existingReviewReason: null,
    });

    // Assert
    expect(result.reviewReason).toContain("no agreed total");
  });

  it("attaches Stripe evidence to the payment Leif already recorded", async () => {
    // Arrange — Linda Turner: an owner-stated $4,000 already on the
    // ledger, and Stripe holding the real $4,000 payment behind it. These
    // are two facts about ONE event.
    state.rows = [
      {
        id: 99,
        sequence: 1,
        amount: 400,
        status: "paid",
        source: "owner_stated",
        stripe_payment_intent_id: null,
        satisfied_by_payment_intent_id: null,
      },
    ];
    const stripe = makeStripe({
      paymentIntents: {
        list: async () => ({
          data: [
            {
              id: "pi_linda",
              status: "succeeded",
              amount_received: 40000,
              currency: "usd",
              created: SECONDS,
            },
          ],
        }),
      },
    });

    // Act
    const result = await ingestStripePayments(stripe as never, {
      customerIds: ["cus_example"],
      dealId: 1,
      agreedTotal: 4000,
      existingReviewReason: null,
    });

    // Assert — no second row, no second economic payment, and both
    // provenances kept on the one that exists.
    expect(result.merged).toBe(1);
    expect(result.ingested).toBe(0);
    expect(state.inserts).toHaveLength(0);
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].source).toBe("owner_stated");
    expect(state.rows[0].stripe_payment_intent_id).toBe("pi_linda");
    expect(result.reviewReason).toBeNull();
  });

  it("refuses to merge when more than one recorded payment could be the same money", async () => {
    // Arrange — two owner-stated $400 payments. Either could be the one
    // Stripe is describing, so nothing is merged.
    state.rows = [
      {
        id: 1,
        sequence: 1,
        amount: 400,
        status: "paid",
        source: "owner_stated",
        stripe_payment_intent_id: null,
        satisfied_by_payment_intent_id: null,
      },
      {
        id: 2,
        sequence: 2,
        amount: 400,
        status: "paid",
        source: "owner_stated",
        stripe_payment_intent_id: null,
        satisfied_by_payment_intent_id: null,
      },
    ];
    const stripe = makeStripe({
      paymentIntents: {
        list: async () => ({
          data: [
            {
              id: "pi_amb",
              status: "succeeded",
              amount_received: 40000,
              currency: "usd",
              created: SECONDS,
            },
          ],
        }),
      },
    });

    // Act
    const result = await ingestStripePayments(stripe as never, {
      customerIds: ["cus_example"],
      dealId: 1,
      agreedTotal: 4000,
      existingReviewReason: null,
    });

    // Assert
    expect(result.merged).toBe(0);
    expect(result.reviewReason).toContain("more than one payment");
  });

  it("marks a scheduled obligation a payment has discharged", async () => {
    // Arrange — Lara Spagnola's $1,000 due 2027-01-01, once Stripe
    // collects it.
    state.rows = [
      {
        id: 7,
        sequence: 2,
        amount: 1000,
        status: "scheduled",
        source: "owner_stated",
        stripe_payment_intent_id: null,
        satisfied_by_payment_intent_id: null,
      },
    ];
    const stripe = makeStripe({
      paymentIntents: {
        list: async () => ({
          data: [
            {
              id: "pi_future",
              status: "succeeded",
              amount_received: 100000,
              currency: "usd",
              created: SECONDS,
            },
          ],
        }),
      },
    });

    // Act
    const result = await ingestStripePayments(stripe as never, {
      customerIds: ["cus_example"],
      dealId: 1,
      agreedTotal: 1400,
      existingReviewReason: null,
    });

    // Assert — the receipt is its own row, and the obligation records what
    // settled it rather than staying owed forever.
    expect(result.ingested).toBe(1);
    expect(result.obligationsSatisfied).toBe(1);
    expect(state.rows[0].satisfied_by_payment_intent_id).toBe("pi_future");
  });

  it("raises no review when collected money reconciles against agreed terms", async () => {
    // Act
    const result = await ingestStripePayments(
      stripeWithTwoPayments() as never,
      {
        customerIds: ["cus_example"],
        dealId: 1,
        agreedTotal: 4000,
        existingReviewReason: null,
      },
    );

    // Assert
    expect(result.reviewReason).toBeNull();
    expect(result.receivedMinor).toBe(200000);
  });
});
