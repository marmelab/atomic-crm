// Tests for setup-worktree.mjs session-branch topology (vitest, Node project).
// Uses a throwaway git repo as the project root via the APP_DIR override, and a
// throwaway CRM_TMP_ROOT so worktrees land in a predictable, isolated location.
//
// The tests are intentionally ordered and stateful: each one observes (or mutates)
// the worktree state produced by the previous step. Vitest runs tests within a file
// sequentially in declaration order, which preserves that contract.

import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, test, expect, beforeAll, afterAll } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "setup-worktree.mjs");
const SESSION_ID = "ab12cd34-1111-2222-3333-444455556666";
const SS = SESSION_ID.split("-")[0]; // ab12cd34

let TMP;
let APP_DIR;
let WB; // WORKTREE_BASE: <CRM_TMP_ROOT>/<APP_DIR with '/'->'_'>/<SESSION_ID>
let env;

const g = (...args) =>
  spawnSync("git", ["-C", APP_DIR, ...args], { encoding: "utf8" });
const dispatch = (agentType) =>
  spawnSync("node", [HOOK], {
    input: JSON.stringify({ agent_type: agentType, session_id: SESSION_ID }),
    env,
    encoding: "utf8",
  });

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

  // Isolated scratch root + full session id supplied on stdin (no chat-service).
  const CRM_TMP_ROOT = join(TMP, "scratch");
  WB = join(CRM_TMP_ROOT, APP_DIR.replace(/\//g, "_"), SESSION_ID);

  env = { ...process.env, APP_DIR, CRM_TMP_ROOT };
  delete env.VALIDATE_WORKTREE;

  // Dispatch a COMPLEX developer for TASK-001.
  dispatch("developer-TASK-001");
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("setup-worktree session-branch topology", () => {
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

  test("task branch forked from session branch", () => {
    // Task branch must fork from the session branch, not main directly.
    expect(
      g("merge-base", "--is-ancestor", `session/${SS}`, `${SS}/TASK-001`)
        .status,
    ).toBe(0);
  });

  test("idempotent second run exits 0", () => {
    // Restart scenario: a second dispatch with the same session must be a no-op.
    expect(dispatch("developer-TASK-001").status).toBe(0);
  });

  // Regression: session restart where cleanup wiped the _session directory but git
  // still holds the worktree registration. Plain `worktree add` fails with "missing
  // but already registered"; the hook must prune + recreate.
  test("stale _session registration survives dir wipe", () => {
    rmSync(join(WB, "_session"), { recursive: true, force: true });
    expect(
      g("worktree", "list", "--porcelain").stdout.includes(
        join(WB, "_session"),
      ),
    ).toBe(true);
  });

  test("_session recreated after stale-registration wipe", () => {
    dispatch("developer-TASK-002");
    expect(existsSync(join(WB, "_session", ".git"))).toBe(true);
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
