// Tests for record-review-verdict.mjs (vitest, "claude" Node project). A
// reviewer's final contract line (APPROVED / REJECTED) becomes a per-ticket flag
// under <sessionDir>/reviews/<TASK>-<role>, read later by
// block-merger-without-review.mjs. Verdict source here is last_assistant_message.

import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { sanitizePath } from "../lib/paths.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "record-review-verdict.mjs");
const SESSION_ID = "deadbeef-1111-2222-3333-444455556666";

let TMP;
let APP_DIR;
let env;
let reviewsDir;

const run = (payload) =>
  spawnSync("node", [HOOK], {
    input: JSON.stringify({ session_id: SESSION_ID, ...payload }),
    env,
    encoding: "utf8",
  });
const flag = (name) => join(reviewsDir, name);

beforeAll(() => {
  TMP = mkdtempSync(join(tmpdir(), "record-verdict-test-"));
  APP_DIR = join(TMP, "app");
  const CRM_TMP_ROOT = join(TMP, "scratch");
  reviewsDir = join(CRM_TMP_ROOT, sanitizePath(APP_DIR), SESSION_ID, "reviews");
  env = { ...process.env, APP_DIR, CRM_TMP_ROOT };
  delete env.CLAUDE_AGENT_NAME;
});

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe("record-review-verdict", () => {
  test("APPROVED writes the per-ticket flag", () => {
    run({
      agent_type: "quality-reviewer-TASK-007",
      last_assistant_message: "APPROVED",
    });
    expect(existsSync(flag("TASK-007-quality-reviewer"))).toBe(true);
  });

  test("REJECTED clears a prior flag", () => {
    run({
      agent_type: "quality-reviewer-TASK-007",
      last_assistant_message: "REJECTED: do X",
    });
    expect(existsSync(flag("TASK-007-quality-reviewer"))).toBe(false);
  });

  test("test-validator records its own flag from the final line", () => {
    run({
      agent_type: "test-validator-TASK-007",
      last_assistant_message: "Step 1 — integration: present\nAPPROVED",
    });
    expect(existsSync(flag("TASK-007-test-validator"))).toBe(true);
  });

  test("multi-line REJECTED (bulleted feedback) clears a prior flag", () => {
    // Arrange: a prior APPROVED flag exists for this ticket/role.
    run({
      agent_type: "quality-reviewer-TASK-009",
      last_assistant_message: "APPROVED",
    });
    expect(existsSync(flag("TASK-009-quality-reviewer"))).toBe(true);
    // Act: a re-review rejects using the contract's bulleted-list feedback, so
    // the REJECTED keyword is NOT on the final line.
    run({
      agent_type: "quality-reviewer-TASK-009",
      last_assistant_message:
        "Findings:\nREJECTED:\n- src/foo.ts: missing null check\n- src/bar.ts: wrong import",
    });
    // Assert: the stale APPROVED flag is cleared.
    expect(existsSync(flag("TASK-009-quality-reviewer"))).toBe(false);
  });

  test("trailing prose starting with REJECTED does not flip a real APPROVED", () => {
    // A chatty reviewer that approves but adds a clarifying sentence which happens
    // to start with the keyword must NOT be recorded as REJECTED. The contract
    // REJECTED form requires a colon (`REJECTED:`), so this trailing prose is
    // ignored and the standalone APPROVED above wins.
    run({
      agent_type: "quality-reviewer-TASK-010",
      last_assistant_message:
        "APPROVED\nREJECTED concerns from the first pass are now resolved.",
    });
    expect(existsSync(flag("TASK-010-quality-reviewer"))).toBe(true);
  });

  test("standalone APPROVED with a trailing note still approves", () => {
    run({
      agent_type: "test-validator-TASK-010",
      last_assistant_message: "APPROVED\nNice work — all e2e specs present.",
    });
    expect(existsSync(flag("TASK-010-test-validator"))).toBe(true);
  });

  test("unknown verdict leaves state untouched (no flag written)", () => {
    run({
      agent_type: "quality-reviewer-TASK-008",
      last_assistant_message: "I am still thinking about it",
    });
    expect(existsSync(flag("TASK-008-quality-reviewer"))).toBe(false);
  });
});
