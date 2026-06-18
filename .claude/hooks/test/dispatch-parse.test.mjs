// Unit tests for lib/dispatch-parse.mjs — the shared PreToolUse(Agent) parser.
// The anchored TASK_ID regex is the key safety property: prose mentioning
// another ticket must never mis-key a gate.

import { describe, test, expect } from "vitest";
import { parseDispatch } from "../lib/dispatch-parse.mjs";

describe("parseDispatch", () => {
  test("anchors TASK_ID at line start, ignoring prose mentions", () => {
    const d = parseDispatch({
      tool_input: {
        subagent_type: "merger",
        run_in_background: true,
        prompt:
          "TASK-001 is merged; now handle this one.\nROLE: merger\nTASK_ID: TASK-002\nBRANCH_NAME: ab12cd34/TASK-002\nWORKTREE_PATH: /wt/ab12cd34/TASK-002",
      },
    });
    expect(d.taskId).toBe("TASK-002");
    expect(d.subagentType).toBe("merger");
    expect(d.runInBackground).toBe(true);
    expect(d.branchName).toBe("ab12cd34/TASK-002");
    expect(d.worktreePath).toBe("/wt/ab12cd34/TASK-002");
  });

  test("empty TASK_ID when there is no TASK_ID line", () => {
    const d = parseDispatch({
      tool_input: {
        subagent_type: "merger",
        prompt: "merge the simple branch",
      },
    });
    expect(d.taskId).toBe("");
  });

  test("recognises SIMPLE / ROLLBACK skip keys", () => {
    expect(
      parseDispatch({ tool_input: { prompt: "ROLE: merger\nTASK_ID: SIMPLE" } })
        .taskId,
    ).toBe("SIMPLE");
    expect(
      parseDispatch({
        tool_input: { prompt: "ROLE: merger\nTASK_ID: ROLLBACK" },
      }).taskId,
    ).toBe("ROLLBACK");
  });

  test("promotion-only dispatch carries MODE + SESSION_SHORT_ID", () => {
    const d = parseDispatch({
      agent_type: "",
      tool_input: {
        subagent_type: "merger",
        prompt: "ROLE: merger\nMODE: promote\nSESSION_SHORT_ID: ab12cd34",
      },
    });
    expect(d.mode).toBe("promote");
    expect(d.sessionShortId).toBe("ab12cd34");
    expect(d.callerAgentType).toBe("");
  });

  test("isolation surfaces so enforce-dev-dispatch can block it", () => {
    const d = parseDispatch({
      tool_input: {
        subagent_type: "developer",
        isolation: "worktree",
        prompt: "ROLE: developer\nWORKTREE_PATH: /wt/x/TASK-004",
      },
    });
    expect(d.isolation).toBe("worktree");
    expect(d.worktreePath).toBe("/wt/x/TASK-004");
  });

  test("developer dispatch exposes name, task and an empty isolation", () => {
    const d = parseDispatch({
      tool_input: {
        subagent_type: "developer",
        name: "developer-TASK-003",
        prompt:
          "ROLE: developer\nTASK_ID: TASK-003\nWORKTREE_PATH: /wt/x/TASK-003\nBRANCH_NAME: x/TASK-003",
      },
    });
    expect(d.taskId).toBe("TASK-003");
    expect(d.name).toBe("developer-TASK-003");
    expect(d.isolation).toBe("");
  });
});
