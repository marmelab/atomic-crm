// Tests for block-promote-unmerged.mjs — the no-team promotion guard (vitest,
// "claude" Node project). Builds a throwaway repo with a session branch + one
// merged and one unmerged task branch, then exercises the PreToolUse(Agent) hook.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "block-promote-unmerged.mjs");
const SS = "ab12cd34";
const SESSION_ID = `${SS}-1111-2222-3333-444455556666`;

let TMP;
let APP_DIR;
let env;

const g = (...a) =>
  spawnSync("git", ["-C", APP_DIR, ...a], { encoding: "utf8" });
const run = (payload) =>
  spawnSync("node", [HOOK], {
    input: JSON.stringify({ session_id: SESSION_ID, ...payload }),
    env,
    encoding: "utf8",
  }).status;

const PROMOTE = {
  agent_type: "",
  tool_input: {
    subagent_type: "merger",
    prompt: `ROLE: merger\nMODE: promote\nSESSION_SHORT_ID: ${SS}`,
  },
};

beforeAll(() => {
  TMP = mkdtempSync(join(tmpdir(), "promote-unmerged-test-"));
  APP_DIR = join(TMP, "app");
  mkdirSync(APP_DIR, { recursive: true });
  env = { ...process.env, APP_DIR };
  g("init", "-q", "-b", "main");
  g("config", "user.email", "t@t.t");
  g("config", "user.name", "t");
  writeFileSync(join(APP_DIR, "seed.txt"), "seed\n");
  g("add", ".");
  g("commit", "-qm", "seed");
  g("branch", `session/${SS}`, "main");
  g("branch", `session-base/${SS}`, "main");

  // A merged task branch (its commits are already on the session branch).
  g("checkout", "-q", "-b", `${SS}/TASK-001`, `session/${SS}`);
  writeFileSync(join(APP_DIR, "a.txt"), "a\n");
  g("add", ".");
  g("commit", "-qm", "feat(TASK-001): work");
  g("checkout", "-q", `session/${SS}`);
  g("merge", "-q", "--no-ff", `${SS}/TASK-001`, "-m", "merge(TASK-001)");
  g("checkout", "-q", "main");
});

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe("block-promote-unmerged", () => {
  test("allows promotion when every task branch is merged", () => {
    expect(run(PROMOTE)).toBe(0);
  });

  test("blocks promotion when a task branch has unmerged commits", () => {
    g("checkout", "-q", "-b", `${SS}/TASK-002`, `session/${SS}`);
    writeFileSync(join(APP_DIR, "b.txt"), "b\n");
    g("add", ".");
    g("commit", "-qm", "feat(TASK-002): work");
    g("checkout", "-q", "main");
    expect(run(PROMOTE)).toBe(2);
  });

  test("does not gate a per-ticket merger (no MODE: promote)", () => {
    const perTicket = {
      tool_input: {
        subagent_type: "merger",
        prompt: `ROLE: merger\nTASK_ID: TASK-002\nBRANCH_NAME: ${SS}/TASK-002`,
      },
    };
    expect(run(perTicket)).toBe(0);
  });

  test("does not gate a developer dispatch", () => {
    const dev = {
      tool_input: {
        subagent_type: "developer",
        prompt: `ROLE: developer\nTASK_ID: TASK-003\nWORKTREE_PATH: /wt\nBRANCH_NAME: ${SS}/TASK-003`,
      },
    };
    expect(run(dev)).toBe(0);
  });

  test("allows promotion again once the branch is merged", () => {
    g("checkout", "-q", `session/${SS}`);
    g("merge", "-q", "--no-ff", `${SS}/TASK-002`, "-m", "merge(TASK-002)");
    g("checkout", "-q", "main");
    expect(run(PROMOTE)).toBe(0);
  });

  test("ignores the <short>/simple branch even when ahead of the session branch", () => {
    // <short>/simple promotes straight to main (never into the session branch),
    // so its commits are legitimately not on session/<short> and must NOT block a
    // wave promotion.
    g("checkout", "-q", "-b", `${SS}/simple`, "main");
    writeFileSync(join(APP_DIR, "simple.txt"), "s\n");
    g("add", ".");
    g("commit", "-qm", "feat: an simple change");
    g("checkout", "-q", "main");
    expect(run(PROMOTE)).toBe(0);
  });
});
