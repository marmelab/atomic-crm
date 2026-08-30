import { describe, expect, test } from "vitest";
import { classifyCohortOpportunity } from "./cohortCapacity";

describe("classifyCohortOpportunity", () => {
  test("active enrollment lifecycle statuses occupy a seat", () => {
    for (const status of ["onboarding", "active", "offboarding"] as const) {
      expect(
        classifyCohortOpportunity({
          stage: "won",
          enrollment: { status },
        }),
      ).toBe("enrolled");
    }
  });

  test("a completed enrollment does not occupy active capacity", () => {
    expect(
      classifyCohortOpportunity({
        stage: "won",
        enrollment: { status: "completed" },
      }),
    ).toBe("other");
  });

  test("a still-selling opportunity with no enrollment is in sales", () => {
    expect(
      classifyCohortOpportunity({ stage: "call_booked", outcome: null }),
    ).toBe("in_sales");
  });

  test("Won without an enrollment yet is excluded from in sales", () => {
    expect(classifyCohortOpportunity({ stage: "won" })).toBe("other");
  });

  test("an exited opportunity (has an outcome) is excluded from in sales", () => {
    expect(
      classifyCohortOpportunity({ stage: "decision", outcome: "lost" }),
    ).toBe("other");
  });

  test("a rejected Application excludes the opportunity from in sales", () => {
    expect(
      classifyCohortOpportunity({
        stage: "application_received",
        hasRejectedApplication: true,
      }),
    ).toBe("other");
  });

  test("a pending Application still allows in sales", () => {
    expect(
      classifyCohortOpportunity({
        stage: "application_received",
        hasRejectedApplication: false,
      }),
    ).toBe("in_sales");
  });

  test("an approved Application still allows in sales", () => {
    expect(
      classifyCohortOpportunity({
        stage: "approved",
        hasRejectedApplication: false,
      }),
    ).toBe("in_sales");
  });

  test("a rejected Application does not override an active Enrollment", () => {
    expect(
      classifyCohortOpportunity({
        stage: "won",
        enrollment: { status: "active" },
        hasRejectedApplication: true,
      }),
    ).toBe("enrolled");
  });
});
