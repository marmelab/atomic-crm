// Tests for record-merger-stage.mjs, the dispatch->Bash bridge that carries a
// merger's promotion authorization. A PreToolUse(Bash) hook cannot see the merger's
// dispatch prompt, so the authorization is recorded here at dispatch time and read
// later by block-wave-merger-promote.mjs. Getting `promote` wrong in either direction
// is serious: true for a wave merger lets partial work reach the base branch, false
// for the promotion merger wedges the pipeline.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { sanitizePath } from "../lib/paths.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "record-merger-stage.mjs");
const SESSION_ID = "ms7c3d2e-1111-2222-3333-444455556666";

let TMP, APP_DIR, sessionDir, env;

const run = (subagentType, prompt) =>
  spawnSync("node", [HOOK], {
    input: JSON.stringify({
      tool_name: "Agent",
      session_id: SESSION_ID,
      tool_input: { subagent_type: subagentType, prompt },
    }),
    env,
    encoding: "utf8",
  });

const marker = () => {
  const p = join(sessionDir, "merger-stage.json");
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
};

beforeEach(() => {
  TMP = mkdtempSync(join(tmpdir(), "record-merger-stage-"));
  APP_DIR = join(TMP, "app");
  const TMP_ROOT = join(TMP, "scratch");
  sessionDir = join(TMP_ROOT, sanitizePath(APP_DIR), SESSION_ID);
  mkdirSync(APP_DIR, { recursive: true });
  env = { ...process.env, APP_DIR, HARNESS_TMP_ROOT: TMP_ROOT };
  delete env.CLAUDE_AGENT_NAME;
});

afterEach(() => rmSync(TMP, { recursive: true, force: true }));

describe("record-merger-stage", () => {
  test("a per-ticket wave merger is recorded as NOT authorized to promote", () => {
    const r = run("merger", "ROLE: merger\nTASK_ID: TASK-003\nSTAGE: a-only\n");
    expect(r.status).toBe(0);
    expect(marker().promote).toBe(false);
    expect(marker().taskId).toBe("TASK-003");
  });

  // The TASK-<n> id alone must be enough: a wave dispatch that forgot STAGE: a-only
  // still may not promote, or a missing line would silently authorize it.
  test("a TASK-<n> dispatch without STAGE: a-only is still not authorized", () => {
    run("merger", "ROLE: merger\nTASK_ID: TASK-011\n");
    expect(marker().promote).toBe(false);
  });

  test("the promotion merger is recorded as authorized", () => {
    run("merger", "ROLE: merger\nMODE: promote\nSESSION_SHORT_ID: abcd1234\n");
    expect(marker().promote).toBe(true);
    expect(marker().mode).toBe("promote");
  });

  test.each(["SIMPLE", "MIGRATION", "ROLLBACK"])(
    "the %s single-shot merger is recorded as authorized",
    (taskId) => {
      run("merger", `ROLE: merger\nTASK_ID: ${taskId}\n`);
      expect(marker().promote).toBe(true);
    },
  );

  // STAGE: a-only overrides mode, so a SIMPLE merger asked for Stage A only stays
  // unauthorized (the feature-review fix path merges into the session branch).
  test("STAGE: a-only wins over a promoting mode", () => {
    run("merger", "ROLE: merger\nTASK_ID: SIMPLE\nSTAGE: a-only\n");
    expect(marker().promote).toBe(false);
  });

  test("a non-merger dispatch records nothing", () => {
    const r = run("developer", "ROLE: developer\nTASK_ID: TASK-003\n");
    expect(r.status).toBe(0);
    expect(marker()).toBe(null);
  });

  test("prose naming another ticket cannot mis-key the marker", () => {
    run(
      "merger",
      "ROLE: merger\nTASK_ID: TASK-002\n\nTASK-001 is already merged; merge this one.",
    );
    expect(marker().taskId).toBe("TASK-002");
    expect(marker().promote).toBe(false);
  });
});
