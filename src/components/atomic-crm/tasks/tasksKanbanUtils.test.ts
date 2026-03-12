import { describe, expect, it } from "vitest";

import {
  DONE_COLUMN_ID,
  IN_PROGRESS_COLUMN_ID,
  TODO_COLUMN_ID,
  UNASSIGNED_COLUMN_ID,
  getColumnIdForTask,
  getTaskPatchForDestination,
} from "./tasksKanbanUtils";

describe("tasksKanbanUtils", () => {
  it("maps status-grouped cards to the proper column", () => {
    expect(
      getColumnIdForTask(
        {
          id: 1,
          contact_id: 1,
          due_date: "2026-03-12T10:00:00.000Z",
          text: "Follow up",
          type: "call",
          workflow_status: "in_progress",
        } as any,
        "status",
      ),
    ).toBe(IN_PROGRESS_COLUMN_ID);
  });

  it("maps assignee-grouped cards to unassigned when sales_id is missing", () => {
    expect(
      getColumnIdForTask(
        {
          id: 1,
          contact_id: 1,
          due_date: "2026-03-12T10:00:00.000Z",
          text: "Follow up",
          type: "call",
        } as any,
        "assignee",
      ),
    ).toBe(UNASSIGNED_COLUMN_ID);
  });

  it("builds status patch for in_progress destination", () => {
    expect(
      getTaskPatchForDestination(
        {
          id: 1,
          contact_id: 1,
          due_date: "2026-03-12T10:00:00.000Z",
          text: "Follow up",
          type: "call",
          done_date: "2026-03-12T12:00:00.000Z",
          workflow_status: "done",
        } as any,
        "status",
        IN_PROGRESS_COLUMN_ID,
      ),
    ).toEqual({
      done_date: null,
      workflow_status: "in_progress",
    });
  });

  it("builds status patch for done destination", () => {
    const patch = getTaskPatchForDestination(
      {
        id: 1,
        contact_id: 1,
        due_date: "2026-03-12T10:00:00.000Z",
        text: "Follow up",
        type: "call",
        done_date: null,
        workflow_status: "todo",
      } as any,
      "status",
      DONE_COLUMN_ID,
    );
    expect(patch.workflow_status).toBe("done");
    expect(typeof patch.done_date).toBe("string");
  });

  it("builds assignee patch for unassigned destination", () => {
    expect(
      getTaskPatchForDestination(
        {
          id: 1,
          contact_id: 1,
          due_date: "2026-03-12T10:00:00.000Z",
          text: "Follow up",
          type: "call",
        } as any,
        "assignee",
        UNASSIGNED_COLUMN_ID,
      ),
    ).toEqual({
      sales_id: null,
    });
  });

  it("builds status patch for todo destination", () => {
    expect(
      getTaskPatchForDestination(
        {
          id: 1,
          contact_id: 1,
          due_date: "2026-03-12T10:00:00.000Z",
          text: "Follow up",
          type: "call",
          done_date: "2026-03-12T12:00:00.000Z",
          workflow_status: "done",
        } as any,
        "status",
        TODO_COLUMN_ID,
      ),
    ).toEqual({
      done_date: null,
      workflow_status: "todo",
    });
  });
});
