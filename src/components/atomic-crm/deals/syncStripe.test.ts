import { beforeEach, describe, expect, it, vi } from "vitest";

// What Sync Stripe says it did.
//
// Leif ran it on Emma, got "Stripe synced — no new Stripe records", and
// reasonably read that as "Stripe has nothing for this client". It never
// meant that. It meant this RUN found nothing new — a statement about the
// run, not about Stripe — and it was chosen ahead of several other things
// the same run does. A sync links customers, links plans, derives totals
// and ingests money; it now says which of those happened.

const invoke = vi.hoisted(() => vi.fn());

vi.mock("../providers/supabase/supabase", () => ({
  getSupabaseClient: () => ({ functions: { invoke } }),
}));

const { syncStripeForContact } = await import("./syncStripe");

const delta = (over: Record<string, unknown> = {}) => ({
  schedulesLinked: 0,
  subscriptionsLinked: 0,
  alreadyLinked: 0,
  noStripePlan: 0,
  paymentsIngested: 0,
  planObjectsRecorded: 0,
  planObjectsUpdated: 0,
  agreedTermsDerived: 0,
  needsReview: [],
  ambiguous: [],
  errors: [],
  ...over,
});

const respond = (over: Record<string, unknown> = {}) => {
  invoke.mockResolvedValue({ data: { delta: delta(over) }, error: null });
};

beforeEach(() => {
  invoke.mockReset();
});

describe("what the sync reports", () => {
  it("names every dimension that changed, not just the first", async () => {
    // Arrange — the run that fixes an Emma: a plan linked, and the total
    // that plan proves.
    respond({
      schedulesLinked: 1,
      agreedTermsDerived: 1,
      planObjectsRecorded: 1,
    });

    // Act
    const result = await syncStripeForContact(7);

    // Assert
    expect(result.status).toBe("linked");
    expect(result.message).toContain("new plan linked");
    expect(result.message).toContain("agreed total from Stripe");
    expect(result.message).toContain("plan details updated");
  });

  it("counts payments in the person's own words", async () => {
    respond({ paymentsIngested: 1 });
    expect((await syncStripeForContact(7)).message).toContain("1 payment ");

    respond({ paymentsIngested: 3 });
    expect((await syncStripeForContact(7)).message).toContain("3 payments ");
  });

  it("says it is up to date rather than that there are no records", async () => {
    // Arrange — the exact case Leif hit on his second sync.
    respond({ alreadyLinked: 1 });

    // Act
    const result = await syncStripeForContact(7);

    // Assert — a statement about agreement with Stripe, which is what it
    // actually checked. Never "no records", which it never established.
    expect(result.status).toBe("already-linked");
    expect(result.message).toBe(
      "Stripe synced — already up to date with Stripe.",
    );
    expect(result.message).not.toContain("no new");
  });

  it("says nothing was found only when nothing was found", async () => {
    respond({ noStripePlan: 1 });
    const result = await syncStripeForContact(7);
    expect(result.status).toBe("none-found");
    expect(result.message).toContain("no Stripe records found for this person");
  });

  it("puts a review ahead of the good news", async () => {
    respond({
      schedulesLinked: 1,
      needsReview: [{ contactId: 7, reason: "Two plans could be this one." }],
    });
    const result = await syncStripeForContact(7);
    expect(result.status).toBe("needs-review");
    expect(result.message).toBe("Two plans could be this one.");
  });

  it("refuses an id that is not one, without calling anything", async () => {
    const result = await syncStripeForContact("not-a-number");
    expect(result.status).toBe("error");
    expect(invoke).not.toHaveBeenCalled();
  });
});
