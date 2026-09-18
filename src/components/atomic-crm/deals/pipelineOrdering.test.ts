import { describe, expect, it } from "vitest";

import {
  comparatorForStage,
  nextBookedCallByOpportunity,
  ORDERING_RULE_LABELS,
} from "./pipelineOrdering";
import { getDealsByStage } from "./stages";
import type { Deal, SalesCall } from "../types";

// The board's order is the first thing Leif reads in the morning, and it
// was arbitrary: every column shared one "longest in stage first" rule, so
// Call Booked put a stale unresolved call above a call happening in two
// hours.
const NOW = new Date("2026-09-18T12:00:00.000Z").getTime();

const deal = (over: Partial<Deal> & { id: number }): Deal =>
  ({
    name: `Deal ${over.id}`,
    contact_id: over.id,
    offer_id: 1,
    stage: "call_booked",
    outcome: null,
    archived_at: null,
    amount: 4000,
    sales_id: 0,
    index: 0,
    pricing_mode: "standard",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    stage_entered_at: "2026-01-01T00:00:00.000Z",
    ...over,
  }) as Deal;

const call = (
  opportunityId: number,
  scheduledAt: string,
  status: SalesCall["status"] = "booked",
): Pick<
  SalesCall,
  "opportunity_id" | "status" | "scheduled_at" | "scheduled_on"
> => ({
  opportunity_id: opportunityId,
  status,
  scheduled_at: scheduledAt,
  scheduled_on: scheduledAt.slice(0, 10),
});

const order = (
  stage: string,
  deals: Deal[],
  calls: ReturnType<typeof call>[] = [],
): number[] =>
  [...deals]
    .sort(
      comparatorForStage(stage, {
        nextCallAt: nextBookedCallByOpportunity(calls),
        now: NOW,
      }),
    )
    .map((d) => Number(d.id));

describe("Call Booked — next call first", () => {
  it("orders nearest upcoming call to farthest", () => {
    const deals = [deal({ id: 1 }), deal({ id: 2 }), deal({ id: 3 })];
    const calls = [
      call(3, "2026-09-19T17:00:00.000Z"),
      call(1, "2026-10-16T17:00:00.000Z"),
      call(2, "2026-09-18T18:00:00.000Z"),
    ];

    expect(order("call_booked", deals, calls)).toEqual([2, 3, 1]);
  });

  // The defect this rule exists to remove.
  it("sorts a past unresolved call BELOW every future booking", () => {
    const deals = [deal({ id: 1 }), deal({ id: 2 })];
    const calls = [
      call(1, "2026-07-07T17:00:00.000Z"), // long past, never resolved
      call(2, "2026-10-16T17:00:00.000Z"), // future
    ];

    expect(order("call_booked", deals, calls)).toEqual([2, 1]);
  });

  it("puts an Opportunity with no booked call last of all", () => {
    const deals = [deal({ id: 1 }), deal({ id: 2 }), deal({ id: 3 })];
    const calls = [
      call(3, "2026-09-19T17:00:00.000Z"),
      call(1, "2026-07-07T17:00:00.000Z"),
    ];

    expect(order("call_booked", deals, calls)).toEqual([3, 1, 2]);
  });

  it("ignores cancelled calls when deciding what is next", () => {
    const deals = [deal({ id: 1 }), deal({ id: 2 })];
    const calls = [
      call(1, "2026-09-18T13:00:00.000Z", "cancelled"),
      call(2, "2026-09-25T17:00:00.000Z"),
    ];

    // 1 has no live booking, so 2 leads even though its call is later.
    expect(order("call_booked", deals, calls)).toEqual([2, 1]);
  });

  it("breaks a same-time tie deterministically", () => {
    const deals = [deal({ id: 5 }), deal({ id: 9 })];
    const calls = [
      call(5, "2026-09-19T17:00:00.000Z"),
      call(9, "2026-09-19T17:00:00.000Z"),
    ];

    expect(order("call_booked", deals, calls)).toEqual([9, 5]);
    expect(order("call_booked", [...deals].reverse(), calls)).toEqual([9, 5]);
  });
});

