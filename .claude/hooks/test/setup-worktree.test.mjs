// Tests for setup-worktree.mjs (vitest, "claude" Node project). setup-worktree is
// now a PreToolUse(Agent) hook: it reads the dispatch tool_input (subagent_type,
// name, prompt) and creates the worktree BEFORE the subagent starts. Uses a
// throwaway git repo (APP_DIR) + CRM_TMP_ROOT. Tests are ordered and stateful —
// each observes the state produced by the previous step.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { sanitizePath } from "../lib/paths.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "setup-worktree.mjs");
const SESSION_ID = "ab12cd34-1111-2222-3333-444455556666";
const SS = SESSION_ID.split("-")[0];

let TMP;
let APP_DIR;
let WB;
let env;

const g = (...args) =>
  spawnSync("git", ["-C", APP_DIR, ...args], { encoding: "utf8" });

// Build a PreToolUse(Agent) dispatch payload and run the hook.
const dispatch = ({
  subagentType = "developer",
  taskId = "",
  name = "",
} = {}) => {
  const wp = taskId ? join(WB, taskId) : join(WB, "simple");
  const branch = taskId ? `${SS}/${taskId}` : `${SS}/simple`;
  const prompt =
    `ROLE: ${subagentType}\n` +
    (taskId ? `TASK_ID: ${taskId}\n` : "") +
    `WORKTREE_PATH: ${wp}\nBRANCH_NAME: ${branch}`;
  return spawnSync("node", [HOOK], {
    input: JSON.stringify({
      session_id: SESSION_ID,
      tool_input: {
        subagent_type: subagentType,
        name: name || (taskId ? `${subagentType}-${taskId}` : subagentType),
        prompt,
      },
    }),
    env,
    encoding: "utf8",
  });
};

beforeAll(() => {
  TMP = mkdtempSync(join(tmpdir(), "setup-wt-test-"));
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

  dispatch({ subagentType: "developer", taskId: "TASK-001" });
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("setup-worktree session-branch topology (PreToolUse/Agent)", () => {
  test("session branch created", () => {
    expect(
      g("show-ref", "--verify", "--quiet", `refs/heads/session/${SS}`).status,
    ).toBe(0);
  });

  test("session-base anchor created", () => {
    expect(
      g("show-ref", "--verify", "--quiet", `refs/heads/session-base/${SS}`)
        .status,
    ).toBe(0);
  });

  test("_session worktree created", () => {
    expect(existsSync(join(WB, "_session"))).toBe(true);
  });

  test("task worktree created", () => {
    expect(existsSync(join(WB, "TASK-001"))).toBe(true);
  });

  test("node_modules provisioned into task worktree", () => {
    expect(existsSync(join(WB, "TASK-001", "node_modules"))).toBe(true);
  });

  test("task branch forked from session branch", () => {
    expect(
      g("merge-base", "--is-ancestor", `session/${SS}`, `${SS}/TASK-001`)
        .status,
    ).toBe(0);
  });

  test("non-dev dispatch (reviewer) is a silent no-op", () => {
    const r = spawnSync("node", [HOOK], {
      input: JSON.stringify({
        session_id: SESSION_ID,
        tool_input: {
          subagent_type: "quality-reviewer",
          name: "quality-reviewer-TASK-001",
          prompt: "ROLE: quality-reviewer\nTASK_ID: TASK-001",
        },
      }),
      env,
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
  });

  test("idempotent second run exits 0 and keeps the worktree", () => {
    expect(
      dispatch({ subagentType: "developer", taskId: "TASK-001" }).status,
    ).toBe(0);
    expect(existsSync(join(WB, "TASK-001"))).toBe(true);
  });

  test("stale _session registration survives dir wipe", () => {
    rmSync(join(WB, "_session"), { recursive: true, force: true });
    expect(
      g("worktree", "list", "--porcelain").stdout.includes(
        join(WB, "_session"),
      ),
    ).toBe(true);
  });

  test("_session recreated after stale-registration wipe", () => {
    dispatch({ subagentType: "developer", taskId: "TASK-002" });
    expect(existsSync(join(WB, "_session", ".git"))).toBe(true);
  });

  test("developer on the <short>/simple branch derives the simple worktree", () => {
    spawnSync("node", [HOOK], {
      input: JSON.stringify({
        session_id: SESSION_ID,
        tool_input: {
          subagent_type: "developer",
          name: "developer",
          prompt: `ROLE: developer\nWORKTREE_PATH: ${join(WB, "simple")}\nBRANCH_NAME: ${SS}/simple`,
        },
      }),
      env,
      encoding: "utf8",
    });
    expect(existsSync(join(WB, "simple"))).toBe(true);
  });

  test("developer with WORKTREE_PATH but unresolvable task id is blocked (exit 2)", () => {
    const r = spawnSync("node", [HOOK], {
      input: JSON.stringify({
        session_id: SESSION_ID,
        tool_input: {
          subagent_type: "developer",
          name: "developer",
          prompt:
            "ROLE: developer\nWORKTREE_PATH: /wt/nowhere\nBRANCH_NAME: x/y",
        },
      }),
      env,
      encoding: "utf8",
    });
    expect(r.status).toBe(2);
  });

  test("promotion-conflict-resolver is accepted with no worktree (exit 0)", () => {
    const r = spawnSync("node", [HOOK], {
      input: JSON.stringify({
        session_id: SESSION_ID,
        tool_input: {
          subagent_type: "developer",
          name: "developer",
          prompt: `ROLE: promotion-conflict-resolver (gated $CLAUDE_PROJECT_DIR exception)\nSESSION_SHORT_ID: ${SS}`,
        },
      }),
      env,
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
  });

  test("no SESSION-BRANCH FAILED logged", () => {
    let logTxt = "";
    try {
      logTxt = readFileSync(join(WB, "hooks.log"), "utf8");
    } catch {
      logTxt = "";
    }
    expect(logTxt.includes("SESSION-BRANCH FAILED")).toBe(false);
  });
});
