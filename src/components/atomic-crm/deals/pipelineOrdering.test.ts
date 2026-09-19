import { describe, expect, it } from "vitest";

import {
  comparatorForStage,
  inconsistentCallBookedDeals,
  nextBookedCallByOpportunity,
  ORDERING_RULE_LABELS,
  type SalesCallForOrdering,
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

let nextCallId = 1;

const call = (
  opportunityId: number,
  scheduledAt: string,
  status: SalesCall["status"] = "booked",
): SalesCallForOrdering => ({
  // The canonical selector identifies calls by id (it is how ties break
  // and how `current` is excluded from history), so fixtures carry one.
  id: nextCallId++,
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

describe("Decision — what still needs a decision comes first", () => {
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

  it("ranks having no plan at all above a plan already made", () => {
    // A future follow-up means this attempt HAS a next action. One with
    // no follow-up has none, and nobody has chosen one — which is the
    // work this column exists to surface.
    const deals = [
      deal({ id: 1, stage: "decision", follow_up_date: null }),
      deal({ id: 2, stage: "decision", follow_up_date: "2026-12-31" }),
    ];

    expect(order("decision", deals)).toEqual([1, 2]);
  });

  // NOW is 2026-09-18T12:00Z, which is 2026-09-18 in the CRM's own
  // timezone — so "today" below means the 18th.
  it("puts a broken promise above one that is merely upcoming", () => {
    const deals = [
      deal({ id: 1, stage: "decision", follow_up_date: "2026-09-19" }),
      deal({ id: 2, stage: "decision", follow_up_date: "2026-09-10" }),
    ];

    expect(order("decision", deals)).toEqual([2, 1]);
  });

  it("orders overdue follow-ups oldest first — longest broken, loudest", () => {
    const deals = [
      deal({ id: 1, stage: "decision", follow_up_date: "2026-09-15" }),
      deal({ id: 2, stage: "decision", follow_up_date: "2026-07-02" }),
      deal({ id: 3, stage: "decision", follow_up_date: "2026-08-20" }),
    ];

    expect(order("decision", deals)).toEqual([2, 3, 1]);
  });

  it("runs overdue, then today, then unscheduled, then upcoming", () => {
    const deals = [
      deal({ id: 1, stage: "decision", follow_up_date: "2026-09-19" }),
      deal({ id: 2, stage: "decision", follow_up_date: "2026-09-18" }),
      deal({ id: 3, stage: "decision", follow_up_date: "2026-09-17" }),
      deal({ id: 4, stage: "decision", follow_up_date: null }),
    ];

    expect(order("decision", deals)).toEqual([3, 2, 4, 1]);
  });

  it("due today outranks an Opportunity with nothing scheduled", () => {
    const deals = [
      deal({
        id: 1,
        stage: "decision",
        follow_up_date: null,
        // Waiting far longer, and still below a promise owed today.
        stage_entered_at: "2026-01-01T00:00:00.000Z",
      }),
      deal({ id: 2, stage: "decision", follow_up_date: "2026-09-18" }),
    ];

    expect(order("decision", deals)).toEqual([2, 1]);
  });

  it("an overdue follow-up outranks every later band", () => {
    const deals = [
      deal({ id: 1, stage: "decision", follow_up_date: "2026-09-25" }),
      deal({
        id: 2,
        stage: "decision",
        follow_up_date: null,
        stage_entered_at: "2026-01-01T00:00:00.000Z",
      }),
      deal({ id: 3, stage: "decision", follow_up_date: "2026-09-18" }),
      deal({ id: 4, stage: "decision", follow_up_date: "2026-08-01" }),
    ];

    expect(order("decision", deals)).toEqual([4, 3, 2, 1]);
  });

  it("reads the follow-up day in the CRM's timezone, not the server's", () => {
    // 2026-09-18T12:00Z is still the 18th in America/Denver (06:00), so a
    // follow-up dated the 18th is due TODAY, never already overdue.
    const deals = [
      deal({ id: 1, stage: "decision", follow_up_date: "2026-09-18" }),
      deal({ id: 2, stage: "decision", follow_up_date: "2026-09-17" }),
    ];

    expect(order("decision", deals)).toEqual([2, 1]);
  });

  it("compares calendar days even when a value arrives as a timestamp", () => {
    // Follow-up timing lives on the Opportunity; the follow-up Task
    // projects it and stores a time of day. If a timestamp ever reaches
    // this field, the hour must not decide the order — only the day.
    const deals = [
      deal({
        id: 1,
        stage: "decision",
        follow_up_date: "2026-09-25T23:00:00.000Z" as Deal["follow_up_date"],
      }),
      deal({ id: 2, stage: "decision", follow_up_date: "2026-09-25" }),
      deal({ id: 3, stage: "decision", follow_up_date: "2026-09-24" }),
    ];

    // 3 first on its earlier day; 1 and 2 share a day, so the tie falls to
    // longest-waiting and then to id, never to the 23:00.
    expect(order("decision", deals)).toEqual([3, 2, 1]);
  });

  // The acceptance case, with synthetic stand-ins. Leif saw one person
  // with a future follow-up sitting above two who had been in Decision for
  // a month with nothing scheduled at all.
  it("regression: the two nobody has planned for come above the one who is handled", () => {
    const gil = deal({
      id: 186,
      stage: "decision",
      follow_up_date: "2026-09-22",
      stage_entered_at: "2026-09-18T02:23:46.000Z",
    });
    const bess = deal({
      id: 105,
      stage: "decision",
      follow_up_date: null,
      stage_entered_at: "2026-08-20T00:00:00.000Z",
    });
    const gianina = deal({
      id: 98,
      stage: "decision",
      follow_up_date: null,
      stage_entered_at: "2026-08-21T00:00:00.000Z",
    });

    // The unscheduled pair first, longest waiting of them leading, and
    // Gil last because the 22nd is already arranged.
    expect(order("decision", [gianina, bess, gil])).toEqual([105, 98, 186]);
  });

  it("regression: once that follow-up is overdue, Gil comes back to the top", () => {
    // The same two, read a week later. Gil's promise is now BROKEN, which
    // is a different thing from planned — band 0, above the unscheduled
    // one. Being handled only outranks being unhandled while the plan
    // still holds.
    const later = new Date("2026-09-29T12:00:00.000Z").getTime();
    const deals = [
      deal({
        id: 105,
        stage: "decision",
        follow_up_date: null,
        stage_entered_at: "2026-08-20T00:00:00.000Z",
      }),
      deal({
        id: 186,
        stage: "decision",
        follow_up_date: "2026-09-22",
        stage_entered_at: "2026-09-18T02:23:46.000Z",
      }),
    ];

    const sorted = [...deals].sort(
      comparatorForStage("decision", { nextCallAt: new Map(), now: later }),
    );
    expect(sorted.map((d) => d.id)).toEqual([186, 105]);
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

describe("a Call Booked card with no booked call behind it", () => {
  it("is reported as inconsistent rather than silently ordered", () => {
    // Arrange — the stage asserts a booked call. When there is none the
    // card used to fall into the "no booking" band and take an id-based
    // position that looks exactly like a legitimate order.
    const withCall = deal({ id: 1, stage: "call_booked" });
    const withoutCall = deal({ id: 2, stage: "call_booked" });
    const calls = [call(1, "2026-09-20T15:00:00.000Z")];
    const nextCallAt = nextBookedCallByOpportunity(calls);

    // Act
    const inconsistent = inconsistentCallBookedDeals(
      [withCall, withoutCall],
      nextCallAt,
    );

    // Assert
    expect(inconsistent.map((d) => d.id)).toEqual([2]);
  });

  it("sorts after every card that does have one", () => {
    // Arrange — deterministic, and deterministically LAST.
    const soon = deal({ id: 1, stage: "call_booked" });
    const later = deal({ id: 2, stage: "call_booked" });
    const none = deal({ id: 99, stage: "call_booked" });
    const calls = [
      call(1, "2026-09-20T15:00:00.000Z"),
      call(2, "2026-09-25T15:00:00.000Z"),
    ];

    // Act
    const ordered = order("call_booked", [none, later, soon], calls);

    // Assert — the inconsistent card cannot reach the top of the column by
    // having the highest id.
    expect(ordered).toEqual([1, 2, 99]);
  });

  it("treats a cancelled call as no booking at all", () => {
    // Arrange — cancelling frees the booked slot, so the stage is now
    // asserting something untrue and the card is inconsistent.
    const cancelledOnly = deal({ id: 5, stage: "call_booked" });
    const calls = [call(5, "2026-09-20T15:00:00.000Z", "cancelled")];

    // Act
    const nextCallAt = nextBookedCallByOpportunity(calls);

    // Assert
    expect(nextCallAt.has("5")).toBe(false);
    expect(
      inconsistentCallBookedDeals([cancelledOnly], nextCallAt).map((d) => d.id),
    ).toEqual([5]);
  });

  it("uses the LATER booking once a rebooking exists", () => {
    // Arrange — a no-show followed by a genuine rebooking. The board must
    // order by the call that is actually going to happen.
    const rebooked = deal({ id: 7, stage: "call_booked" });
    const calls = [
      call(7, "2026-09-10T15:00:00.000Z", "completed"),
      call(7, "2026-09-28T15:00:00.000Z"),
    ];

    // Act
    const nextCallAt = nextBookedCallByOpportunity(calls);

    // Assert — the concluded call is history; the booked one is the order.
    expect(nextCallAt.get("7")).toBe("2026-09-28T15:00:00.000Z");
    expect(inconsistentCallBookedDeals([rebooked], nextCallAt)).toEqual([]);
  });
});
