// Tests for block-merger-without-review.mjs — the PreToolUse(Agent) gate that
// blocks a per-ticket merger until BOTH reviewers recorded APPROVED (flags under
// <sessionDir>/reviews/<TASK>-<role>, written by record-review-verdict.mjs). The
// gate exits 2 to block and 0 to allow. Skipped for promotion-only / SIMPLE /
// ROLLBACK dispatches and when the ticket id can't be parsed (fail open).

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { sanitizePath } from "../lib/paths.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "block-merger-without-review.mjs");
const SS = "ab12cd34";
const SESSION_ID = `${SS}-1111-2222-3333-444455556666`;

let TMP;
let APP_DIR;
let env;
let reviewsDir;

const run = (prompt, subagentType = "merger") =>
  spawnSync("node", [HOOK], {
    input: JSON.stringify({
      session_id: SESSION_ID,
      tool_input: { subagent_type: subagentType, prompt },
    }),
    env,
    encoding: "utf8",
  }).status;

const approve = (task, role) =>
  writeFileSync(join(reviewsDir, `${task}-${role}`), "");

beforeAll(() => {
  TMP = mkdtempSync(join(tmpdir(), "block-merger-test-"));
  APP_DIR = join(TMP, "app");
  const CRM_TMP_ROOT = join(TMP, "scratch");
  reviewsDir = join(CRM_TMP_ROOT, sanitizePath(APP_DIR), SESSION_ID, "reviews");
  mkdirSync(reviewsDir, { recursive: true });
  env = { ...process.env, APP_DIR, CRM_TMP_ROOT };
});

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe("block-merger-without-review", () => {
  test("blocks a per-ticket merger when no reviewer flags exist", () => {
    expect(
      run(`ROLE: merger\nTASK_ID: TASK-001\nBRANCH_NAME: ${SS}/TASK-001`),
    ).toBe(2);
  });

  test("blocks when only one reviewer has approved", () => {
    approve("TASK-002", "quality-reviewer");
    expect(
      run(`ROLE: merger\nTASK_ID: TASK-002\nBRANCH_NAME: ${SS}/TASK-002`),
    ).toBe(2);
  });

  test("allows the merger once BOTH reviewers approved", () => {
    approve("TASK-003", "quality-reviewer");
    approve("TASK-003", "test-validator");
    expect(
      run(`ROLE: merger\nTASK_ID: TASK-003\nBRANCH_NAME: ${SS}/TASK-003`),
    ).toBe(0);
  });

  test("ignores the promotion-only merger (MODE: promote)", () => {
    expect(run(`ROLE: merger\nMODE: promote\nSESSION_SHORT_ID: ${SS}`)).toBe(0);
  });

  test("ignores the SIMPLE merger (no per-ticket review)", () => {
    expect(
      run(`ROLE: merger\nTASK_ID: SIMPLE\nBRANCH_NAME: ${SS}/simple`),
    ).toBe(0);
  });

  test("ignores a non-merger dispatch", () => {
    expect(
      run(
        `ROLE: developer\nTASK_ID: TASK-001\nWORKTREE_PATH: /wt`,
        "developer",
      ),
    ).toBe(0);
  });

  test("fails open when the ticket id can't be parsed (no TASK_ID line)", () => {
    expect(run(`ROLE: merger\nBRANCH_NAME: ${SS}/whatever`)).toBe(0);
  });
});
