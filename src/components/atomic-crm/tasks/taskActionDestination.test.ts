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
    "send_contract",
    "complete_access",
    "sales_call_cancelled",
  ])("routes %s to opportunity-context", (type) => {
    expect(classifyTaskActionKind(type)).toBe("opportunity-context");
  });

  it.each(["resolve_sales_call", "other"])(
    "routes %s to task-detail (no dedicated action screen exists yet)",
    (type) => {
      expect(classifyTaskActionKind(type)).toBe("task-detail");
    },
  );

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
