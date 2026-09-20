import { describe, expect, it } from "vitest";

import {
  salesCallTaskIsWarranted,
  salesCallTaskQuestion,
  RESOLVE_SALES_CALL_TASK_TYPE,
  SALES_CALL_NEEDS_MATCHING_TASK_TYPE,
} from "./salesCallTaskTypes";
import { classifyTaskActionKind } from "../tasks/taskActionDestination";
import { describeTaskKind } from "../tasks/needsAttentionInventory";
import type { SalesCall } from "../types";

// Four real Acuity bookings — 29 October, 30 October, 3 November, 10
// November — reached the Dashboard under NEEDS ATTENTION asking "What
// happened on this call?" Nothing had happened on any of them.
//
// Three separate confusions produced that, and these hold each one shut:
//
//   1. A future call is not an attendance question.
//   2. "Whose booking is this?" is not "what happened on it?"
//   3. A booked appointment is not work at all.
//
// The authority is the SQL rule (public.sales_call_open_question, enforced
// in both directions by reconcile_sales_call_tasks); this is its app-side
// mirror, and these are the cases both must agree on.

const NOW = new Date("2026-09-20T12:00:00.000Z");
const FUTURE = "2026-11-10T18:00:00.000Z";
const PAST = "2026-08-01T18:30:00.000Z";

type CallFields = Parameters<typeof salesCallTaskQuestion>[0];

const call = (over: Partial<CallFields> = {}): CallFields =>
  ({
    opportunity_id: 266,
    dismissed_at: null,
    attendance: null,
    status: "booked",
    scheduled_at: FUTURE,
    scheduled_on: FUTURE.slice(0, 10),
    resolution_requested_at: null,
    ...over,
  }) as CallFields;

describe("a call still to come", () => {
  it("asks nothing at all when it is already attributed", () => {
    // Mihaela Petrova's booking after Leif matched it: attached, weeks
    // away, nothing outstanding.
    expect(salesCallTaskQuestion(call(), NOW)).toBe("none");
  });

  it("asks whose booking it is when it is not attributed", () => {
    // Anna Howard, Samantha Herold and Celia: real future bookings with no
    // compatible active Opportunity to attach to.
    expect(salesCallTaskQuestion(call({ opportunity_id: null }), NOW)).toBe(
      "matching",
    );
  });

  it("never asks what happened on it, attributed or not", () => {
    for (const opportunity_id of [266, null]) {
      expect(
        salesCallTaskIsWarranted(
          RESOLVE_SALES_CALL_TASK_TYPE,
          call({ opportunity_id }),
          NOW,
        ),
      ).toBe(false);
    }
  });

  it("is not made into a question by somebody asking for one", () => {
    // resolution_requested_at is deliberate, but it cannot make a meeting
    // that has not happened into a meeting whose outcome is unknown.
    expect(
      salesCallTaskQuestion(
        call({ resolution_requested_at: "2026-09-20T15:17:05.293Z" }),
        NOW,
      ),
    ).toBe("none");
  });

  it("treats a manually logged future call exactly the same way", () => {
    // bookSalesCall only sets resolution_requested_at for a past time, so
    // a future manual booking arrives here identical to an Acuity one.
    expect(salesCallTaskQuestion(call({ scheduled_at: FUTURE }), NOW)).toBe(
      "none",
    );
  });
});

describe("a call whose time has passed", () => {
  const passed = (over: Partial<CallFields> = {}) =>
    call({
      scheduled_at: PAST,
      scheduled_on: PAST.slice(0, 10),
      ...over,
    });

  it("asks what happened once somebody establishes that nobody knows", () => {
    // Dax Kara's backfilled call of 1 August.
    expect(
      salesCallTaskQuestion(
        passed({ resolution_requested_at: "2026-09-20T15:05:04.568Z" }),
        NOW,
      ),
    ).toBe("attendance");
  });

  it("stays silent when nobody did", () => {
    // The 109 imported calls whose result was recorded as pipeline stage.
    // Deriving a question from "attendance is null" would bury the real
    // ones under a hundred invented alerts.
    expect(salesCallTaskQuestion(passed(), NOW)).toBe("none");
  });

  it.each([
    ["an attended call", { attendance: "attended" }],
    ["a no-show", { attendance: "no_show" }],
    ["a cancellation", { status: "cancelled" }],
    ["a dismissed booking", { dismissed_at: "2026-09-01T00:00:00.000Z" }],
  ])("stops asking once %s answers it", (_label, over) => {
    expect(
      salesCallTaskQuestion(
        passed({
          resolution_requested_at: "2026-09-20T15:05:04.568Z",
          ...over,
        } as Partial<CallFields>),
        NOW,
      ),
    ).toBe("none");
  });

  it("asks whose booking it is first when it belongs to nobody", () => {
    // Matching outranks attendance: the outcome pages have nothing to
    // record against an Opportunity that has not been identified.
    expect(
      salesCallTaskQuestion(
        passed({
          opportunity_id: null,
          resolution_requested_at: "2026-09-20T15:05:04.568Z",
        }),
        NOW,
      ),
    ).toBe("matching");
  });
});

