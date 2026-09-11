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
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { sanitizePath } from "../lib/paths.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "e2e-on-feature-review.mjs");
const SESSION_ID = "e2e-hook-1111-2222-3333-444455556666";

let TMP, APP_DIR, TMP_ROOT, sessionDir, env;

// e2e-smoke.sh stubs, one per outcome the hook has to classify.
const SMOKE = {
  pass: '#!/usr/bin/env bash\necho "e2e-smoke: suite exit=0"\nexit 0\n',
  skip: '#!/usr/bin/env bash\necho "SKIP: all 5 e2e slots busy; try again later."\nexit 0\n',
  fail: '#!/usr/bin/env bash\necho "1 failed"\nexit 1\n',
  record:
    '#!/usr/bin/env bash\necho "$E2E_SMOKE_SRC" > "$(dirname "$0")/../../ran-with-src"\nexit 0\n',
};

const writeSmoke = (body) => {
  const dir = join(APP_DIR, ".claude", "scripts");
  mkdirSync(dir, { recursive: true });
  const p = join(dir, "e2e-smoke.sh");
  writeFileSync(p, body, { mode: 0o755 });
};

const approve = () => {
  const dir = join(sessionDir, "reviews");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "FEATURE-quality-reviewer"), "");
};

// The runtime hands SubagentStop a transcript path; readAgentMeta reads the sibling
// <transcript>.meta.json written at spawn, which is what identifies the dispatch.
const transcriptWithMeta = (description) => {
  const tp = join(TMP, `agent-${Math.random().toString(36).slice(2)}.jsonl`);
  writeFileSync(tp, "");
  writeFileSync(
    tp.replace(/\.jsonl$/, ".meta.json"),
    JSON.stringify({ agentType: "quality-reviewer", description }),
  );
  return tp;
};

const run = (transcriptPath) =>
  spawnSync("node", [HOOK], {
    input: JSON.stringify({
      session_id: SESSION_ID,
      hook_event_name: "SubagentStop",
      transcript_path: transcriptPath,
    }),
    env,
    encoding: "utf8",
  });

const result = () => {
  const p = join(sessionDir, "e2e-result.json");
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
};

beforeEach(() => {
  TMP = mkdtempSync(join(tmpdir(), "e2e-on-review-"));
  APP_DIR = join(TMP, "app");
  TMP_ROOT = join(TMP, "scratch");
  sessionDir = join(TMP_ROOT, sanitizePath(APP_DIR), SESSION_ID);
  mkdirSync(join(sessionDir, "_session"), { recursive: true });
  env = { ...process.env, APP_DIR, HARNESS_TMP_ROOT: TMP_ROOT };
  delete env.CHAT_SESSION_DIR;
  delete env.CLAUDE_AGENT_NAME;
  delete env.CLAUDE_PROJECT_DIR;
});

afterEach(() => rmSync(TMP, { recursive: true, force: true }));

describe("e2e-on-feature-review", () => {
  test("does not launch the suite for a per-ticket review stop", () => {
    writeSmoke(SMOKE.record);
    approve();
    const r = run(transcriptWithMeta("Review TASK-003 implementation"));
    expect(r.status).toBe(0);
    expect(existsSync(join(APP_DIR, "ran-with-src"))).toBe(false);
    expect(result()).toBe(null);
  });

  test("does not launch the suite when the feature review did not approve", () => {
    writeSmoke(SMOKE.record);
    const r = run(transcriptWithMeta("Feature-review: add deal importance"));
    expect(r.status).toBe(0);
    expect(existsSync(join(APP_DIR, "ran-with-src"))).toBe(false);
    expect(result()).toBe(null);
  });

  test("launches the suite on the session worktree once the feature review approved", () => {
    writeSmoke(SMOKE.record);
    approve();
    const r = run(transcriptWithMeta("Feature-review: add deal importance"));
    expect(r.status).toBe(0);
    const ranWith = readFileSync(join(APP_DIR, "ran-with-src"), "utf8").trim();
    expect(ranWith).toBe(join(sessionDir, "_session"));
  });

  test("records a passing suite", () => {
    writeSmoke(SMOKE.pass);
    approve();
    run(transcriptWithMeta("Feature-review: x"));
    expect(result().status).toBe("passed");
  });

  test("records a graceful skip as skipped, not failed", () => {
    writeSmoke(SMOKE.skip);
    approve();
    run(transcriptWithMeta("Feature-review: x"));
    expect(result().status).toBe("skipped");
  });

  test("records a failing suite without blocking the reviewer's stop", () => {
    writeSmoke(SMOKE.fail);
    approve();
    const r = run(transcriptWithMeta("Feature-review: x"));
    expect(r.status).toBe(0);
    expect(result().status).toBe("failed");
    expect(result().output).toContain("1 failed");
  });

  test("drops a previous round's result when the new review did not approve", () => {
    writeSmoke(SMOKE.pass);
    approve();
    run(transcriptWithMeta("Feature-review: round 1"));
    expect(result().status).toBe("passed");

    rmSync(join(sessionDir, "reviews", "FEATURE-quality-reviewer"), {
      force: true,
    });
    run(transcriptWithMeta("Feature-review: round 2"));
    expect(result()).toBe(null);
  });

  test("leaves a per-ticket review stop's result untouched", () => {
    writeSmoke(SMOKE.pass);
    approve();
    run(transcriptWithMeta("Feature-review: round 1"));
    run(transcriptWithMeta("Review TASK-003 implementation"));
    expect(result().status).toBe("passed");
  });

  // The smoke dispatch has no description template, so an improvised description
  // mentioning the review must not trigger a second suite run.
  test("does not launch for a feature-smoke dispatch, whatever its description says", () => {
    writeSmoke(SMOKE.record);
    approve();
    const tp = transcriptWithMeta("Feature-review smoke of the same feature");
    writeFileSync(tp, "ROLE: quality-reviewer (MODE: feature-smoke)\n");
    const r = run(tp);
    expect(r.status).toBe(0);
    expect(existsSync(join(APP_DIR, "ran-with-src"))).toBe(false);
  });

  test("skips gracefully when the session worktree is absent", () => {
    writeSmoke(SMOKE.record);
    approve();
    rmSync(join(sessionDir, "_session"), { recursive: true, force: true });
    const r = run(transcriptWithMeta("Feature-review: x"));
    expect(r.status).toBe(0);
    expect(existsSync(join(APP_DIR, "ran-with-src"))).toBe(false);
  });
});
