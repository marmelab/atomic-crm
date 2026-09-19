import { describe, expect, it } from "vitest";

import {
  needsNextSalesStep,
  opportunitiesNeedingNextSalesStep,
} from "./needsNextSalesStep";
import type { SalesCallForSelection } from "../sales-calls/salesCallSelection";

// A no-show used to set outcome = 'lost', which ended the sale
// automatically. Alva Winsa is still terminal because of it. Removing that
// leaves a real question open — somebody has to decide what happens next —
// and this is where that question lives.
//
// It is DERIVED, never stored. A task may project it; deleting the task
// must not make the person stop waiting on a decision.

const deal = (overrides = {}) => ({
  id: 1,
  stage: "call_booked",
  outcome: null as string | null,
  archived_at: null as string | null,
  ...overrides,
});

const call = (
  overrides: Partial<SalesCallForSelection> = {},
): SalesCallForSelection => ({
  id: 1,
  opportunity_id: 1,
  status: "completed",
  attendance: null,
  scheduled_at: "2026-09-10T15:00:00.000Z",
  scheduled_on: "2026-09-10",
  ...overrides,
});

describe("who is waiting on a decision about the next sales step", () => {
  it("surfaces an active attempt whose last call was cancelled", () => {
    // Arrange — Aurelie's and Susan's shape.
    // Act
    const reason = needsNextSalesStep(deal({ stage: "approved" }), [
      call({ status: "cancelled" }),
    ]);

    // Assert
    expect(reason).toBe("call_cancelled");
  });

  it("surfaces an active attempt whose last call was a no-show", () => {
    // Arrange / Act
    const reason = needsNextSalesStep(deal({ stage: "approved" }), [
      call({ attendance: "no_show" }),
    ]);

    // Assert
    expect(reason).toBe("call_no_show");
  });

  it("goes quiet on its own once a genuine rebooking exists", () => {
    // Arrange — nothing clears this condition; its premise simply stops
    // being true.
    // Act
    const reason = needsNextSalesStep(deal(), [
      call({ attendance: "no_show" }),
      call({
        id: 2,
        status: "booked",
        scheduled_at: "2026-10-01T15:00:00.000Z",
        scheduled_on: "2026-10-01",
      }),
    ]);

    // Assert
    expect(reason).toBeNull();
  });

  it("says nothing about an attempt that already ended", () => {
    // Arrange — the 18 historical call_booked + lost rows must not all
    // start demanding a decision.
    // Act
    const reason = needsNextSalesStep(deal({ outcome: "lost" }), [
      call({ attendance: "no_show" }),
    ]);

    // Assert
    expect(reason).toBeNull();
  });

  it("says nothing about a won attempt", () => {
    // Arrange / Act
    const reason = needsNextSalesStep(deal({ stage: "won" }), [
      call({ attendance: "no_show" }),
    ]);

    // Assert
    expect(reason).toBeNull();
  });

  it("says nothing when the call simply happened", () => {
    // Arrange / Act
    const reason = needsNextSalesStep(deal(), [
      call({ attendance: "attended" }),
    ]);

    // Assert
    expect(reason).toBeNull();
  });

  it("reads a cancelled call as cancelled even if it also says no_show", () => {
    // Arrange — the meeting was called off, so nobody failed to attend.
    // Act
    const reason = needsNextSalesStep(deal(), [
      call({ status: "cancelled", attendance: "no_show" }),
    ]);

    // Assert
    expect(reason).toBe("call_cancelled");
  });
});

describe("the whole working set at once", () => {
  it("names each waiting Opportunity and why", () => {
    // Arrange
    const deals = [
      deal({ id: 1, stage: "approved" }),
      deal({ id: 2, stage: "approved" }),
      deal({ id: 3, stage: "call_booked" }),
      deal({ id: 4, outcome: "nurture" }),
    ];
    const calls = [
      call({ id: 10, opportunity_id: 1, status: "cancelled" }),
      call({ id: 20, opportunity_id: 2, attendance: "no_show" }),
      call({ id: 30, opportunity_id: 3, status: "booked" }),
      call({ id: 40, opportunity_id: 4, attendance: "no_show" }),
    ];

    // Act
    const needs = opportunitiesNeedingNextSalesStep(deals, calls);

    // Assert — the booked one is fine, the ended one is not our business.
    expect(needs.map((n) => n.opportunityId)).toEqual(["1", "2"]);
    expect(needs.map((n) => n.reason)).toEqual([
      "call_cancelled",
      "call_no_show",
    ]);
    expect(needs[0].salesCallId).toBe("10");
  });

  it("is empty rather than undefined when nothing is waiting", () => {
    // Arrange / Act / Assert
    expect(opportunitiesNeedingNextSalesStep([], [])).toEqual([]);
    expect(opportunitiesNeedingNextSalesStep(undefined, undefined)).toEqual([]);
  });

  it("cannot be emptied by removing a task, because it reads no tasks", () => {
    // Arrange — the condition is computed from Opportunities and calls
    // only. There is deliberately no task input to forget or delete.
    const deals = [deal({ id: 1, stage: "approved" })];
    const calls = [call({ id: 10, opportunity_id: 1, status: "cancelled" })];

    // Act — the same inputs, twice, with nothing cleared in between.
    const first = opportunitiesNeedingNextSalesStep(deals, calls);
    const second = opportunitiesNeedingNextSalesStep(deals, calls);

    // Assert
    expect(first).toEqual(second);
    expect(second).toHaveLength(1);
  });
});
