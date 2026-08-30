import { describe, expect, test } from "vitest";
import { isPersonDeciding } from "./peopleDeciding";

const base = {
  prospect_decision: "thinking",
  owner_decision: "would_work_with",
  stage: "decision",
  outcome: null,
};

describe("isPersonDeciding", () => {
  test("includes an active, thinking prospect the owner would work with", () => {
    expect(isPersonDeciding(base)).toBe(true);
  });

  test("excludes prospects who are not Thinking", () => {
    expect(isPersonDeciding({ ...base, prospect_decision: "yes" })).toBe(false);
    expect(isPersonDeciding({ ...base, prospect_decision: null })).toBe(false);
  });

  test("excludes Won opportunities", () => {
    expect(isPersonDeciding({ ...base, stage: "won" })).toBe(false);
  });

  test("excludes exited opportunities (any outcome set)", () => {
    expect(isPersonDeciding({ ...base, outcome: "lost" })).toBe(false);
    expect(isPersonDeciding({ ...base, outcome: "not_fit" })).toBe(false);
  });

  test("excludes opportunities the owner would not work on", () => {
    expect(
      isPersonDeciding({ ...base, owner_decision: "workshops_only" }),
    ).toBe(false);
    expect(isPersonDeciding({ ...base, owner_decision: null })).toBe(false);
  });
});
