import { describe, expect, test } from "vitest";
import { describeCohortThreshold } from "./cohortThreshold";

describe("describeCohortThreshold", () => {
  test("below minimum", () => {
    expect(
      describeCohortThreshold({
        enrolled: 2,
        minimum: 5,
        target: 10,
        maximum: 10,
      }),
    ).toBe("below_minimum");
  });

  test("minimum reached", () => {
    expect(
      describeCohortThreshold({
        enrolled: 6,
        minimum: 5,
        target: 10,
        maximum: 10,
      }),
    ).toBe("minimum_reached");
  });

  test("target reached", () => {
    expect(
      describeCohortThreshold({
        enrolled: 10,
        minimum: 5,
        target: 10,
        maximum: 12,
      }),
    ).toBe("target_reached");
  });

  test("full", () => {
    expect(
      describeCohortThreshold({
        enrolled: 12,
        minimum: 5,
        target: 10,
        maximum: 12,
      }),
    ).toBe("full");
  });

  test("unknown when no thresholds are set", () => {
    expect(describeCohortThreshold({ enrolled: 3 })).toBe("unknown");
  });
});
