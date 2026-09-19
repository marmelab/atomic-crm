import { describe, expect, test } from "vitest";

import {
  MANUALLY_CREATABLE_TASK_TYPES,
  NEEDS_ATTENTION_KINDS,
  describeTaskKind,
  isSystemTaskType,
} from "./needsAttentionInventory";
import { defaultTaskTypes } from "../root/defaultConfiguration";

// A Task says something needs attention; it is not what makes it true.
// These guard the line between the two.

describe("where a Task comes from", () => {
  test("every type in the inventory declares an origin", () => {
    // Assert — an undeclared origin would silently fall through to
    // "creatable by hand", which is the failure this classification exists
    // to stop.
    for (const kind of NEEDS_ATTENTION_KINDS) {
      expect(["system", "manual", "retired"]).toContain(kind.origin);
    }
  });

  test("every configured task type is described by the inventory", () => {
    // Assert — a type offered in the UI but absent from the inventory has
    // no destination, no due-date meaning and no origin.
    for (const choice of defaultTaskTypes) {
      expect(
        describeTaskKind(choice.value),
        `${choice.value} is offered but not described`,
      ).not.toBeNull();
    }
  });

  test("Leif can only hand-create genuinely manual types", () => {
    // Assert — the Add Task form used to offer all thirteen.
    expect(MANUALLY_CREATABLE_TASK_TYPES).toEqual(["other"]);
  });

  test("system projections cannot be created by hand", () => {
    // Arrange — the families whose truth lives on another entity.
    const projections = [
      "onboarding_item",
      "offboarding_item",
      "review_application",
      "resolve_client_session_cadence",
      "sales_call_needs_matching",
      "resolve_sales_call",
    ];

    // Assert
    for (const type of projections) {
      expect(isSystemTaskType(type), type).toBe(true);
      expect(MANUALLY_CREATABLE_TASK_TYPES).not.toContain(type);
    }
  });

  test("retired types are neither system nor hand-creatable", () => {
    // Arrange — no live writer produces these, and check_payment never had
    // one at all. Their existing rows stay readable.
    for (const type of [
      "sales_call_cancelled",
      "sales_call_no_show",
      "nurture_follow_up",
      "check_payment",
    ]) {
      // Assert
      expect(describeTaskKind(type)?.origin, type).toBe("retired");
      expect(MANUALLY_CREATABLE_TASK_TYPES).not.toContain(type);
      expect(isSystemTaskType(type)).toBe(false);
    }
  });

  test("a retired type is still readable rather than unknown", () => {
    // Assert — one closed sales_call_cancelled row exists in production
    // and must still render with a label and a destination.
    const kind = describeTaskKind("sales_call_cancelled");
    expect(kind?.label).toBeTruthy();
    expect(kind?.destination).toBeTruthy();
  });

  test("every system type has an action destination", () => {
    // Assert — a system Task with nowhere to go is a dead end on the
    // Dashboard.
    for (const kind of NEEDS_ATTENTION_KINDS) {
      if (kind.origin !== "system") continue;
      expect(kind.destination, kind.type).toMatch(/→/);
      expect(kind.actionLabel, kind.type).toBeTruthy();
    }
  });
});
