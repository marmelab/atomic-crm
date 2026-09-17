import { describe, expect, it } from "vitest";
import { classifyTaskActionKind } from "./taskActionDestination";

describe("classifyTaskActionKind", () => {
  it("routes review_application to application-review", () => {
    expect(classifyTaskActionKind("review_application")).toBe(
      "application-review",
    );
  });

  it.each([
    "sales_call",
    "follow_up",
    "nurture_follow_up",
    "check_payment",
    "sales_call_cancelled",
  ])("routes %s to opportunity-context", (type) => {
    expect(classifyTaskActionKind(type)).toBe("opportunity-context");
  });

  it("routes onboarding_item to enrollment-context (Contracts + Onboarding slice — retires send_contract/complete_access, which used to live in the opportunity-context set above)", () => {
    expect(classifyTaskActionKind("onboarding_item")).toBe(
      "enrollment-context",
    );
  });

  it("routes sales_call_needs_matching to the matching screen", () => {
    expect(classifyTaskActionKind("sales_call_needs_matching")).toBe(
      "sales-call-needs-matching",
    );
  });

  // The two ask different questions, so they must not share a
  // destination: production showed a "needs matching" task opening a page
  // that replied "this booking is already attached to an Opportunity".
  it("routes resolve_sales_call to the outcome screen, not the matching screen", () => {
    expect(classifyTaskActionKind("resolve_sales_call")).toBe(
      "resolve-sales-call",
    );
    expect(classifyTaskActionKind("resolve_sales_call")).not.toBe(
      "sales-call-needs-matching",
    );
  });

  it("routes other to task-detail (no dedicated action screen exists yet)", () => {
    expect(classifyTaskActionKind("other")).toBe("task-detail");
  });

  it("routes an unrecognized/custom task type to task-detail (fails safe, never throws or guesses)", () => {
    expect(classifyTaskActionKind("a_custom_deployment_type")).toBe(
      "task-detail",
    );
  });

  it("routes a null or undefined type to task-detail", () => {
    expect(classifyTaskActionKind(null)).toBe("task-detail");
    expect(classifyTaskActionKind(undefined)).toBe("task-detail");
  });
});
