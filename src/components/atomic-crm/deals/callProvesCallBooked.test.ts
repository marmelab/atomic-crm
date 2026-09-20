import { describe, expect, it } from "vitest";

import {
  callProvesBooking,
  stageContradictsItsOwnCall,
  type CallEvidence,
} from "./callProvesCallBooked";
import type { Deal } from "../types";

// Aurelie Boleor's Opportunity said `approved` while holding a real
// Acuity call marked `cancelled`. You cannot cancel a meeting you never
// booked, so one of those two statements had to give — and it is the
// stage, because a missing stage-event row is not evidence that the
// stage never happened.

const deal = (over: Partial<Deal> = {}): Deal =>
  ({
    id: 68,
    name: "Zz Sale",
    contact_id: 1,
    offer_id: 1,
    stage: "approved",
    outcome: null,
    archived_at: null,
    sales_id: 0,
    index: 0,
    pricing_mode: "standard",
    created_at: "2026-09-15T00:00:00.000Z",
    updated_at: "2026-09-15T00:00:00.000Z",
    stage_entered_at: "2026-09-15T00:00:00.000Z",
    ...over,
  }) as Deal;

const call = (over: Partial<CallEvidence> = {}): CallEvidence => ({
  opportunity_id: 68,
  status: "cancelled",
  attendance: null,
  ...over,
});

describe("what a call proves about a booking", () => {
  it.each([
    ["cancelled", { status: "cancelled" }],
    ["booked", { status: "booked" }],
    ["completed", { status: "completed" }],
    ["a no-show", { status: "completed", attendance: "no_show" }],
    ["attended", { status: "completed", attendance: "attended" }],
  ])("%s proves one existed", (_label, over) => {
    expect(callProvesBooking(call(over as Partial<CallEvidence>), 68)).toBe(
      true,
    );
  });

  it("proves nothing about an Opportunity it does not belong to", () => {
    expect(callProvesBooking(call({ opportunity_id: 999 }), 68)).toBe(false);
  });

  it("proves nothing when it belongs to no Opportunity at all", () => {
    // An unmatched Acuity booking is waiting to be told whose it is. It
    // must never move a sale on its own.
    expect(callProvesBooking(call({ opportunity_id: null }), 68)).toBe(false);
  });
});

describe("when a stage contradicts its own call", () => {
  it("catches Aurelie's case — approved, with a cancelled call", () => {
    expect(stageContradictsItsOwnCall(deal(), [call()])).toBe(true);
  });

  it("catches the same shape after a no-show", () => {
    expect(
      stageContradictsItsOwnCall(deal(), [
        call({ status: "completed", attendance: "no_show" }),
      ]),
    ).toBe(true);
  });

  it.each(["interested", "application_received", "approved"])(
    "catches it from %s",
    (stage) => {
      expect(stageContradictsItsOwnCall(deal({ stage }), [call()])).toBe(true);
    },
  );

  it("is satisfied once the stage says Call Booked", () => {
    expect(
      stageContradictsItsOwnCall(deal({ stage: "call_booked" }), [call()]),
    ).toBe(false);
  });
});

describe("what a call is not allowed to overrule", () => {
  it("leaves a sale that reached Decision where it is", () => {
    // Later human truth outranks an old call, every time.
    expect(
      stageContradictsItsOwnCall(deal({ stage: "decision" }), [call()]),
    ).toBe(false);
  });

  it("leaves Won alone", () => {
    expect(stageContradictsItsOwnCall(deal({ stage: "won" }), [call()])).toBe(
      false,
    );
  });

  it("never reopens an Opportunity that has ended", () => {
    // The forty terminal rows in this class keep the stage the sale had
    // reached when it ended. Tidying their history would overwrite a
    // real outcome with bookkeeping.
    for (const outcome of ["lost", "nurture", "not_fit", "needs_higher_care"]) {
      expect(
        stageContradictsItsOwnCall(deal({ outcome } as Partial<Deal>), [
          call(),
        ]),
      ).toBe(false);
    }
  });

  it("never touches an archived Opportunity", () => {
    expect(
      stageContradictsItsOwnCall(
        deal({ archived_at: "2026-09-01T00:00:00.000Z" } as Partial<Deal>),
        [call()],
      ),
    ).toBe(false);
  });

  it("is not moved by somebody else's call", () => {
    expect(
      stageContradictsItsOwnCall(deal(), [call({ opportunity_id: 999 })]),
    ).toBe(false);
  });

  it("is not moved by no calls at all", () => {
    expect(stageContradictsItsOwnCall(deal(), [])).toBe(false);
    expect(stageContradictsItsOwnCall(deal(), undefined)).toBe(false);
  });
});

describe("running it twice", () => {
  it("reports nothing left to do once the stage has been reconciled", () => {
    // The repair is idempotent because the predicate stops being true —
    // which is also why a second pass writes no second stage event.
    const before = deal();
    expect(stageContradictsItsOwnCall(before, [call()])).toBe(true);
    const after = deal({ stage: "call_booked" });
    expect(stageContradictsItsOwnCall(after, [call()])).toBe(false);
  });
});
