import { describe, expect, test } from "vitest";

import type { SalesCall } from "../types";

// A resolved call must stop asking to be resolved.
//
// Leif recorded Megan Auron's call as a no-show. The call took it, the
// resolution route correctly said "already resolved", and the Dashboard
// went on offering Resolve — because the resolve_sales_call Task was never
// closed. Task truth outlived Sales Call truth.
//
// These mirror public.sales_call_is_resolved() and the reconcile's own
// condition. The real enforcement is in the database, deliberately: the
// production no-show path returns as soon as the data provider offers the
// RPC, so the task-closing code in recordSalesCallNoShow.ts never runs
// there. The old tests passed because they exercise the FakeRest fallback
// — the branch production never takes.

const call = (overrides: Partial<SalesCall> = {}): SalesCall =>
  ({
    id: 1,
    contact_id: 1,
    opportunity_id: 1,
    status: "booked",
    attendance: null,
    dismissed_at: null,
    scheduled_at: "2026-09-17T18:00:00Z",
    resolution_requested_at: "2026-09-10T18:00:00Z",
    ...overrides,
  }) as SalesCall;

// public.sales_call_is_resolved(attendance, status, dismissed_at)
const isResolved = (c: SalesCall) =>
  c.attendance != null || c.dismissed_at != null || c.status === "cancelled";

// The reconcile's create side, including the past-tense rule.
const needsResolveTask = (c: SalesCall, now: string) =>
  c.resolution_requested_at != null &&
  !isResolved(c) &&
  new Date(c.scheduled_at ?? 0) < new Date(now);

const NOW = "2026-09-19T18:00:00Z";

describe("what counts as a resolved call", () => {
  test("every canonical answer resolves it", () => {
    // Assert — the three answers the resolution screen offers.
    expect(
      isResolved(call({ attendance: "attended", status: "completed" })),
    ).toBe(true);
    expect(
      isResolved(call({ attendance: "no_show", status: "completed" })),
    ).toBe(true);
    expect(isResolved(call({ status: "cancelled" }))).toBe(true);
  });

  test("an explicit dismissal resolves it", () => {
    expect(isResolved(call({ dismissed_at: "2026-09-18T00:00:00Z" }))).toBe(
      true,
    );
  });

  test("a booked call with no attendance is not resolved", () => {
    expect(isResolved(call())).toBe(false);
  });
});

describe("the projection follows the call", () => {
  test("Megan's shape: a no-show call wants no open task", () => {
    // Arrange — exactly production call 108.
    const megan = call({ attendance: "no_show", status: "completed" });

    // Assert
    expect(isResolved(megan)).toBe(true);
    expect(needsResolveTask(megan, NOW)).toBe(false);
  });

  test("an attended call wants no open task either", () => {
    expect(
      needsResolveTask(
        call({ attendance: "attended", status: "completed" }),
        NOW,
      ),
    ).toBe(false);
  });

  test("a cancelled call wants no open task", () => {
    expect(needsResolveTask(call({ status: "cancelled" }), NOW)).toBe(false);
  });

  test("an established, unanswered, past call wants exactly one", () => {
    expect(needsResolveTask(call(), NOW)).toBe(true);
  });

  test("a call that has not happened yet is not an open question", () => {
    // Arrange — six production calls were established as questions once,
    // answered, and are now booked for mid-October. Without this they
    // would each come back asking what happened on a call three weeks
    // away.
    const upcoming = call({ scheduled_at: "2026-10-15T18:00:00Z" });

    // Assert
    expect(isResolved(upcoming)).toBe(false);
    expect(needsResolveTask(upcoming, NOW)).toBe(false);
  });

  test("a call nobody established as a question never gets one", () => {
    // Arrange — 166 calls have no attendance because the import recorded
    // their result as pipeline stage. Deriving questions from "attendance
    // is null" would bury the handful of real ones.
    const historical = call({ resolution_requested_at: null });

    // Assert
    expect(needsResolveTask(historical, NOW)).toBe(false);
  });

  test("correcting a resolved call back to unresolved reopens the question", () => {
    // Arrange — the authorized correction route.
    const reinstated = call({ attendance: null, status: "booked" });

    // Assert
    expect(needsResolveTask(reinstated, NOW)).toBe(true);
  });
});
