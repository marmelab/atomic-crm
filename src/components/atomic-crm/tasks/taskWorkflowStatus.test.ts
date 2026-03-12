import { describe, expect, it } from "vitest";

import {
  getTaskCompletionPatch,
  getTaskWorkflowStatus,
} from "./taskWorkflowStatus";

describe("taskWorkflowStatus helpers", () => {
  it("resolves task status from explicit workflow_status", () => {
    expect(
      getTaskWorkflowStatus({
        workflow_status: "in_progress",
        done_date: null,
      }),
    ).toBe("in_progress");
  });

  it("falls back to done when done_date is set", () => {
    expect(
      getTaskWorkflowStatus({
        workflow_status: "todo",
        done_date: "2026-03-12T12:00:00.000Z",
      }),
    ).toBe("done");
  });

  it("defaults to todo when no completion data is present", () => {
    expect(
      getTaskWorkflowStatus({
        done_date: null,
      }),
    ).toBe("todo");
  });

  it("keeps existing done_date when status stays done", () => {
    const existingDoneDate = "2026-03-12T12:00:00.000Z";
    expect(getTaskCompletionPatch("done", existingDoneDate)).toEqual({
      done_date: existingDoneDate,
      workflow_status: "done",
    });
  });

  it("clears done_date when task moves to in_progress", () => {
    expect(
      getTaskCompletionPatch("in_progress", "2026-03-12T12:00:00.000Z"),
    ).toEqual({
      done_date: null,
      workflow_status: "in_progress",
    });
  });
});
