import { describe, expect, it } from "vitest";

import {
  DECIDING_STAGE,
  hasStatedDeciding,
  isPersonDeciding,
} from "./peopleDeciding";

// The bug these tests now guard: the Dashboard and the Pipeline disagreed
// about who is deciding. The Pipeline's Decision column showed 8 people; the
// Dashboard said "Nobody is currently deciding". One definition now, based
// on the stage — the fact that is always recorded.
describe("isPersonDeciding", () => {
  const base = { stage: DECIDING_STAGE, outcome: null, archived_at: null };

  it("is true for a live Opportunity at the Decision stage", () => {
    expect(isPersonDeciding(base)).toBe(true);
  });

  it("does not require the optional decision fields to be filled in", () => {
    // This is the regression. Every imported Opportunity has these unset —
    // requiring them emptied the Dashboard while the Pipeline stayed full.
    expect(
      isPersonDeciding({
        ...base,
        prospect_decision: null,
        owner_decision: null,
      } as Parameters<typeof isPersonDeciding>[0]),
    ).toBe(true);
  });

  it("is false at any other stage", () => {
    for (const stage of [
      "interested",
      "application_received",
      "call_booked",
      "committed",
      "won",
    ]) {
      expect(isPersonDeciding({ ...base, stage })).toBe(false);
    }
  });

  it("is false once an exit outcome closes the loop", () => {
    expect(isPersonDeciding({ ...base, outcome: "lost" })).toBe(false);
    expect(isPersonDeciding({ ...base, outcome: "nurture" })).toBe(false);
    expect(isPersonDeciding({ ...base, outcome: "not_fit" })).toBe(false);
  });

  it("is false for an archived Opportunity", () => {
    expect(
      isPersonDeciding({ ...base, archived_at: "2026-01-01T00:00:00.000Z" }),
    ).toBe(false);
  });
});

// Kept as display colour, deliberately no longer a filter.
describe("hasStatedDeciding", () => {
  it("is true only when the prospect said they are thinking and Leif would work with them", () => {
    expect(
      hasStatedDeciding({
        prospect_decision: "thinking",
        owner_decision: "would_work_with",
      }),
    ).toBe(true);
  });

  it("is false when either half is missing or different", () => {
    expect(
      hasStatedDeciding({
        prospect_decision: "thinking",
        owner_decision: null,
      }),
    ).toBe(false);
    expect(
      hasStatedDeciding({
        prospect_decision: null,
        owner_decision: "would_work_with",
      }),
    ).toBe(false);
    expect(
      hasStatedDeciding({
        prospect_decision: "yes",
        owner_decision: "would_work_with",
      }),
    ).toBe(false);
    expect(
      hasStatedDeciding({
        prospect_decision: "thinking",
        owner_decision: "workshops_only",
      }),
    ).toBe(false);
  });
});
