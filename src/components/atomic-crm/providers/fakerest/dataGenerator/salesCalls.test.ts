import { describe, expect, it } from "vitest";

import type { Deal } from "../../../types";
import { backfillSalesCallsForCallLifecycleDeals } from "./salesCalls";
import type { Db } from "./types";

const buildDb = (deals: Deal[]): Db =>
  ({
    deals,
    sales_calls: [],
    sales_call_events: [],
  }) as unknown as Db;

const buildDeal = (
  overrides: Partial<Deal> & Pick<Deal, "id" | "stage">,
): Deal => ({
  pricing_mode: "standard",
  name: "Test Person — The Living Example",
  contact_id: 1,
  offer_id: 1,
  outcome: null,
  owner_decision: null,
  prospect_decision: null,
  amount: 4000,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-20T00:00:00.000Z",
  sales_id: 0,
  index: 0,
  stage_entered_at: "2026-08-20T00:00:00.000Z",
  ...overrides,
});

describe("backfillSalesCallsForCallLifecycleDeals", () => {
  it("gives a Call Booked deal a booked sales_calls record with no attendance yet", () => {
    const deal = buildDeal({ id: 1, stage: "call_booked" });
    const db = buildDb([deal]);

    backfillSalesCallsForCallLifecycleDeals(db);

    expect(db.sales_calls).toHaveLength(1);
    expect(db.sales_calls[0].opportunity_id).toBe(1);
    expect(db.sales_calls[0].status).toBe("booked");
    expect(db.sales_calls[0].attendance).toBeUndefined();
    expect(db.deals[0].sales_call_at).toBe(db.sales_calls[0].scheduled_at);
  });

  it("gives a Committed deal an attended sales_calls record and backfills the missing decision", () => {
    const deal = buildDeal({ id: 1, stage: "committed" });
    const db = buildDb([deal]);

    backfillSalesCallsForCallLifecycleDeals(db);

    expect(db.sales_calls[0].attendance).toBe("attended");
    expect(db.deals[0].owner_decision).toBe("would_work_with");
    expect(db.deals[0].prospect_decision).toBe("yes");
  });

  it("gives a Decision deal a thinking decision and a follow-up date", () => {
    const deal = buildDeal({ id: 1, stage: "decision" });
    const db = buildDb([deal]);

    backfillSalesCallsForCallLifecycleDeals(db);

    expect(db.deals[0].owner_decision).toBe("would_work_with");
    expect(db.deals[0].prospect_decision).toBe("thinking");
    expect(db.deals[0].follow_up_date).toBeTruthy();
  });

  it("never overwrites a deal that already has its own owner_decision", () => {
    const deal = buildDeal({
      id: 1,
      stage: "committed",
      owner_decision: "workshops_only",
      prospect_decision: null,
    });
    const db = buildDb([deal]);

    backfillSalesCallsForCallLifecycleDeals(db);

    expect(db.deals[0].owner_decision).toBe("workshops_only");
    expect(db.deals[0].prospect_decision).toBeNull();
    // Still gets a sales_calls record — only the decision fields are
    // protected from being overwritten.
    expect(db.sales_calls).toHaveLength(1);
  });

  it("never creates a second sales_calls record for a deal that already has one", () => {
    const deal = buildDeal({ id: 1, stage: "call_booked" });
    const db = buildDb([deal]);
    db.sales_calls.push({
      id: 0,
      opportunity_id: 1,
      contact_id: 1,
      status: "booked",
      original_scheduled_at: "2026-09-01T00:00:00.000Z",
      scheduled_at: "2026-09-01T00:00:00.000Z",
      reschedule_count: 0,
      source: "manual",
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    });

    backfillSalesCallsForCallLifecycleDeals(db);

    expect(db.sales_calls).toHaveLength(1);
  });

  it("leaves an Approved (pre-call) deal alone entirely", () => {
    const deal = buildDeal({ id: 1, stage: "approved" });
    const db = buildDb([deal]);

    backfillSalesCallsForCallLifecycleDeals(db);

    expect(db.sales_calls).toHaveLength(0);
    expect(db.deals[0].sales_call_at).toBeUndefined();
  });
});
