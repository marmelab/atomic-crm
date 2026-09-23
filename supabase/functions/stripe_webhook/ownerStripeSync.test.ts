// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  authorizeOwner,
  handleOwnerStripeSync,
  summarizeForOwner,
  type OwnerStripeSyncDeps,
} from "./ownerStripeSync";
import type { StripeReconcileDelta } from "./stripeReconcile";

// A sweep result with something of everything, so the "what comes back"
// tests are looking at the worst case rather than an empty run.
const fullDelta = (): StripeReconcileDelta => ({
  customersScanned: 42,
  schedulesLinked: 1,
  subscriptionsLinked: 2,
  paymentStatesUpdated: 3,
  paymentsIngested: 4,
  paymentsAlreadyRecorded: 9,
  paymentsMerged: 5,
  obligationsSatisfied: 7,
  planObjectsRecorded: 6,
  planObjectsUpdated: 7,
  agreedTermsDerived: 8,
  needsReview: [{ contactId: 187, reason: "cus_SECRETCUSTOMER is ambiguous" }],
  alreadyLinked: 11,
  noStripePlan: 3,
  ambiguous: [{ contactId: 204, candidates: ["cus_AAA", "cus_BBB"] }],
  errors: ["Stripe said no such customer: cus_LEAKME"],
  capabilityWarnings: ["stripe key lacks read access to charges"],
});

const request = (
  url = "https://example.test/stripe_webhook?action=reconcile-all",
) => new Request(url, { method: "POST", body: "{}" });

const deps = (overrides: Partial<OwnerStripeSyncDeps> = {}) => {
  const reconcile = vi.fn(async () => fullDelta());
  return {
    reconcile,
    all: {
      authenticate: async () => ({ id: "user-1" }),
      loadSale: async () => ({ administrator: true, disabled: false }),
      reconcile,
      ...overrides,
    } as OwnerStripeSyncDeps,
  };
};

describe("who may sweep the whole Stripe account", () => {
  it("refuses a caller whose JWT did not verify, and never reaches Stripe", async () => {
    const { reconcile, all } = deps({ authenticate: async () => null });

    const response = await handleOwnerStripeSync(request(), all);

    expect(response.status).toBe(401);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("refuses a caller whose token throws on verification", async () => {
    const { reconcile, all } = deps({
      authenticate: async () => {
        throw new Error("jwt malformed");
      },
    });

    const response = await handleOwnerStripeSync(request(), all);

    expect(response.status).toBe(401);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("refuses a real signed-in user who is not an administrator", async () => {
    // The whole point of the boundary: being authenticated is not being
    // authorized. This caller passed Supabase Auth and is still refused.
    const { reconcile, all } = deps({
      loadSale: async () => ({ administrator: false, disabled: false }),
    });

    const response = await handleOwnerStripeSync(request(), all);

    expect(response.status).toBe(403);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("refuses an administrator whose account has been disabled", async () => {
    const { reconcile, all } = deps({
      loadSale: async () => ({ administrator: true, disabled: true }),
    });

    const response = await handleOwnerStripeSync(request(), all);

    expect(response.status).toBe(403);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("refuses an authenticated user with no CRM account at all", async () => {
    const { reconcile, all } = deps({ loadSale: async () => null });

    const response = await handleOwnerStripeSync(request(), all);

    expect(response.status).toBe(403);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("runs the canonical sweep exactly once for an administrator", async () => {
    const { reconcile, all } = deps();

    const response = await handleOwnerStripeSync(request(), all);

    expect(response.status).toBe(200);
    expect(reconcile).toHaveBeenCalledTimes(1);
    // No argument: there is nothing to scope, so nothing to mis-scope.
    expect(reconcile).toHaveBeenCalledWith();
  });

  it("authorizes on the database row, never on anything the caller sent", async () => {
    // A request carrying every credential-shaped header somebody might
    // hope counts for something. Authority still comes from `sales`.
    const hopeful = new Request(
      "https://example.test/stripe_webhook?action=reconcile-all",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer whatever",
          "x-cron-secret": "the-real-cron-secret",
          "x-administrator": "true",
        },
        body: "{}",
      },
    );
    const { reconcile, all } = deps({
      authenticate: async () => ({ id: "user-1" }),
      loadSale: async () => ({ administrator: false, disabled: false }),
    });

    const response = await handleOwnerStripeSync(hopeful, all);

    // Holding the cron secret does not help here either: this door does
    // not take that key, and the cron door does not take a JWT.
    expect(response.status).toBe(403);
    expect(reconcile).not.toHaveBeenCalled();
  });
});

describe("what the request can ask for", () => {
  it("ignores every query parameter, so it cannot be steered at the Stripe account", async () => {
    const steered = request(
      "https://example.test/stripe_webhook?action=reconcile-all" +
        "&contactId=999&customerId=cus_SOMEBODYELSE&limit=10000&email=x%40y.z",
    );
    const { reconcile, all } = deps();

    const response = await handleOwnerStripeSync(steered, all);

    expect(response.status).toBe(200);
    expect(reconcile).toHaveBeenCalledWith();
  });
});

describe("what comes back", () => {
  it("returns counts and no Stripe or CRM identifiers", async () => {
    const { all } = deps();

    const body = await (await handleOwnerStripeSync(request(), all)).text();

    expect(JSON.parse(body)).toEqual({
      status: "synced",
      customersChecked: 42,
      updatesApplied: 36,
      needsReview: 1,
      ambiguous: 1,
      errors: 1,
    });
    // The delta it summarized held all of these. None of them travel.
    expect(body).not.toContain("cus_");
    expect(body).not.toContain("187");
    expect(body).not.toContain("204");
    expect(body).not.toContain("no such customer");
    expect(body).not.toContain("stripe key lacks");
  });

  it("says how many need a human without saying who they are", () => {
    const summary = summarizeForOwner(fullDelta());

    expect(summary.needsReview).toBe(1);
    expect(summary.ambiguous).toBe(1);
    expect(Object.values(summary).every((v) => typeof v !== "object")).toBe(
      true,
    );
  });
});

describe("authorizeOwner", () => {
  it("admits an enabled administrator", () => {
    expect(
      authorizeOwner({ administrator: true, disabled: false }).authorized,
    ).toBe(true);
  });

  it("refuses everybody else", () => {
    expect(
      authorizeOwner({ administrator: false, disabled: false }).authorized,
    ).toBe(false);
    expect(
      authorizeOwner({ administrator: true, disabled: true }).authorized,
    ).toBe(false);
    expect(authorizeOwner(null).authorized).toBe(false);
  });
});