describe("entry stages — newest first", () => {
  it.each(["interested", "application_received", "approved"])(
    "%s puts the most recently entered first",
    (stage) => {
      const deals = [
        deal({ id: 1, stage, stage_entered_at: "2026-01-01T00:00:00.000Z" }),
        deal({ id: 2, stage, stage_entered_at: "2026-09-01T00:00:00.000Z" }),
        deal({ id: 3, stage, stage_entered_at: "2026-05-01T00:00:00.000Z" }),
      ];

      expect(order(stage, deals)).toEqual([2, 3, 1]);
    },
  );
});

describe("Decision — the promise Leif made comes first", () => {
  it("orders by soonest follow-up date", () => {
    const deals = [
      deal({ id: 1, stage: "decision", follow_up_date: "2026-09-30" }),
      deal({ id: 2, stage: "decision", follow_up_date: "2026-09-22" }),
      deal({ id: 3, stage: "decision", follow_up_date: "2026-09-25" }),
    ];

    expect(order("decision", deals)).toEqual([2, 3, 1]);
  });

  it("falls back to longest waiting when no follow-up was promised", () => {
    const deals = [
      deal({
        id: 1,
        stage: "decision",
        follow_up_date: null,
        stage_entered_at: "2026-09-01T00:00:00.000Z",
      }),
      deal({
        id: 2,
        stage: "decision",
        follow_up_date: null,
        stage_entered_at: "2026-06-01T00:00:00.000Z",
      }),
    ];

    expect(order("decision", deals)).toEqual([2, 1]);
  });

  it("ranks a promised follow-up above having promised nothing", () => {
    const deals = [
      deal({ id: 1, stage: "decision", follow_up_date: null }),
      deal({ id: 2, stage: "decision", follow_up_date: "2026-12-31" }),
    ];

    expect(order("decision", deals)).toEqual([2, 1]);
  });
});

describe("Committed — waiting longest first", () => {
  it("puts the person who said yes earliest at the top", () => {
    const deals = [
      deal({
        id: 1,
        stage: "onboarding",
        stage_entered_at: "2026-09-01T00:00:00.000Z",
      }),
      deal({
        id: 2,
        stage: "onboarding",
        stage_entered_at: "2026-06-01T00:00:00.000Z",
      }),
    ];

    expect(order("onboarding", deals)).toEqual([2, 1]);
  });
});

describe("the board applies these rules", () => {
  it("orders Call Booked by next call through getDealsByStage", () => {
    const stages = [
      { value: "interested", label: "Interested" },
      { value: "call_booked", label: "Call Booked" },
    ];
    const deals = [
      deal({ id: 1, stage: "call_booked" }),
      deal({ id: 2, stage: "call_booked" }),
      deal({ id: 3, stage: "call_booked" }),
    ];
    const calls = [
      call(1, "2026-10-16T17:00:00.000Z"),
      call(2, "2026-09-18T18:00:00.000Z"),
      call(3, "2026-09-19T17:00:00.000Z"),
    ];

    const byStage = getDealsByStage(deals, stages, calls, NOW);

    expect(byStage.call_booked.map((d) => Number(d.id))).toEqual([2, 3, 1]);
  });

  it("stays deterministic when no sales calls are supplied at all", () => {
    const stages = [{ value: "call_booked", label: "Call Booked" }];
    const deals = [deal({ id: 7 }), deal({ id: 3 }), deal({ id: 5 })];

    const byStage = getDealsByStage(deals, stages, undefined, NOW);

    expect(byStage.call_booked.map((d) => Number(d.id))).toEqual([7, 5, 3]);
  });

  it("names an ordering rule for every active column", () => {
    for (const stage of [
      "interested",
      "application_received",
      "approved",
      "call_booked",
      "decision",
      "onboarding",
    ]) {
      expect(ORDERING_RULE_LABELS[stage]).toBeTruthy();
    }
  });
});
