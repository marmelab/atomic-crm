import { describe, expect, test } from "vitest";

import type { EnrollmentOnboardingItem } from "../types";
import { assessOnboarding, onboardingBlocksSetup } from "./assessOnboarding";
import { computeOnboardingProgress } from "./computeOnboardingProgress";
import { assessPostSaleSetup } from "../deals/postSaleSetup";
import type { Deal } from "../types";

const item = (
  overrides: Partial<EnrollmentOnboardingItem> = {},
): EnrollmentOnboardingItem =>
  ({
    id: 1,
    enrollment_id: 1,
    requirement_key: "contract",
    label: "Contract signed",
    task_text_template: "Send {name} the contract",
    is_required: true,
    status: "pending",
    sort_order: 1,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  }) as EnrollmentOnboardingItem;

describe("assessOnboarding", () => {
  test("reports progress for a tracked checklist", () => {
    // Arrange
    const items = [
      item({ id: 1, status: "done" }),
      item({ id: 2, requirement_key: "slack", status: "pending" }),
    ];

    // Act
    const result = assessOnboarding({ tracking: "tracked", items });

    // Assert
    expect(result.mode).toBe("tracked");
    if (result.mode !== "tracked") return;
    expect(result.requiredDoneCount).toBe(1);
    expect(result.allRequiredComplete).toBe(false);
    expect(result.outstandingRequired.map((i) => i.requirement_key)).toEqual([
      "slack",
    ]);
  });

  test("a tracked checklist with every required item done is complete", () => {
    // Arrange
    const items = [item({ id: 1, status: "done" })];

    // Act
    const result = assessOnboarding({ tracking: "tracked", items });

    // Assert
    expect(result.mode === "tracked" && result.allRequiredComplete).toBe(true);
  });

  test("a tracked Enrollment with no items has NOT finished onboarding", () => {
    // Arrange — the shape that used to activate silently: no item is
    // incomplete, because no item exists.

    // Act
    const result = assessOnboarding({ tracking: "tracked", items: [] });

    // Assert
    expect(result.mode).toBe("tracked");
    if (result.mode !== "tracked") return;
    expect(result.allRequiredComplete).toBe(false);
    expect(result.isMissingChecklist).toBe(true);
  });

  test("a legacy Enrollment with no items is valid, not empty progress", () => {
    // Act
    const result = assessOnboarding({
      tracking: "legacy_untracked",
      items: [],
    });

    // Assert — there is deliberately no completion figure on this branch,
    // so no caller can render it as 0 of 0.
    expect(result.mode).toBe("legacy_untracked");
    expect(result).not.toHaveProperty("allRequiredComplete");
  });

  test("an unknown tracking value is treated as tracked", () => {
    // Arrange — a row that predates the column, or one that did not load
    // it. Tracked can surface a missing checklist; legacy would hide one.

    // Act
    const result = assessOnboarding({ tracking: undefined, items: [] });

    // Assert
    expect(result.mode).toBe("tracked");
  });

  test("only a tracked, unfinished checklist blocks post-sale setup", () => {
    // Assert — the legacy case must never put a blocker on the board, and
    // a missing tracked checklist must never look finished.
    expect(
      onboardingBlocksSetup(
        assessOnboarding({ tracking: "legacy_untracked", items: [] }),
      ),
    ).toBe(false);
    expect(
      onboardingBlocksSetup(
        assessOnboarding({ tracking: "tracked", items: [] }),
      ),
    ).toBe(true);
    expect(
      onboardingBlocksSetup(
        assessOnboarding({
          tracking: "tracked",
          items: [item({ status: "done" })],
        }),
      ),
    ).toBe(false);
  });
});

describe("the consumers that used to disagree", () => {
  // Before this slice an empty checklist meant three different things at
  // once. These assert they now say the same thing about the same rows.
  const deal = {
    id: 1,
    name: "Someone",
    stage: "won",
    contact_id: 1,
    offer_id: 1,
  } as unknown as Deal;

  const setupFor = (
    tracking: "tracked" | "legacy_untracked",
    items: EnrollmentOnboardingItem[],
  ) =>
    assessPostSaleSetup({
      deal,
      enrollmentStatus: "onboarding",
      enrollmentOnboardingTracking: tracking,
      // Payment is a separate dimension and is held constant here so the
      // onboarding half is what the assertions are about.
      scheduleItems: [],
      planObjects: [],
      onboardingItems: items,
    });

  test("legacy: no onboarding blocker, and no progress figure", () => {
    // Act
    const setup = setupFor("legacy_untracked", []);
    const progress = computeOnboardingProgress([], "legacy_untracked");

    // Assert
    expect(setup.blockers.filter((b) => b.kind === "onboarding")).toEqual([]);
    expect(progress.isLegacyUntracked).toBe(true);
    expect(progress.requiredItems).toEqual([]);
  });

  test("tracked with no checklist: both call it missing, neither calls it done", () => {
    // Act
    const setup = setupFor("tracked", []);
    const progress = computeOnboardingProgress([], "tracked");

    // Assert
    expect(setup.blockers).toContainEqual({
      kind: "onboarding",
      label: "Onboarding checklist missing",
    });
    expect(progress.isMissingChecklist).toBe(true);
    expect(progress.allRequiredComplete).toBe(false);
  });

  test("tracked and finished: no onboarding blocker, progress complete", () => {
    // Arrange
    const items = [item({ status: "done" })];

    // Act
    const setup = setupFor("tracked", items);
    const progress = computeOnboardingProgress(items, "tracked");

    // Assert
    expect(setup.blockers.filter((b) => b.kind === "onboarding")).toEqual([]);
    expect(progress.allRequiredComplete).toBe(true);
  });

  test("a terminal Enrollment is not setup work, whatever its checklist says", () => {
    // Arrange — a finished client must not be dragged back onto the board.
    const setup = assessPostSaleSetup({
      deal,
      enrollmentStatus: "completed",
      enrollmentOnboardingTracking: "tracked",
      scheduleItems: [],
      planObjects: [],
      onboardingItems: [],
    });

    // Assert
    expect(setup.complete).toBe(true);
    expect(setup.blockers).toEqual([]);
  });
});