describe("matching and attendance are different questions", () => {
  it("warrants exactly one type at a time, never both", () => {
    const cases: CallFields[] = [
      call({ opportunity_id: null }),
      call({
        scheduled_at: PAST,
        scheduled_on: PAST.slice(0, 10),
        resolution_requested_at: "2026-09-20T15:05:04.568Z",
      }),
      call(),
    ];
    for (const subject of cases) {
      const warranted = [
        SALES_CALL_NEEDS_MATCHING_TASK_TYPE,
        RESOLVE_SALES_CALL_TASK_TYPE,
      ].filter((type) => salesCallTaskIsWarranted(type, subject, NOW));
      expect(warranted.length).toBeLessThanOrEqual(1);
    }
  });

  it("sends each to its own screen, never to the other one", () => {
    expect(classifyTaskActionKind(SALES_CALL_NEEDS_MATCHING_TASK_TYPE)).toBe(
      "sales-call-needs-matching",
    );
    expect(classifyTaskActionKind(RESOLVE_SALES_CALL_TASK_TYPE)).toBe(
      "resolve-sales-call",
    );
  });

  it("says out loud what each one is asking", () => {
    // The Dashboard row's words come from here, so a matching row can
    // never read as an attendance question again.
    expect(
      describeTaskKind(SALES_CALL_NEEDS_MATCHING_TASK_TYPE)?.question,
    ).toBe("Which Opportunity does this booking belong to?");
    expect(describeTaskKind(RESOLVE_SALES_CALL_TASK_TYPE)?.question).toBe(
      "What happened on this call?",
    );
    expect(
      describeTaskKind(SALES_CALL_NEEDS_MATCHING_TASK_TYPE)?.actionLabel,
    ).toBe("Match");
  });
});

describe("an answered question closes", () => {
  it("stops warranting a matching task the moment the booking is attached", () => {
    // Exactly Mihaela's repair: the Opportunity arrived, so the question
    // is answered — whoever attached it, by whatever route.
    const before = call({ opportunity_id: null });
    expect(
      salesCallTaskIsWarranted(
        SALES_CALL_NEEDS_MATCHING_TASK_TYPE,
        before,
        NOW,
      ),
    ).toBe(true);

    const after = call({ opportunity_id: 266 });
    expect(
      salesCallTaskIsWarranted(SALES_CALL_NEEDS_MATCHING_TASK_TYPE, after, NOW),
    ).toBe(false);
  });

  it("never leaves an open task pointing at a screen with nothing to do", () => {
    // The invariant the loop violated: Leif clicked Resolve, the
    // destination said "This call is already resolved", and the row was
    // still there. A booking posing no question warrants no task of
    // either kind — so there is nothing left to click.
    const resolved = call({
      scheduled_at: PAST,
      scheduled_on: PAST.slice(0, 10),
      attendance: "attended",
      status: "completed",
      resolution_requested_at: "2026-09-20T15:05:04.568Z",
    });
    expect(salesCallTaskQuestion(resolved, NOW)).toBe("none");
    for (const type of [
      SALES_CALL_NEEDS_MATCHING_TASK_TYPE,
      RESOLVE_SALES_CALL_TASK_TYPE,
    ]) {
      expect(salesCallTaskIsWarranted(type, resolved, NOW)).toBe(false);
    }
  });

  it("gives the same answer however many times it is asked", () => {
    const subject = call({ opportunity_id: null });
    const answers = [1, 2, 3].map(() => salesCallTaskQuestion(subject, NOW));
    expect(new Set(answers).size).toBe(1);
  });
});

describe("the appointment itself", () => {
  it("is no longer a kind of work", () => {
    // "Sales Call: Sarah Henke — Oct 15, 2026" under Later, with nothing
    // to do but attend. Retired, and the entry stays readable so the
    // historical rows still render.
    expect(describeTaskKind("sales_call")?.origin).toBe("retired");
  });

  it("leaves matching, attendance and follow-up as the live sales-call work", () => {
    expect(describeTaskKind(SALES_CALL_NEEDS_MATCHING_TASK_TYPE)?.origin).toBe(
      "system",
    );
    expect(describeTaskKind(RESOLVE_SALES_CALL_TASK_TYPE)?.origin).toBe(
      "system",
    );
    expect(describeTaskKind("follow_up")?.origin).toBe("system");
  });

  it("is still a fact the CRM carries — this module only ever read a call", () => {
    // Nothing here mutates: retiring the projection removed a Task, never
    // a Sales Call. The type is what guarantees it.
    const subject: SalesCall = {
      id: 331,
      contact_id: 170,
      opportunity_id: 266,
      status: "booked",
      scheduled_at: FUTURE,
    } as SalesCall;
    expect(salesCallTaskQuestion(subject, NOW)).toBe("none");
    expect(subject.status).toBe("booked");
    expect(subject.scheduled_at).toBe(FUTURE);
  });
});
