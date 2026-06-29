// Tests for block-duplicate-dispatch.mjs — the PreToolUse(Agent) gate that
// stops accidental duplicate dispatches. Two concerns:
//   1. planner: at most one per (caller, TICKETS_DIR).
//   2. developer/quality-reviewer/merger: debounce identical re-dispatches
//      inside a short window (the async-runtime "Async agent launched" trap).
// A block is emitted via decisionBlock: exit 0 with {"decision":"block"} on
// stdout (NOT exit 2). An allowed dispatch exits 0 with no decision JSON.

import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  rmSync,
  utimesSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { sanitizePath } from "../lib/paths.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "block-duplicate-dispatch.mjs");
const SESSION_ID = "ab12cd34-1111-2222-3333-444455556666";
const CALLER = "orchestrator-agent-1";

let TMP;
let APP_DIR;
let breakerDir;
let env;

// Returns { blocked: boolean } — blocked when the decisionBlock JSON is printed.
const run = (prompt, subagentType, agentId = CALLER) => {
  const r = spawnSync("node", [HOOK], {
    input: JSON.stringify({
      session_id: SESSION_ID,
      agent_id: agentId,
      tool_input: { subagent_type: subagentType, prompt },
    }),
    env,
    encoding: "utf8",
  });
  return {
    blocked: /"decision":"block"/.test(r.stdout || ""),
    status: r.status,
  };
};

// Backdate every marker so the next dispatch sees it as outside the debounce
// window (and a planner marker as stale).
const ageMarkers = (secondsAgo) => {
  const when = Date.now() / 1000 - secondsAgo;
  for (const f of readdirSync(breakerDir)) {
    utimesSync(join(breakerDir, f), when, when);
  }
};

beforeAll(() => {
  TMP = mkdtempSync(join(tmpdir(), "block-dup-dispatch-test-"));
  APP_DIR = join(TMP, "app");
  const CRM_TMP_ROOT = join(TMP, "scratch");
  breakerDir = join(CRM_TMP_ROOT, sanitizePath(APP_DIR), SESSION_ID, "breaker");
  mkdirSync(breakerDir, { recursive: true });
  env = { ...process.env, APP_DIR, CRM_TMP_ROOT };
});

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe("block-duplicate-dispatch — planner", () => {
  test("allows the first planner, blocks the second for the same TICKETS_DIR", () => {
    const p = `TICKETS_DIR=${join(TMP, "tickets")}`;
    expect(run(p, "planner").blocked).toBe(false);
    expect(run(p, "planner").blocked).toBe(true);
  });

  test("allows a planner again once the marker is stale (>1h)", () => {
    ageMarkers(2 * 60 * 60); // 2h
    const p = `TICKETS_DIR=${join(TMP, "tickets")}`;
    expect(run(p, "planner").blocked).toBe(false);
  });
});

describe("block-duplicate-dispatch — reviewer/developer/merger debounce", () => {
  test("blocks a second quality-reviewer for the same ticket within the window", () => {
    const p = `ROLE: quality-reviewer\nTASK_ID: TASK-100\nWORKTREE_PATH: /wt`;
    expect(run(p, "quality-reviewer").blocked).toBe(false);
    expect(run(p, "quality-reviewer").blocked).toBe(true);
  });

  test("allows a reviewer for a different ticket", () => {
    expect(
      run(
        `ROLE: quality-reviewer\nTASK_ID: TASK-200\nWORKTREE_PATH: /wt`,
        "quality-reviewer",
      ).blocked,
    ).toBe(false);
  });

  test("allows the same reviewer again once outside the debounce window", () => {
    ageMarkers(5 * 60); // 5 min — well past the 90s window
    expect(
      run(
        `ROLE: quality-reviewer\nTASK_ID: TASK-100\nWORKTREE_PATH: /wt`,
        "quality-reviewer",
      ).blocked,
    ).toBe(false);
  });

  test("debounces by ticket, not role: a merger for a fresh ticket is allowed", () => {
    expect(
      run(`ROLE: merger\nTASK_ID: TASK-300\nBRANCH_NAME: x`, "merger").blocked,
    ).toBe(false);
  });

  test("a different caller is not debounced against the first caller's marker", () => {
    const p = `ROLE: developer\nTASK_ID: TASK-400\nWORKTREE_PATH: /wt`;
    expect(run(p, "developer", "orchestrator-A").blocked).toBe(false);
    expect(run(p, "developer", "orchestrator-B").blocked).toBe(false);
  });

  test("falls back to a prompt hash when there is no TASK_ID (SIMPLE flow)", () => {
    const p = `ROLE: developer\nCHANGE_REQUEST: rename the button\nWORKTREE_PATH: /wt`;
    expect(run(p, "developer").blocked).toBe(false);
    expect(run(p, "developer").blocked).toBe(true); // identical prompt → duplicate
    // A different change request is a distinct dispatch, not a duplicate.
    expect(
      run(
        `ROLE: developer\nCHANGE_REQUEST: hide the export\nWORKTREE_PATH: /wt`,
        "developer",
      ).blocked,
    ).toBe(false);
  });
});

describe("block-duplicate-dispatch — pass-through", () => {
  test("ignores roles outside the debounce set (documentator)", () => {
    const p = `ROLE: documentator`;
    expect(run(p, "documentator").blocked).toBe(false);
    expect(run(p, "documentator").blocked).toBe(false); // never debounced
  });

  test("allows when no caller agent_id is present (can't scope a marker)", () => {
    const r = run(
      `ROLE: quality-reviewer\nTASK_ID: TASK-100\nWORKTREE_PATH: /wt`,
      "quality-reviewer",
      "",
    );
    expect(r.blocked).toBe(false);
  });
});
