import { describe, expect, it } from "vitest";

import {
  byOperationalUrgency,
  describeTaskKind,
  hasMeaningfulDueDate,
  NEEDS_ATTENTION_KINDS,
} from "./needsAttentionInventory";
import { classifyTaskActionKind } from "./taskActionDestination";
import { defaultTaskTypes } from "../root/defaultConfiguration";

// Needs Attention had been patched one task type at a time, so each fix
// left the others alone and the section slowly became a wall of shouted
// enum names. The inventory is the thing that makes it one model.
describe("the inventory covers what can actually appear", () => {
  it("describes every configured task type", () => {
    for (const configured of defaultTaskTypes) {
      expect(
        describeTaskKind(configured.value),
        `no inventory entry for ${configured.value}`,
      ).not.toBeNull();
    }
  });

  it("gives every type a route that resolves to a real destination kind", () => {
    for (const kind of NEEDS_ATTENTION_KINDS) {
      const actionKind = classifyTaskActionKind(kind.type);
      // task-detail is a legitimate destination only for the manual
      // catch-all; everything else must reach a purpose-built control.
      if (kind.type === "other") {
        expect(actionKind).toBe("task-detail");
      } else {
        expect(
          actionKind,
          `${kind.type} falls back to the generic editor`,
        ).not.toBe("task-detail");
      }
    }
  });

  it("answers all four questions for every type", () => {
    for (const kind of NEEDS_ATTENTION_KINDS) {
      expect(kind.label, kind.type).toBeTruthy();
      expect(kind.question, kind.type).toBeTruthy();
      expect(kind.resolution, kind.type).toBeTruthy();
      expect(kind.closesAutomaticallyWhen, kind.type).toBeTruthy();
    }
  });

  it("never shows Leif the internal enum as a label", () => {
    for (const kind of NEEDS_ATTENTION_KINDS) {
      expect(kind.label).not.toContain("_");
      // Sentence case, not shouted.
      expect(kind.label).not.toBe(kind.label.toUpperCase());
    }
  });

  it("knows which types carry a date that means something", () => {
    // These three carry a due_date that is an internal artefact set to
    // "now" at creation — presenting them as overdue would be a lie.
    expect(hasMeaningfulDueDate("sales_call_needs_matching")).toBe(false);
    expect(hasMeaningfulDueDate("resolve_sales_call")).toBe(false);
    expect(hasMeaningfulDueDate("sales_call_cancelled")).toBe(false);

    expect(hasMeaningfulDueDate("follow_up")).toBe(true);
    expect(hasMeaningfulDueDate("sales_call")).toBe(true);
  });
});

describe("ordering by what a delay actually costs", () => {
  const task = (id: number, type: string, due_date = "2026-09-18") => ({
    id,
    type,
    due_date,
  });

  it("puts an unattributable booking above everything else", () => {
    const rows = [
      task(1, "resolve_client_session_cadence"),
      task(2, "sales_call_needs_matching"),
      task(3, "follow_up"),
    ];

    expect([...rows].sort(byOperationalUrgency).map((t) => t.id)).toEqual([
      2, 3, 1,
    ]);
  });

  it("puts an unknown call outcome above a promised follow-up", () => {
    const rows = [task(1, "follow_up"), task(2, "resolve_sales_call")];

    expect([...rows].sort(byOperationalUrgency).map((t) => t.id)).toEqual([
      2, 1,
    ]);
  });

  it("orders same-urgency rows by the date they actually promised", () => {
    const rows = [
      task(1, "follow_up", "2026-09-30"),
      task(2, "follow_up", "2026-09-22"),
    ];

    expect([...rows].sort(byOperationalUrgency).map((t) => t.id)).toEqual([
      2, 1,
    ]);
  });

  it("is deterministic when urgency and date match", () => {
    const rows = [task(9, "follow_up"), task(4, "follow_up")];

    expect([...rows].sort(byOperationalUrgency).map((t) => t.id)).toEqual([
      4, 9,
    ]);
    expect(
      [...rows]
        .reverse()
        .sort(byOperationalUrgency)
        .map((t) => t.id),
    ).toEqual([4, 9]);
  });

  it("does not sort a dateless type by its internal due_date artefact", () => {
    const rows = [
      task(1, "resolve_sales_call", "2026-01-01"),
      task(2, "resolve_sales_call", "2026-12-31"),
    ];

    // Both have meaningless dates, so the stable id order decides rather
    // than a date that pretends one is more overdue than the other.
    expect([...rows].sort(byOperationalUrgency).map((t) => t.id)).toEqual([
      1, 2,
    ]);
  });
});
