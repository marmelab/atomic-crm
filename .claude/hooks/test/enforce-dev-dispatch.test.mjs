// Tests for enforce-dev-dispatch.mjs — the PreToolUse(Agent) gate that forces a
// `developer` dispatch onto the setup-worktree-prepared worktree (WORKTREE_PATH
// in the prompt) and forbids the Agent tool's own isolation:"worktree". Exit 2
// blocks the dispatch; exit 0 allows it.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, test, expect, beforeAll, afterAll } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "enforce-dev-dispatch.mjs");

let env;
let TMP;

const run = (tool_input) =>
  spawnSync("node", [HOOK], {
    input: JSON.stringify({
      session_id: "ab12cd34-1111-2222-3333-444455556666",
      tool_input,
    }),
    env,
    encoding: "utf8",
  }).status;

beforeAll(() => {
  TMP = mkdtempSync(join(tmpdir(), "enforce-dev-dispatch-test-"));
  env = { ...process.env, APP_DIR: TMP, CRM_TMP_ROOT: join(TMP, "scratch") };
});

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe("enforce-dev-dispatch", () => {
  test("allows a developer dispatch carrying WORKTREE_PATH", () => {
    expect(
      run({
        subagent_type: "developer",
        prompt:
          "ROLE: developer\nTASK_ID: TASK-001\nWORKTREE_PATH: /wt/x/TASK-001\nBRANCH_NAME: x/TASK-001",
      }),
    ).toBe(0);
  });

  test("blocks a developer dispatch missing WORKTREE_PATH", () => {
    expect(
      run({
        subagent_type: "developer",
        prompt: "ROLE: developer\nTASK_ID: TASK-001",
      }),
    ).toBe(2);
  });

  test("blocks a developer dispatch using isolation:worktree", () => {
    expect(
      run({
        subagent_type: "developer",
        isolation: "worktree",
        prompt: "ROLE: developer\nWORKTREE_PATH: /wt/x/TASK-001",
      }),
    ).toBe(2);
  });

  test("blocks a developer dispatch using run_in_background:true", () => {
    expect(
      run({
        subagent_type: "developer",
        run_in_background: true,
        prompt:
          "ROLE: developer\nTASK_ID: TASK-001\nWORKTREE_PATH: /wt/x/TASK-001\nBRANCH_NAME: x/TASK-001",
      }),
    ).toBe(2);
  });

  test("allows the promotion-conflict-resolver (no WORKTREE_PATH by design)", () => {
    expect(
      run({
        subagent_type: "developer",
        prompt:
          "ROLE: promotion-conflict-resolver (gated $CLAUDE_PROJECT_DIR exception)\nSESSION_SHORT_ID: ab12cd34\nUnder the promotion lock, in $CLAUDE_PROJECT_DIR on main, re-run the merge.",
      }),
    ).toBe(0);
  });

  test("ignores non-developer dispatches (e.g. merger)", () => {
    expect(
      run({
        subagent_type: "merger",
        prompt: "ROLE: merger\nTASK_ID: TASK-001",
      }),
    ).toBe(0);
  });
});
