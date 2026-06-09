// Tests the migration-review bypass for quality-reviewer (vitest, Node project).

import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, test, expect, beforeAll, afterAll } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "member-idle-gate.mjs");
const SESSION_ID = "ab12cd34-1111-2222-3333-444455556666";

let TMP;
let WB;
let env;

beforeAll(() => {
  TMP = mkdtempSync(join(tmpdir(), "idle-gate-test-"));
  const APP_DIR = join(TMP, "app");
  mkdirSync(APP_DIR, { recursive: true });
  const CRM_TMP_ROOT = join(TMP, "scratch");
  // WORKTREE_BASE mirrors lib/common.mjs.
  WB = join(CRM_TMP_ROOT, APP_DIR.replace(/\//g, "_"), SESSION_ID);
  env = { ...process.env, APP_DIR, CRM_TMP_ROOT };
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

const run = (stdin) =>
  spawnSync("node", [HOOK], { input: stdin, env, encoding: "utf8" }).status;

describe("member-idle-gate migration-review bypass", () => {
  test("migration-review on simple worktree → allowed", () => {
    // A quality-reviewer reading the migration (simple) worktree must be ALLOWED (exit 0).
    expect(
      run(
        JSON.stringify({
          agent_type: "quality-reviewer",
          session_id: SESSION_ID,
          tool_input: { command: `cat ${WB}/simple/supabase/migrations/x.sql` },
        }),
      ),
    ).toBe(0);
  });

  test("premature review, no flag, no migration path → blocked", () => {
    // A plain quality-reviewer with no flag and no migration path stays BLOCKED (exit 2).
    expect(
      run(
        JSON.stringify({
          agent_type: "quality-reviewer",
          session_id: SESSION_ID,
          tool_input: { command: "ls" },
        }),
      ),
    ).toBe(2);
  });
});
