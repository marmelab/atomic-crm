// Tests for cleanup-worktree.mjs removal semantics (vitest, Node project). A
// task worktree is removed only once its branch was merged with --no-ff into
// the session branch and the worktree is clean; fresh, unmerged, and dirty
// worktrees are preserved. Tests are ordered and stateful — each observes the
// state produced by the previous step.

import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  rmSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { sanitizePath } from "../lib/paths.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SETUP = join(HERE, "..", "setup-worktree.mjs");
const CLEANUP = join(HERE, "..", "cleanup-worktree.mjs");
const SESSION_ID = "cd34ef56-1111-2222-3333-444455556666";
const SS = SESSION_ID.split("-")[0];

let TMP;
let APP_DIR;
let WB;
let env;

const g = (...args) =>
  spawnSync("git", ["-C", APP_DIR, ...args], { encoding: "utf8" });
const gWt = (wt, ...args) =>
  spawnSync("git", ["-C", wt, ...args], { encoding: "utf8" });
const dispatch = (hook, agentType) =>
  spawnSync("node", [hook], {
    input: JSON.stringify({ agent_type: agentType, session_id: SESSION_ID }),
    env,
    encoding: "utf8",
  });
// setup-worktree is now a PreToolUse(Agent) hook — build a dispatch payload to
// provision the task worktrees this test then exercises cleanup against.
const setupDispatch = (taskId) =>
  spawnSync("node", [SETUP], {
    input: JSON.stringify({
      session_id: SESSION_ID,
      tool_input: {
        subagent_type: "developer",
        name: `developer-${taskId}`,
        prompt: `ROLE: developer\nTASK_ID: ${taskId}\nWORKTREE_PATH: ${join(WB, taskId)}\nBRANCH_NAME: ${SS}/${taskId}`,
      },
    }),
    env,
    encoding: "utf8",
  });

beforeAll(() => {
  TMP = mkdtempSync(join(tmpdir(), "cleanup-wt-test-"));
  APP_DIR = join(TMP, "app");
  mkdirSync(APP_DIR, { recursive: true });
  g("init", "-q", "-b", "main");
  g("config", "user.email", "t@t.t");
  g("config", "user.name", "t");
  writeFileSync(join(APP_DIR, "seed.txt"), "seed\n");
  g("add", ".");
  g("commit", "-q", "-m", "seed");
  mkdirSync(join(APP_DIR, "node_modules"), { recursive: true });

  const CRM_TMP_ROOT = join(TMP, "scratch");
  WB = join(CRM_TMP_ROOT, sanitizePath(APP_DIR), SESSION_ID);

  env = { ...process.env, APP_DIR, CRM_TMP_ROOT };
  delete env.VALIDATE_WORKTREE;

  setupDispatch("TASK-001");
  setupDispatch("TASK-002");
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("cleanup-worktree removal semantics", () => {
  test("fresh worktrees (no commits) are preserved", () => {
    expect(dispatch(CLEANUP, "developer-TASK-001").status).toBe(0);
    expect(existsSync(join(WB, "TASK-001"))).toBe(true);
    expect(existsSync(join(WB, "TASK-002"))).toBe(true);
  });

  test("unmerged commits are preserved", () => {
    const wt = join(WB, "TASK-001");
    writeFileSync(join(wt, "work.txt"), "work\n");
    gWt(wt, "add", ".");
    gWt(wt, "commit", "-q", "-m", "TASK-001 work");
    dispatch(CLEANUP, "developer-TASK-001");
    expect(existsSync(wt)).toBe(true);
    expect(g("branch", "--list", `${SS}/TASK-001`).stdout.trim()).not.toBe("");
  });

  test("merged but dirty worktree is preserved", () => {
    const sessionWt = join(WB, "_session");
    const merge = gWt(
      sessionWt,
      "merge",
      "--no-ff",
      `${SS}/TASK-001`,
      "-m",
      "merge TASK-001",
    );
    expect(merge.status).toBe(0);
    writeFileSync(join(WB, "TASK-001", "uncommitted.txt"), "wip\n");
    dispatch(CLEANUP, "developer-TASK-001");
    expect(existsSync(join(WB, "TASK-001"))).toBe(true);
  });

  test("merged clean worktree is removed, branch deleted, fresh sibling kept", () => {
    unlinkSync(join(WB, "TASK-001", "uncommitted.txt"));
    expect(dispatch(CLEANUP, "developer-TASK-001").status).toBe(0);
    expect(existsSync(join(WB, "TASK-001"))).toBe(false);
    expect(g("branch", "--list", `${SS}/TASK-001`).stdout.trim()).toBe("");
    expect(existsSync(join(WB, "TASK-002"))).toBe(true);
    expect(
      g("show-ref", "--verify", "--quiet", `refs/heads/session/${SS}`).status,
    ).toBe(0);
  });
});
